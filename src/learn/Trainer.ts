// Trainer — orchestrates imitation learning + DAgger on a HIDDEN simulation
// (so the on-screen car isn't disturbed), yielding to the event loop so the UI
// can show live progress. Returns the trained network's weights, which the app
// loads into the visible car's agent.

import { Simulation } from "../sim/Simulation.ts";
import { MLPState } from "./NN.ts";
import { ScenarioName } from "../traffic/TrafficManager.ts";

export interface TrainProgress {
  phase: string;
  frac: number; // overall 0..1
  loss: number;
  samples: number;
}

const SCENARIOS: ScenarioName[] = ["highway", "trucks", "stalled", "crossing", "cutin", "dense"];
const yieldToUI = () => new Promise<void>((r) => setTimeout(r, 0));

export async function trainDriver(onProgress: (p: TrainProgress) => void): Promise<MLPState> {
  const sim = new Simulation();
  const dt = 1 / 60;
  let loss = 0;

  const runScenario = async (sc: ScenarioName, steps: number, learner: boolean, recenter: boolean) => {
    sim.setScenario(sc);
    sim.setDesiredSpeed(18 + Math.random() * 16);
    sim.setControlMode(learner ? "learned" : "classical");
    for (let i = 0; i < steps; i++) {
      sim.step(dt);
      if (recenter) {
        const ef = sim.path.toFrenet(sim.ego.x, sim.ego.y);
        if (!Number.isFinite(sim.ego.v) || Math.abs(ef.d) > 7) sim.setScenario(sc);
      }
      if (i % 200 === 0) await yieldToUI();
    }
  };

  const trainChunked = async (epochs: number, base: number, span: number, phase: string) => {
    const chunk = 5;
    for (let e = 0; e < epochs; e += chunk) {
      const r = sim.trainImitation(Math.min(chunk, epochs - e));
      loss = r.finalLoss;
      onProgress({ phase, frac: base + (span * (e + chunk)) / epochs, loss, samples: sim.imitation.sampleCount });
      await yieldToUI();
    }
  };

  // --- collect expert demonstrations (35% of the bar) -----------------------
  sim.setCollecting(true);
  for (let k = 0; k < SCENARIOS.length; k++) {
    onProgress({ phase: "Collecting expert demonstrations", frac: (0.35 * k) / SCENARIOS.length, loss, samples: sim.imitation.sampleCount });
    await runScenario(SCENARIOS[k], 1600, false, false);
  }
  sim.setCollecting(false);

  // --- initial supervised training (15%) ------------------------------------
  await trainChunked(60, 0.35, 0.15, "Training network (behavioural cloning)");

  // --- DAgger: learner drives, expert corrects (remaining 50%) --------------
  const iters = 3;
  for (let it = 0; it < iters; it++) {
    const base = 0.5 + (0.5 * it) / iters;
    sim.setCollecting(true);
    for (const sc of SCENARIOS) {
      onProgress({ phase: `DAgger refinement ${it + 1}/${iters}`, frac: base, loss, samples: sim.imitation.sampleCount });
      await runScenario(sc, 1100, true, true);
    }
    sim.setCollecting(false);
    sim.setControlMode("classical");
    await trainChunked(30, base + 0.5 / iters * 0.4, (0.5 / iters) * 0.6, `DAgger refinement ${it + 1}/${iters}`);
  }

  onProgress({ phase: "Done", frac: 1, loss, samples: sim.imitation.sampleCount });
  return sim.imitation.net.toJSON();
}
