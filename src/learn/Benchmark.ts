// Benchmark — a head-to-head evaluation of the available drivers (classical,
// imitation-trained, evolved) over IDENTICAL seeded courses, scored on the same
// safety/comfort/efficiency metrics. Because every driver faces exactly the same
// traffic (a seeded RNG reset before each run), the comparison is apples-to-apples.

import { Simulation } from "../sim/Simulation.ts";
import { Scores } from "../sim/Metrics.ts";
import { MLP, MLPState } from "./NN.ts";
import { decodeAction } from "./features.ts";
import { ScenarioName } from "../traffic/TrafficManager.ts";

export interface DriverSpec {
  name: string;
  kind: "classical" | "imitation" | "evolved";
  weights?: MLPState; // for imitation / evolved
}

export interface BenchResult {
  name: string;
  kind: string;
  scores: Scores;
  collisions: number;
  meanSpeed: number;
  distanceKm: number;
}

const COURSE: ScenarioName[] = ["dense", "trucks", "crossing"];
const yieldToUI = () => new Promise<void>((r) => setTimeout(r, 0));

export async function benchmarkDrivers(
  specs: DriverSpec[],
  onProgress?: (name: string, frac: number) => void,
): Promise<BenchResult[]> {
  const savedRandom = Math.random;
  const results: BenchResult[] = [];
  const dt = 1 / 60;

  try {
    for (let d = 0; d < specs.length; d++) {
      const spec = specs[d];
      // Identical seeded world for every driver.
      let seed = 778899;
      Math.random = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 4294967296;
      };

      const sim = new Simulation();
      if (spec.kind === "imitation" && spec.weights) {
        sim.imitation.loadState(spec.weights);
        sim.setControlMode("learned");
      } else if (spec.kind === "evolved" && spec.weights) {
        const net = MLP.fromJSON(spec.weights);
        sim.externalPolicy = (f) => decodeAction(net.predict(f));
        sim.setControlMode("external");
      } else {
        sim.setControlMode("classical");
      }

      // Aggregate metrics across the course (reset once, then don't reset).
      let totalDist = 0;
      let collisions = 0;
      let speedSum = 0;
      let steps = 0;
      const scAccum = { safety: 0, comfort: 0, efficiency: 0, overall: 0 };
      for (let c = 0; c < COURSE.length; c++) {
        sim.setScenario(COURSE[c]);
        sim.setDesiredSpeed(26);
        sim.metrics.reset();
        for (let i = 0; i < 1600; i++) {
          sim.step(dt);
          if (i % 200 === 0) await yieldToUI();
        }
        const s = sim.metrics.scores();
        scAccum.safety += s.safety;
        scAccum.comfort += s.comfort;
        scAccum.efficiency += s.efficiency;
        scAccum.overall += s.overall;
        totalDist += sim.metrics.distance;
        collisions += sim.metrics.collisions;
        speedSum += sim.metrics.meanSpeed;
        steps++;
        onProgress?.(spec.name, (d + (c + 1) / COURSE.length) / specs.length);
      }
      results.push({
        name: spec.name,
        kind: spec.kind,
        scores: {
          safety: scAccum.safety / steps,
          comfort: scAccum.comfort / steps,
          efficiency: scAccum.efficiency / steps,
          overall: scAccum.overall / steps,
        },
        collisions,
        meanSpeed: speedSum / steps,
        distanceKm: totalDist / 1000,
      });
    }
  } finally {
    Math.random = savedRandom;
  }

  return results;
}
