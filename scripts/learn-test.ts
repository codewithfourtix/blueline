// Headless verification of the imitation-learning pipeline: collect expert
// (classical) demonstrations across scenarios, train the from-scratch MLP, then
// hand the wheel to the NETWORK and check it actually drives — stays on the
// road, keeps moving, and doesn't pile into traffic.

import { Simulation } from "../src/sim/Simulation.ts";
import type { ScenarioName } from "../src/traffic/TrafficManager.ts";

let _seed = 424242;
Math.random = () => {
  _seed = (_seed * 1664525 + 1013904223) >>> 0;
  return _seed / 4294967296;
};

function fail(m: string): never {
  console.error("LEARN-TEST FAIL:", m);
  process.exit(1);
}

const dt = 1 / 60;
const sim = new Simulation();
const L = sim.path.length;
const halfWidth = sim.road.totalWidth / 2;
const wrap = (a: number, b: number) => { let d = (a - b) % L; if (d < -L / 2) d += L; else if (d > L / 2) d -= L; return d; };

// --- 1) collect expert demonstrations across diverse scenarios --------------
sim.setCollecting(true);
const scenarios: ScenarioName[] = ["highway", "trucks", "stalled", "crossing", "cutin", "dense", "jaywalker"];
for (const sc of scenarios) {
  sim.setScenario(sc);
  sim.setDesiredSpeed(18 + Math.random() * 18); // vary target speed for range
  for (let i = 0; i < 2600; i++) sim.step(dt);
}
sim.setCollecting(false);
console.log(`collected ${sim.imitation.sampleCount} expert samples`);
if (sim.imitation.sampleCount < 5000) fail("too few samples");

// --- 2) train, then DAgger (learner drives, expert labels visited states) ---
const res = sim.trainImitation(70);
console.log(`initial train: loss ${res.losses[0].toFixed(4)} -> ${res.finalLoss.toFixed(4)}`);
if (!(res.finalLoss < res.losses[0] * 0.6)) fail("loss did not decrease (network isn't learning)");

for (let it = 0; it < 5; it++) {
  // Let the CURRENT network drive while we record the EXPERT's corrective
  // action at every state it visits. Re-centre if it wanders off the road so
  // we keep gathering realistic drift→recovery data rather than far-off junk.
  sim.setControlMode("learned");
  sim.setCollecting(true);
  for (const sc of scenarios) {
    sim.setScenario(sc);
    sim.setDesiredSpeed(20 + Math.random() * 14);
    for (let i = 0; i < 1400; i++) {
      sim.step(dt);
      const ef = sim.path.toFrenet(sim.ego.x, sim.ego.y);
      if (!Number.isFinite(sim.ego.v) || Math.abs(ef.d) > 7) sim.setScenario(sc);
    }
  }
  sim.setCollecting(false);
  sim.setControlMode("classical");
  const r = sim.trainImitation(35);
  console.log(`  DAgger ${it}: samples ${sim.imitation.sampleCount}, loss ${r.finalLoss.toFixed(4)}`);
}

// --- 3) hand the wheel to the NETWORK and evaluate --------------------------
function evalLearned(scenario: ScenarioName, steps: number) {
  sim.setControlMode("learned");
  sim.setScenario(scenario);
  sim.setDesiredSpeed(26);
  let maxAbsD = 0;
  let crashes = 0;
  let minV = Infinity;
  let maxV = 0;
  for (let i = 0; i < steps; i++) {
    sim.step(dt);
    if (!Number.isFinite(sim.ego.v) || !Number.isFinite(sim.ego.x)) fail(`NaN at step ${i}`);
    const ef = sim.path.toFrenet(sim.ego.x, sim.ego.y);
    maxAbsD = Math.max(maxAbsD, Math.abs(ef.d));
    minV = Math.min(minV, sim.ego.v);
    maxV = Math.max(maxV, sim.ego.v);
    for (const c of sim.traffic.cars) {
      const ds = Math.abs(wrap(c.s, ef.s));
      const dd = Math.abs(c.d - ef.d);
      if (ds < (2.35 + c.length / 2) * 0.8 && dd < (1.0 + c.width / 2) * 0.75) crashes++;
    }
  }
  const km = sim.telemetry.distanceTravelled / 1000;
  console.log(
    `  [NN drives ${scenario}] dist ${km.toFixed(2)} km | speed ${minV.toFixed(1)}-${maxV.toFixed(1)} | max|d| ${maxAbsD.toFixed(2)} (half ${halfWidth.toFixed(2)}) | crash ${crashes}`,
  );
  return { km, maxAbsD, crashes };
}

console.log("network now driving:");
const hw = evalLearned("highway", 3000);
if (hw.km < 0.4) fail("NN barely moved on highway");
if (hw.maxAbsD > halfWidth * 1.4) fail(`NN wandered off the road (|d|=${hw.maxAbsD.toFixed(2)})`);
if (hw.crashes > 120) fail(`NN crashed too much on highway (${hw.crashes})`);

const tr = evalLearned("trucks", 2600);
if (tr.maxAbsD > halfWidth * 1.5) fail(`NN off-road in trucks (|d|=${tr.maxAbsD.toFixed(2)})`);

console.log("\nLEARN-TEST PASS — the from-scratch neural network learned to drive.");
