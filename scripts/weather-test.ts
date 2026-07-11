// Verify the ego copes with degraded perception in adverse weather: shorter
// sensor range + more noise/dropout, but it slows down and stays safe.

import { Simulation } from "../src/sim/Simulation.ts";
import type { Weather } from "../src/sim/Simulation.ts";

let _seed = 24680;
Math.random = () => { _seed = (_seed * 1664525 + 1013904223) >>> 0; return _seed / 4294967296; };

function fail(m: string): never {
  console.error("WEATHER-TEST FAIL:", m);
  process.exit(1);
}

const dt = 1 / 60;
function run(w: Weather): number {
  const sim = new Simulation();
  sim.setScenario("dense");
  sim.setDesiredSpeed(30);
  sim.setWeather(w);
  const L = sim.path.length;
  const halfWidth = sim.road.totalWidth / 2;
  const wrap = (a: number, b: number) => { let d = (a - b) % L; if (d < -L / 2) d += L; else if (d > L / 2) d -= L; return d; };
  let crashes = 0;
  let maxAbsD = 0;
  let sumV = 0;
  for (let i = 0; i < 3000; i++) {
    sim.step(dt);
    if (!Number.isFinite(sim.ego.v)) fail(`${w}: NaN`);
    const ef = sim.path.toFrenet(sim.ego.x, sim.ego.y);
    maxAbsD = Math.max(maxAbsD, Math.abs(ef.d));
    sumV += sim.ego.v;
    for (const c of sim.traffic.cars) {
      if (Math.abs(wrap(c.s, ef.s)) < (2.35 + c.length / 2) * 0.8 && Math.abs(c.d - ef.d) < (1.0 + c.width / 2) * 0.75) crashes++;
    }
  }
  const meanV = sumV / 3000;
  console.log(`[${w}] sensor ${sim.sensor.config.range}m | mean speed ${meanV.toFixed(1)} m/s | max|d| ${maxAbsD.toFixed(2)} | crashes ${crashes}`);
  if (crashes > 0) fail(`${w}: ${crashes} collisions`);
  if (maxAbsD > halfWidth) fail(`${w}: left the road`);
  return meanV;
}

const clear = run("clear");
const rain = run("rain");
const fog = run("fog");
if (!(fog < clear - 1)) fail("ego did not slow down in fog");

console.log("\nWEATHER-TEST PASS — safe in rain & fog, and slows for low visibility.");
