// Evolution — neuroevolution: a genetic algorithm that evolves neural-network
// weights to drive, with NO teacher at all. Each genome is a flat weight vector;
// its fitness is how well it drives a rollout (distance made good, minus penalties
// for leaving the road or hitting traffic). Selection + crossover + mutation over
// generations discovers a driving policy from scratch — the ego literally learns
// to steer and avoid by survival of the fittest.

import { Simulation } from "../sim/Simulation.ts";
import { MLP, MLPState } from "./NN.ts";
import { FEATURE_SIZE, decodeAction } from "./features.ts";

export interface EvoProgress {
  generation: number;
  totalGen: number;
  bestFitness: number;
  avgFitness: number;
  frac: number;
}

const ARCH = [FEATURE_SIZE, 16, 2];
const yieldToUI = () => new Promise<void>((r) => setTimeout(r, 0));

function randn(): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export async function evolveDriver(onProgress: (p: EvoProgress) => void): Promise<MLPState> {
  const POP = 24;
  const GENS = 16;
  const ELITE = 4;
  const ROLL = 700;
  const dt = 1 / 60;

  const template = new MLP(ARCH);
  const genomeLen = template.flat().length;
  const net = new MLP(ARCH); // reused for evaluation
  const sim = new Simulation();
  sim.safetyShieldEnabled = false; // judge each candidate on its RAW driving
  const L = sim.path.length;
  const roadHalf = sim.road.totalWidth / 2;
  const wrap = (a: number, b: number) => { let d = (a - b) % L; if (d < -L / 2) d += L; else if (d > L / 2) d -= L; return d; };

  const randomGenome = (): number[] => Array.from({ length: genomeLen }, () => randn() * 0.5);

  // One driving rollout on the CURRENT traffic. Rewards progress, punishes
  // wandering / leaving the road, and dies early on a hopeless run.
  const rollout = (): number => {
    let reward = 0;
    for (let i = 0; i < ROLL; i++) {
      sim.step(dt);
      if (!Number.isFinite(sim.ego.v) || !Number.isFinite(sim.ego.x)) return reward - 50;
      const ef = sim.path.toFrenet(sim.ego.x, sim.ego.y);
      reward += sim.ego.v * dt; // progress
      const off = Math.abs(ef.d);
      reward -= 0.6 * Math.max(0, off - 2) * dt; // stay tight to a lane centre
      if (off > roadHalf - 0.4) return reward - 20; // leaving the road → die
      for (const c of sim.traffic.cars) {
        const ds = Math.abs(wrap(c.s, ef.s));
        const dd = Math.abs(c.d - ef.d);
        if (ds < (2.35 + c.length / 2) * 0.85 && dd < (1.0 + c.width / 2) * 0.8) return reward - 30;
      }
    }
    return reward;
  };

  // Fitness = worst of TWO rollouts on DIFFERENT traffic, so we select for a
  // policy that generalises (not one that memorised one layout).
  const evaluate = (g: number[]): number => {
    net.setFlat(g);
    sim.externalPolicy = (f) => decodeAction(net.predict(f));
    let worst = Infinity;
    for (let r = 0; r < 2; r++) {
      sim.setScenario("highway"); // respawns traffic randomly
      sim.setDesiredSpeed(26);
      sim.safetyShieldEnabled = false;
      sim.setControlMode("external");
      worst = Math.min(worst, rollout());
    }
    return worst;
  };

  const tournament = (pop: number[][], fits: number[]): number[] => {
    let best = -1;
    let bestF = -Infinity;
    for (let k = 0; k < 3; k++) {
      const i = Math.floor(Math.random() * pop.length);
      if (fits[i] > bestF) {
        bestF = fits[i];
        best = i;
      }
    }
    return pop[best];
  };

  let pop = Array.from({ length: POP }, randomGenome);

  for (let gen = 0; gen < GENS; gen++) {
    const fits = new Array<number>(POP);
    for (let i = 0; i < POP; i++) {
      fits[i] = evaluate(pop[i]);
      if (i % 3 === 0) await yieldToUI();
    }
    const order = [...Array(POP).keys()].sort((a, b) => fits[b] - fits[a]);
    const best = fits[order[0]];
    const avg = fits.reduce((s, f) => s + f, 0) / POP;
    onProgress({ generation: gen + 1, totalGen: GENS, bestFitness: best, avgFitness: avg, frac: (gen + 1) / GENS });

    // Next generation: keep elites, breed the rest.
    const next: number[][] = [];
    for (let e = 0; e < ELITE; e++) next.push(pop[order[e]].slice());
    const sigma = 0.25 * (1 - gen / GENS) + 0.03;
    while (next.length < POP) {
      const p1 = tournament(pop, fits);
      const p2 = tournament(pop, fits);
      const child = new Array<number>(genomeLen);
      for (let k = 0; k < genomeLen; k++) {
        child[k] = Math.random() < 0.5 ? p1[k] : p2[k]; // uniform crossover
        if (Math.random() < 0.12) child[k] += randn() * sigma; // mutation
      }
      next.push(child);
    }
    // Keep the champion at index 0 for retrieval.
    pop = [pop[order[0]].slice(), ...next.slice(1)];
  }

  const champion = new MLP(ARCH);
  champion.setFlat(pop[0]);
  return champion.toJSON();
}
