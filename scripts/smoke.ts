// Headless smoke test — runs the full autonomy stack (sensor → Kalman tracking
// → behaviour FSM → Frenet planner → control → IDM/MOBIL traffic) with no
// renderer, across several scenarios, and asserts it stays numerically healthy,
// makes progress, perceives traffic, and — crucially — does not crash into the
// stalled car or the cut-in. Real end-to-end verification without a browser.

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
  minGap: number;
  states: Set<string>;
}

function run(scenario: ScenarioName, steps: number): Stats {
  const sim = new Simulation();
  sim.setScenario(scenario);
  const dt = 1 / 60;
  const L = sim.path.length;

  const s: Stats = {
    km: 0, minV: Infinity, maxV: -Infinity, laneChanges: 0,
    maxTracked: 0, crashes: 0, minGap: Infinity, states: new Set(),
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

    // Collision check in the road's Frenet frame.
    const ef = sim.path.toFrenet(x, y);
    for (const c of sim.traffic.cars) {
      const ds = Math.abs(wrapDiff(c.s, ef.s, L));
      const dd = Math.abs(c.d - ef.d);
      const lonOverlap = (EGO_HALF_LEN + c.length / 2) * 0.8;
      const latOverlap = (EGO_HALF_W + c.width / 2) * 0.75;
      const clearance = Math.max(ds - lonOverlap, dd - latOverlap);
      if (ds < 60) s.minGap = Math.min(s.minGap, Math.max(ds - (EGO_HALF_LEN + c.length / 2), 0));
      if (ds < lonOverlap && dd < latOverlap) s.crashes++;
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
  console.log(`  max tracks       : ${s.maxTracked}`);
  console.log(`  behaviour states : ${[...s.states].join(", ")}`);
  console.log(`  min gap to car   : ${s.minGap === Infinity ? "n/a" : s.minGap.toFixed(2) + " m"}`);
  console.log(`  crash steps      : ${s.crashes}`);
}

// --- highway: general health ------------------------------------------------
const hw = run("highway", 3000);
report("highway", hw);
if (hw.km < 0.4) fail("highway: ego barely moved");
if (hw.maxTracked < 1) fail("highway: perception produced no tracks");
if (hw.crashes > 0) fail(`highway: ${hw.crashes} collision steps`);

// --- stalled: must perceive and avoid a dead-stopped car in its lane --------
const st = run("stalled", 2200);
report("stalled", st);
if (st.crashes > 0) fail(`stalled: ego hit the stalled car (${st.crashes} steps)`);
if (st.km < 0.3) fail("stalled: ego did not progress (over-braked)");

// --- cutin: aggressive car swerves in; ego must not crash -------------------
const ci = run("cutin", 1800);
report("cutin", ci);
if (ci.crashes > 0) fail(`cutin: ego crashed during cut-in (${ci.crashes} steps)`);

// --- trucks: must overtake a slow convoy ------------------------------------
const tr = run("trucks", 2600);
report("trucks", tr);
if (tr.crashes > 0) fail(`trucks: ego hit a truck (${tr.crashes} steps)`);
if (tr.laneChanges < 1) fail("trucks: ego never overtook (no lane changes)");

console.log("\nSMOKE PASS — all scenarios healthy, zero collisions.");
