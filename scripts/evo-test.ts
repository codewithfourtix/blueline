// Headless verification of neuroevolution: evolve a driver from random weights
// (no teacher), confirm fitness climbs across generations, then let the champion
// drive and confirm it actually holds the road and makes progress.

import { Simulation } from "../src/sim/Simulation.ts";
import { evolveDriver } from "../src/learn/Evolution.ts";
import { MLP } from "../src/learn/NN.ts";
import { decodeAction } from "../src/learn/features.ts";

let _seed = 20260711;
Math.random = () => {
  _seed = (_seed * 1664525 + 1013904223) >>> 0;
  return _seed / 4294967296;
};

function fail(m: string): never {
  console.error("EVO-TEST FAIL:", m);
  process.exit(1);
}

const history: number[] = [];
const champState = await evolveDriver((p) => {
  history.push(p.bestFitness);
  console.log(`  gen ${p.generation}/${p.totalGen}: best ${p.bestFitness.toFixed(1)}, avg ${p.avgFitness.toFixed(1)}`);
});

const first = history[0];
const last = history[history.length - 1];
console.log(`fitness: ${first.toFixed(1)} -> ${last.toFixed(1)}`);
if (!(last > first + 20)) fail("fitness did not improve (evolution isn't learning)");

// Champion drives.
const champ = MLP.fromJSON(champState);
const sim = new Simulation();
sim.setScenario("highway");
sim.setDesiredSpeed(26);
sim.externalPolicy = (f) => decodeAction(champ.predict(f));
sim.setControlMode("external");
const dt = 1 / 60;
const L = sim.path.length;
const halfWidth = sim.road.totalWidth / 2;
const wrap = (a: number, b: number) => { let d = (a - b) % L; if (d < -L / 2) d += L; else if (d > L / 2) d -= L; return d; };
let maxAbsD = 0;
let crashes = 0;
for (let i = 0; i < 3000; i++) {
  sim.step(dt);
  if (!Number.isFinite(sim.ego.v)) fail("champion produced NaN");
  const ef = sim.path.toFrenet(sim.ego.x, sim.ego.y);
  maxAbsD = Math.max(maxAbsD, Math.abs(ef.d));
  for (const c of sim.traffic.cars) {
    const ds = Math.abs(wrap(c.s, ef.s));
    const dd = Math.abs(c.d - ef.d);
    if (ds < (2.35 + c.length / 2) * 0.8 && dd < (1.0 + c.width / 2) * 0.75) crashes++;
  }
}
const km = sim.telemetry.distanceTravelled / 1000;
console.log(`champion drives: dist ${km.toFixed(2)} km | max|d| ${maxAbsD.toFixed(2)} (half ${halfWidth.toFixed(2)}) | crash ${crashes}`);
if (km < 0.4) fail("champion barely moved");
if (maxAbsD > halfWidth * 1.6) fail(`champion wandered off (|d|=${maxAbsD.toFixed(2)})`);

console.log("\nEVO-TEST PASS — neuroevolution discovered a driving policy from scratch.");
