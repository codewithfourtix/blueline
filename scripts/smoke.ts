// Headless smoke test — runs the full autonomy stack (sensor → Kalman tracking
// → behaviour FSM → Frenet planner → Stanley control → IDM/MOBIL traffic) with
// no renderer, across several scenarios. It asserts the stack stays numerically
// healthy, perceives traffic, hits ZERO collisions, and — the driving-quality
// guard — keeps the ego ON THE ROAD (never crossing the outer edge line),
// including at high speed through the bends.

import { Simulation } from "../src/sim/Simulation.ts";
import type { ScenarioName } from "../src/traffic/TrafficManager.ts";

// Deterministic RNG so the test is reproducible run-to-run (the app itself still
// uses real Math.random). A seeded LCG replaces Math.random for the whole suite.
let _seed = 987654321;
Math.random = () => {
  _seed = (_seed * 1664525 + 1013904223) >>> 0;
  return _seed / 4294967296;
};

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
  pedCrashes: number;
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
    crashes: 0, pedCrashes: 0, maxAbsD: 0, halfWidth, worst: {}, states: new Set(),
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
      const dsSigned = wrapDiff(c.s, ef.s, L);
      const ds = Math.abs(dsSigned);
      const dd = Math.abs(c.d - ef.d);
      if (ds < (EGO_HALF_LEN + c.length / 2) * 0.8 && dd < (EGO_HALF_W + c.width / 2) * 0.75) {
        s.crashes++;
        if (!(s as any).firstCrash) {
          (s as any).firstCrash = `step${i} car${c.id}/${c.kind} ${dsSigned > 0 ? "AHEAD" : "BEHIND"} ds=${dsSigned.toFixed(1)} dd=${dd.toFixed(1)} carV=${c.v.toFixed(1)} egoV=${sim.ego.v.toFixed(1)} egoLane=${sim.telemetry.lane} state=${sim.telemetry.behaviorState}`;
        }
      }
      if (![c.s, c.d, c.v].every(Number.isFinite)) fail(`[${scenario}] non-finite car ${c.id}`);
    }

    for (const p of sim.pedestrians.peds) {
      if (p.state === "done") continue;
      const ds = Math.abs(wrapDiff(p.s, ef.s, L));
      const dd = Math.abs(p.d - ef.d);
      if (ds < EGO_HALF_LEN + p.radius && dd < EGO_HALF_W + p.radius) s.pedCrashes++;
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
  console.log(`  vehicle crashes  : ${s.crashes}${(s as any).firstCrash ? "  → " + (s as any).firstCrash : ""}`);
  console.log(`  pedestrian hits  : ${s.pedCrashes}`);
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

// --- hard cases: pedestrians (crossing / occluded / jaywalker) --------------
for (const sc of ["crossing", "occluded", "jaywalker"] as const) {
  const r = run(sc, 2800);
  report(sc, r);
  if (r.pedCrashes > 0) fail(`${sc}: ego hit a pedestrian (${r.pedCrashes} steps)`);
  if (r.crashes > 0) fail(`${sc}: ${r.crashes} vehicle collision steps`);
  assertOnRoad(sc, r);
  if (r.km < 0.25) fail(`${sc}: ego did not progress (${r.km.toFixed(2)} km) — stuck?`);
}

// --- rush hour: dense traffic + pedestrian + traffic light, all at once ------
const rush = run("rush", 3200);
report("rush", rush);
if (rush.pedCrashes > 0) fail(`rush: ego hit a pedestrian (${rush.pedCrashes} steps)`);
if (rush.crashes > 0) fail(`rush: ${rush.crashes} vehicle collision steps`);
assertOnRoad("rush", rush);
if (rush.km < 0.3) fail(`rush: ego did not progress (${rush.km.toFixed(2)} km)`);

console.log("\nSMOKE PASS — all scenarios: on-road, zero collisions, pedestrians safe.");
