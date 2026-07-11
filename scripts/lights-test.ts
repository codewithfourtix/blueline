// Verify traffic-light behaviour: the ego stops at the stop-line on red, never
// runs the red, and proceeds on green (makes progress over several cycles).

import { Simulation } from "../src/sim/Simulation.ts";

let _seed = 55;
Math.random = () => { _seed = (_seed * 1664525 + 1013904223) >>> 0; return _seed / 4294967296; };

function fail(m: string): never {
  console.error("LIGHTS-TEST FAIL:", m);
  process.exit(1);
}

const sim = new Simulation();
sim.setScenario("lights");
sim.setDesiredSpeed(24);
const dt = 1 / 60;
const L = sim.path.length;
const light = sim.trafficLights[0];

let stoppedAtRed = false;
let ranRed = 0;
let prevFwd = 999;
let minVnearLine = Infinity;
for (let i = 0; i < 4000; i++) {
  sim.step(dt);
  const ef = sim.path.toFrenet(sim.ego.x, sim.ego.y);
  const fwd = ((light.s - ef.s) % L + L) % L;
  if (light.state === "red") {
    if (fwd < 12) minVnearLine = Math.min(minVnearLine, sim.ego.v);
    if (fwd < 10 && sim.ego.v < 0.8) stoppedAtRed = true;
    // Crossed the line (fwd wrapped from small to ~L) while red = ran the light.
    if (prevFwd < 6 && fwd > L - 6) ranRed++;
  }
  prevFwd = fwd;
}

const km = sim.telemetry.distanceTravelled / 1000;
console.log(`distance ${km.toFixed(2)} km | stopped at red: ${stoppedAtRed} | ran red: ${ranRed} | min speed near red line: ${minVnearLine === Infinity ? "n/a" : minVnearLine.toFixed(1)}`);
if (ranRed > 0) fail(`ego ran the red light ${ranRed} times`);
if (!stoppedAtRed) fail("ego never stopped at a red light");
if (km < 0.4) fail("ego did not progress through greens");

console.log("\nLIGHTS-TEST PASS — ego obeys the traffic light (stops on red, goes on green).");
