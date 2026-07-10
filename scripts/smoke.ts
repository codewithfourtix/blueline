// Headless smoke test — runs the full autonomy stack (perception → planning →
// control → traffic) with no renderer for ~50 simulated seconds and asserts it
// stays numerically healthy and actually makes forward progress. This exercises
// the real algorithms (Frenet planner, IDM/MOBIL, Pure Pursuit, PID) so we get
// runtime confidence without a browser.

import { Simulation } from "../src/sim/Simulation.ts";

function fail(msg: string): never {
  console.error("SMOKE FAIL:", msg);
  process.exit(1);
}

const sim = new Simulation();
const dt = 1 / 60;
const steps = 3000; // 50 s

let minSpeed = Infinity;
let maxSpeed = -Infinity;
let laneChanges = 0;
let prevLane = sim.telemetry.lane;
let everColliding = false;

for (let i = 0; i < steps; i++) {
  sim.step(dt);

  const { x, y, yaw, v } = sim.ego;
  if (![x, y, yaw, v].every(Number.isFinite)) fail(`non-finite ego state at step ${i}`);
  if (!sim.plan || sim.plan.points.length < 2) fail(`no valid plan at step ${i}`);
  if (v < -0.01 || v > 45) fail(`speed out of range (${v}) at step ${i}`);

  minSpeed = Math.min(minSpeed, v);
  maxSpeed = Math.max(maxSpeed, v);
  if (sim.telemetry.lane !== prevLane) {
    laneChanges++;
    prevLane = sim.telemetry.lane;
  }
  if (sim.telemetry.colliding) everColliding = true;

  // Traffic must stay finite too.
  for (const c of sim.traffic.cars) {
    if (![c.s, c.d, c.v].every(Number.isFinite)) fail(`non-finite traffic car ${c.id} at step ${i}`);
  }
}

const km = sim.telemetry.distanceTravelled / 1000;
if (km < 0.2) fail(`ego barely moved: ${km.toFixed(3)} km in 50 s`);

console.log("SMOKE PASS");
console.log(`  distance travelled : ${km.toFixed(2)} km`);
console.log(`  speed range        : ${minSpeed.toFixed(1)} – ${maxSpeed.toFixed(1)} m/s`);
console.log(`  ego lane changes   : ${laneChanges}`);
console.log(`  traffic cars       : ${sim.traffic.count}`);
console.log(`  final plan cost    : ${sim.telemetry.planCost.toFixed(1)}`);
console.log(`  plan time (last)   : ${sim.telemetry.planMs.toFixed(2)} ms`);
console.log(`  hazard braking hit : ${everColliding ? "yes (reacted to traffic)" : "no"}`);
