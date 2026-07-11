// MLP — a multi-layer perceptron with backpropagation and the Adam optimiser,
// implemented from scratch (no ML library). This is the network that learns to
// drive: tanh hidden layers, a linear output head, trained by minimising the
// mean-squared error between its predicted action and the teacher's action.
//
// Kept dependency-free and small (a few hundred weights) so it trains to a
// competent driver in a second or two, entirely in the browser.

export interface MLPState {
  sizes: number[];
  W: number[][][];
  b: number[][];
}

function tanh(x: number): number {
  // Numerically-stable tanh.
  if (x > 20) return 1;
  if (x < -20) return -1;
  const e = Math.exp(2 * x);
  return (e - 1) / (e + 1);
}

export class MLP {
  readonly sizes: number[];
  W: number[][][]; // W[l][j][i]  (layer l, output j, input i)
  b: number[][]; // b[l][j]

  // Adam moment estimates.
  private mW: number[][][];
  private vW: number[][][];
  private mb: number[][];
  private vb: number[][];
  private t = 0;

  constructor(sizes: number[], rng: () => number = Math.random) {
    this.sizes = sizes.slice();
    this.W = [];
    this.b = [];
    this.mW = [];
    this.vW = [];
    this.mb = [];
    this.vb = [];
    for (let l = 1; l < sizes.length; l++) {
      const nin = sizes[l - 1];
      const nout = sizes[l];
      const scale = Math.sqrt(2 / (nin + nout)); // Xavier
      const Wl: number[][] = [];
      const mWl: number[][] = [];
      const vWl: number[][] = [];
      const bl: number[] = [];
      const mbl: number[] = [];
      const vbl: number[] = [];
      for (let j = 0; j < nout; j++) {
        const row: number[] = [];
        const mrow: number[] = [];
        const vrow: number[] = [];
        for (let i = 0; i < nin; i++) {
          row.push((rng() * 2 - 1) * scale);
          mrow.push(0);
          vrow.push(0);
        }
        Wl.push(row);
        mWl.push(mrow);
        vWl.push(vrow);
        bl.push(0);
        mbl.push(0);
        vbl.push(0);
      }
      this.W.push(Wl);
      this.mW.push(mWl);
      this.vW.push(vWl);
      this.b.push(bl);
      this.mb.push(mbl);
      this.vb.push(vbl);
    }
  }

  /** Forward pass returning per-layer activations (index 0 = input). */
  private forward(x: number[]): number[][] {
    const acts: number[][] = [x];
    let a = x;
    for (let l = 0; l < this.W.length; l++) {
      const Wl = this.W[l];
      const bl = this.b[l];
      const out: number[] = new Array(Wl.length);
      const last = l === this.W.length - 1;
      for (let j = 0; j < Wl.length; j++) {
        let z = bl[j];
        const row = Wl[j];
        for (let i = 0; i < row.length; i++) z += row[i] * a[i];
        out[j] = last ? z : tanh(z); // linear output head, tanh hidden
      }
      acts.push(out);
      a = out;
    }
    return acts;
  }

  predict(x: number[]): number[] {
    const acts = this.forward(x);
    return acts[acts.length - 1];
  }

  /** One Adam step over a mini-batch. Returns the batch MSE loss. */
  trainBatch(xs: number[][], ys: number[][], lr = 0.01): number {
    const L = this.W.length;
    // Gradient accumulators.
    const gW = this.W.map((Wl) => Wl.map((row) => row.map(() => 0)));
    const gb = this.b.map((bl) => bl.map(() => 0));
    let loss = 0;

    for (let n = 0; n < xs.length; n++) {
      const acts = this.forward(xs[n]);
      const y = ys[n];
      const aL = acts[L];
      // Output delta (linear head, MSE): delta = (aL - y)
      let delta: number[] = new Array(aL.length);
      for (let j = 0; j < aL.length; j++) {
        const e = aL[j] - y[j];
        delta[j] = e;
        loss += 0.5 * e * e;
      }
      // Backprop through layers.
      for (let l = L - 1; l >= 0; l--) {
        const aPrev = acts[l];
        for (let j = 0; j < this.W[l].length; j++) {
          const d = delta[j];
          gb[l][j] += d;
          const gRow = gW[l][j];
          for (let i = 0; i < aPrev.length; i++) gRow[i] += d * aPrev[i];
        }
        if (l > 0) {
          // Propagate to previous layer: newDelta_i = (sum_j W[l][j][i] delta_j) * tanh'(a_prev_i)
          const nPrev = acts[l].length;
          const nd: number[] = new Array(nPrev).fill(0);
          for (let j = 0; j < this.W[l].length; j++) {
            const row = this.W[l][j];
            const d = delta[j];
            for (let i = 0; i < nPrev; i++) nd[i] += row[i] * d;
          }
          const aPrevAct = acts[l];
          for (let i = 0; i < nPrev; i++) nd[i] *= 1 - aPrevAct[i] * aPrevAct[i]; // tanh'
          delta = nd;
        }
      }
    }

    // Adam update.
    const invN = 1 / xs.length;
    this.t++;
    const b1 = 0.9;
    const b2 = 0.999;
    const eps = 1e-8;
    const b1c = 1 - Math.pow(b1, this.t);
    const b2c = 1 - Math.pow(b2, this.t);
    for (let l = 0; l < L; l++) {
      for (let j = 0; j < this.W[l].length; j++) {
        for (let i = 0; i < this.W[l][j].length; i++) {
          const g = gW[l][j][i] * invN;
          this.mW[l][j][i] = b1 * this.mW[l][j][i] + (1 - b1) * g;
          this.vW[l][j][i] = b2 * this.vW[l][j][i] + (1 - b2) * g * g;
          const mh = this.mW[l][j][i] / b1c;
          const vh = this.vW[l][j][i] / b2c;
          this.W[l][j][i] -= (lr * mh) / (Math.sqrt(vh) + eps);
        }
        const g = gb[l][j] * invN;
        this.mb[l][j] = b1 * this.mb[l][j] + (1 - b1) * g;
        this.vb[l][j] = b2 * this.vb[l][j] + (1 - b2) * g * g;
        const mh = this.mb[l][j] / b1c;
        const vh = this.vb[l][j] / b2c;
        this.b[l][j] -= (lr * mh) / (Math.sqrt(vh) + eps);
      }
    }
    return loss * invN;
  }

  toJSON(): MLPState {
    return { sizes: this.sizes, W: this.W, b: this.b };
  }

  static fromJSON(s: MLPState): MLP {
    const net = new MLP(s.sizes);
    net.W = s.W.map((Wl) => Wl.map((r) => r.slice()));
    net.b = s.b.map((bl) => bl.slice());
    return net;
  }

  /** Flat weight vector (for neuroevolution). */
  flat(): number[] {
    const out: number[] = [];
    for (let l = 0; l < this.W.length; l++) {
      for (let j = 0; j < this.W[l].length; j++) {
        for (let i = 0; i < this.W[l][j].length; i++) out.push(this.W[l][j][i]);
        out.push(this.b[l][j]);
      }
    }
    return out;
  }

  setFlat(v: number[]): void {
    let k = 0;
    for (let l = 0; l < this.W.length; l++) {
      for (let j = 0; j < this.W[l].length; j++) {
        for (let i = 0; i < this.W[l][j].length; i++) this.W[l][j][i] = v[k++];
        this.b[l][j] = v[k++];
      }
    }
  }
}
