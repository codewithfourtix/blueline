// Tracker — a multi-object tracker built on constant-velocity Kalman filters.
//
// This is the bridge from raw perception to prediction: noisy, unlabelled
// detections come in each frame; the tracker associates them to persistent
// tracks (nearest-neighbour gating), runs a Kalman filter per track to smooth
// position AND estimate velocity, coasts through brief occlusions, and only
// promotes a track to "confirmed" after a few consistent hits. The planner then
// predicts each confirmed track forward using its estimated velocity.

import { Mat, Vec, add, identity, inv2, mul, mulVec, sub, transpose } from "../core/mat.ts";
import { Detection } from "./Sensor.ts";

const H: Mat = [
  [1, 0, 0, 0],
  [0, 1, 0, 0],
];
const HT = transpose(H);

export class Track {
  id: number;
  x: Vec; // [px, py, vx, vy]
  P: Mat;
  hits = 1;
  misses = 0;
  age = 0;
  confirmed = false;
  length: number;
  width: number;

  private sigmaA = 3.0; // process (acceleration) noise
  private measVar: number;

  constructor(id: number, det: Detection, measNoise: number) {
    this.id = id;
    this.x = [det.x, det.y, 0, 0];
    this.P = [
      [1, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 25, 0],
      [0, 0, 0, 25],
    ];
    this.length = det.length;
    this.width = det.width;
    this.measVar = measNoise * measNoise;
  }

  predict(dt: number): void {
    const F: Mat = [
      [1, 0, dt, 0],
      [0, 1, 0, dt],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
    ];
    this.x = mulVec(F, this.x);
    const q = this.sigmaA * this.sigmaA;
    const dt2 = dt * dt;
    const dt3 = dt2 * dt;
    const dt4 = dt3 * dt;
    const Q: Mat = [
      [(dt4 / 4) * q, 0, (dt3 / 2) * q, 0],
      [0, (dt4 / 4) * q, 0, (dt3 / 2) * q],
      [(dt3 / 2) * q, 0, dt2 * q, 0],
      [0, (dt3 / 2) * q, 0, dt2 * q],
    ];
    this.P = add(mul(mul(F, this.P), transpose(F)), Q);
    this.age++;
  }

  update(det: Detection): void {
    const z: Vec = [det.x, det.y];
    const Hx = mulVec(H, this.x);
    const y = [z[0] - Hx[0], z[1] - Hx[1]];
    // S = H P Hᵀ + R
    const S = mul(mul(H, this.P), HT);
    S[0][0] += this.measVar;
    S[1][1] += this.measVar;
    const K = mul(mul(this.P, HT), inv2(S)); // 4×2 Kalman gain
    // x = x + K y
    const Ky = mulVec(K, y);
    this.x = this.x.map((v, i) => v + Ky[i]);
    // P = (I − K H) P
    const KH = mul(K, H);
    this.P = mul(sub(identity(4), KH), this.P);

    // Smooth the reported extent a touch.
    this.length += (det.length - this.length) * 0.3;
    this.width += (det.width - this.width) * 0.3;
    this.hits++;
    this.misses = 0;
  }

  get px(): number { return this.x[0]; }
  get py(): number { return this.x[1]; }
  get vx(): number { return this.x[2]; }
  get vy(): number { return this.x[3]; }
  get speed(): number { return Math.hypot(this.x[2], this.x[3]); }
}

export interface TrackerConfig {
  gate: number; // max association distance (m)
  confirmHits: number; // hits before a track is "confirmed"
  maxMisses: number; // consecutive misses before deletion
  measNoise: number; // measurement std-dev (should match sensor)
}

export const DEFAULT_TRACKER: TrackerConfig = {
  gate: 5.0,
  confirmHits: 3,
  maxMisses: 10,
  measNoise: 0.35,
};

export class Tracker {
  tracks: Track[] = [];
  config: TrackerConfig;
  private nextId = 1;

  constructor(config: Partial<TrackerConfig> = {}) {
    this.config = { ...DEFAULT_TRACKER, ...config };
  }

  update(detections: Detection[], dt: number): Track[] {
    const cfg = this.config;

    // 1. Predict every existing track forward.
    for (const t of this.tracks) t.predict(dt);

    // 2. Greedy nearest-neighbour association within the gate.
    const pairs: { ti: number; di: number; dist: number }[] = [];
    for (let ti = 0; ti < this.tracks.length; ti++) {
      for (let di = 0; di < detections.length; di++) {
        const dx = this.tracks[ti].px - detections[di].x;
        const dy = this.tracks[ti].py - detections[di].y;
        const dist = Math.hypot(dx, dy);
        if (dist <= cfg.gate) pairs.push({ ti, di, dist });
      }
    }
    pairs.sort((a, b) => a.dist - b.dist);

    const trackUsed = new Array(this.tracks.length).fill(false);
    const detUsed = new Array(detections.length).fill(false);
    for (const p of pairs) {
      if (trackUsed[p.ti] || detUsed[p.di]) continue;
      trackUsed[p.ti] = true;
      detUsed[p.di] = true;
      const t = this.tracks[p.ti];
      t.update(detections[p.di]);
      if (!t.confirmed && t.hits >= cfg.confirmHits) t.confirmed = true;
    }

    // 3. Unmatched tracks coast; delete the stale ones.
    for (let ti = 0; ti < this.tracks.length; ti++) {
      if (!trackUsed[ti]) this.tracks[ti].misses++;
    }
    this.tracks = this.tracks.filter((t) => t.misses <= cfg.maxMisses);

    // 4. Unmatched detections spawn new tentative tracks.
    for (let di = 0; di < detections.length; di++) {
      if (!detUsed[di]) this.tracks.push(new Track(this.nextId++, detections[di], cfg.measNoise));
    }

    return this.confirmed();
  }

  confirmed(): Track[] {
    return this.tracks.filter((t) => t.confirmed);
  }

  reset(): void {
    this.tracks = [];
    this.nextId = 1;
  }
}
