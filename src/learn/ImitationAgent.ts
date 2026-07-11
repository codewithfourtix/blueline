// ImitationAgent — behavioural cloning. It records (features → action) pairs
// produced by the classical stack (the "expert"), trains the MLP to reproduce
// them, and can then drive the car itself. This is the supervised-learning path:
// the network learns to imitate a known-good driver.

import { MLP } from "./NN.ts";
import { FEATURE_SIZE, STEER_NORM, ACCEL_NORM } from "./features.ts";
import { clamp } from "../core/math.ts";

export interface TrainResult {
  epochs: number;
  finalLoss: number;
  samples: number;
  losses: number[];
}

export class ImitationAgent {
  net: MLP;
  trained = false;
  lastLoss = 0;
  losses: number[] = [];
  private X: number[][] = [];
  private Y: number[][] = [];
  maxSamples = 60000;

  constructor() {
    this.net = new MLP([FEATURE_SIZE, 32, 32, 2]);
  }

  get sampleCount(): number {
    return this.X.length;
  }

  clearData(): void {
    this.X = [];
    this.Y = [];
  }

  /** Record one expert demonstration (raw steering in rad, accel in m/s²). */
  addSample(features: number[], steer: number, accel: number): void {
    this.X.push(features.slice());
    this.Y.push([steer / STEER_NORM, accel / ACCEL_NORM]);
    if (this.X.length > this.maxSamples) {
      this.X.shift();
      this.Y.shift();
    }
  }

  /** Train the network on the collected demonstrations. */
  train(epochs = 60, batchSize = 64, lr = 0.01): TrainResult {
    const n = this.X.length;
    this.losses = [];
    if (n === 0) return { epochs: 0, finalLoss: 0, samples: 0, losses: [] };

    const idx = Array.from({ length: n }, (_, i) => i);
    for (let e = 0; e < epochs; e++) {
      // Shuffle.
      for (let i = n - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const t = idx[i];
        idx[i] = idx[j];
        idx[j] = t;
      }
      let epochLoss = 0;
      let batches = 0;
      for (let b = 0; b < n; b += batchSize) {
        const xs: number[][] = [];
        const ys: number[][] = [];
        for (let k = b; k < Math.min(b + batchSize, n); k++) {
          xs.push(this.X[idx[k]]);
          ys.push(this.Y[idx[k]]);
        }
        epochLoss += this.net.trainBatch(xs, ys, lr);
        batches++;
      }
      this.losses.push(epochLoss / Math.max(1, batches));
    }
    this.lastLoss = this.losses[this.losses.length - 1];
    this.trained = true;
    return { epochs, finalLoss: this.lastLoss, samples: n, losses: this.losses };
  }

  /** Predict a driving action from features. */
  act(features: number[]): { steer: number; accel: number } {
    const o = this.net.predict(features);
    return {
      steer: clamp(o[0], -1.2, 1.2) * STEER_NORM,
      accel: clamp(o[1], -1.2, 1.2) * ACCEL_NORM,
    };
  }
}
