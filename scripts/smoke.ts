// Headless smoke test — runs the full autonomy stack (sensor → Kalman tracking
// → behaviour FSM → Frenet planner → Stanley control → IDM/MOBIL traffic) with
// no renderer, across several scenarios. It asserts the stack stays numerically
// healthy, perceives traffic, hits ZERO collisions, and — the driving-quality
// guard — keeps the ego ON THE ROAD (never crossing the outer edge line),
// including at high speed through the bends.

import { Simulation } from "../src/sim/Simulation.ts";
import type { ScenarioName } from "../src/traffic/TrafficManager.ts";

const EGO_HALF_LEN = 2.35;
const EGO_HALF_W = 1.0;

function fail(msg: string): never {
  console.error("SMOKE FAIL:", msg);
  process.exit(1);
}

function wrapDiff(a: number, b: number, len: number): number {
  let d = (a - b) % len;
  if (d < -len / 2) d += len;
  else if (d > len / 2) d -= len;
  return d;
}

interface Stats {
  km: number;
  minV: number;
  maxV: number;
  laneChanges: number;
  maxTracked: number;
  crashes: number;
  maxAbsD: number;
  halfWidth: number;
  worst: Record<string, unknown>;
  states: Set<string>;
}

function run(scenario: ScenarioName, steps: number, desiredSpeed?: number): Stats {
  const sim = new Simulation();
  sim.setScenario(scenario);
  if (desiredSpeed) sim.setDesiredSpeed(desiredSpeed);
  const dt = 1 / 60;
  const L = sim.path.length;
  const halfWidth = sim.road.totalWidth / 2;

  const s: Stats = {
    km: 0, minV: Infinity, maxV: -Infinity, laneChanges: 0, maxTracked: 0,
    crashes: 0, maxAbsD: 0, halfWidth, worst: {}, states: new Set(),
  };
  let prevLane = sim.telemetry.lane;

  for (let i = 0; i < steps; i++) {
    sim.step(dt);

    const { x, y, yaw, v } = sim.ego;
    if (![x, y, yaw, v].every(Number.isFinite)) fail(`[${scenario}] non-finite ego at step ${i}`);
    if (!sim.plan || sim.plan.points.length < 2) fail(`[${scenario}] no plan at step ${i}`);
    if (v < -0.01 || v > 45) fail(`[${scenario}] speed ${v} out of range at step ${i}`);

    s.minV = Math.min(s.minV, v);
    s.maxV = Math.max(s.maxV, v);
    s.maxTracked = Math.max(s.maxTracked, sim.telemetry.trackedCount);
    s.states.add(sim.telemetry.behaviorState);
    if (sim.telemetry.lane !== prevLane) {
      s.laneChanges++;
      prevLane = sim.telemetry.lane;
    }

    const ef = sim.path.toFrenet(x, y);
    if (Math.abs(ef.d) > s.maxAbsD) {
      s.maxAbsD = Math.abs(ef.d);
      s.worst = { step: i, s: ef.s.toFixed(1), v: v.toFixed(1), lane: sim.telemetry.lane, state: sim.telemetry.behaviorState };
    }

    for (const c of sim.traffic.cars) {
      const ds = Math.abs(wrapDiff(c.s, ef.s, L));
      const dd = Math.abs(c.d - ef.d);
      if (ds < (EGO_HALF_LEN + c.length / 2) * 0.8 && dd < (EGO_HALF_W + c.width / 2) * 0.75) s.crashes++;
      if (![c.s, c.d, c.v].every(Number.isFinite)) fail(`[${scenario}] non-finite car ${c.id}`);
    }
  }
  s.km = sim.telemetry.distanceTravelled / 1000;
  return s;
}

function report(name: string, s: Stats): void {
  console.log(`\n[${name}]`);
  console.log(`  distance         : ${s.km.toFixed(2)} km`);
  console.log(`  speed range      : ${s.minV.toFixed(1)} – ${s.maxV.toFixed(1)} m/s`);
  console.log(`  lane changes     : ${s.laneChanges}`);
  console.log(`  behaviour states : ${[...s.states].join(", ")}`);
  console.log(`  max lateral |d|  : ${s.maxAbsD.toFixed(2)} m  (half-width ${s.halfWidth.toFixed(2)} m)`);
  console.log(`  crash steps      : ${s.crashes}`);
}

function assertOnRoad(name: string, s: Stats): void {
  if (s.maxAbsD > s.halfWidth) {
    fail(`${name}: ego left the road (|d|=${s.maxAbsD.toFixed(2)} > ${s.halfWidth.toFixed(2)} m) @ ${JSON.stringify(s.worst)}`);
  }
}

// --- highway: general health -----------------------------------------------
const hw = run("highway", 3000);
report("highway", hw);
if (hw.km < 0.4) fail("highway: ego barely moved");
if (hw.maxTracked < 1) fail("highway: perception produced no tracks");
if (hw.crashes > 0) fail(`highway: ${hw.crashes} collision steps`);
assertOnRoad("highway", hw);

// --- high speed: must slow for bends and stay on the road, never crashing ---
const fast = run("highway", 3000, 40);
report("highway@fast", fast);
if (fast.crashes > 0) fail(`highway@fast: ${fast.crashes} collision steps`);
assertOnRoad("highway@fast", fast);

// --- stalled: perceive and avoid a dead-stopped car in its lane -------------
const st = run("stalled", 2200);
report("stalled", st);
if (st.crashes > 0) fail(`stalled: ego hit the stalled car (${st.crashes} steps)`);
if (st.km < 0.3) fail("stalled: ego did not progress (over-braked)");
assertOnRoad("stalled", st);

// --- cutin: aggressive car swerves in; ego must not crash -------------------
const ci = run("cutin", 1800);
report("cutin", ci);
if (ci.crashes > 0) fail(`cutin: ego crashed during cut-in (${ci.crashes} steps)`);
assertOnRoad("cutin", ci);

// --- trucks: must overtake a slow convoy without leaving the road -----------
const tr = run("trucks", 2600);
report("trucks", tr);
if (tr.crashes > 0) fail(`trucks: ego hit a truck (${tr.crashes} steps)`);
if (tr.laneChanges < 1) fail("trucks: ego never overtook (no lane changes)");
assertOnRoad("trucks", tr);

console.log("\nSMOKE PASS — all scenarios: on-road, zero collisions.");
