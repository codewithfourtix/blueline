// Metrics — a live driving scorecard. It accumulates the signals a real AV team
// cares about and turns them into 0–100 scores:
//
//   SAFETY     — collisions, time spent off the road, closest gap to traffic
//   COMFORT    — how gentle the driving is (mean |acceleration| and |jerk|)
//   EFFICIENCY — how well it maintains progress toward the target speed
//
// These make the three drivers (classical / imitation / evolved) directly
// comparable — the difference between "it moves" and "it drives well".

import { clamp } from "../core/math.ts";

export interface MetricSample {
  v: number;
  accel: number;
  steerRate: number;
  offRoad: boolean;
  gap: number; // nearest lead gap (m), Infinity if none
  collided: boolean;
  desiredSpeed: number;
  dt: number;
}

export interface Scores {
  safety: number;
  comfort: number;
  efficiency: number;
  overall: number;
}

export class Metrics {
  time = 0;
  distance = 0;
  collisions = 0;
  private collidingPrev = false;
  offRoadTime = 0;
  minGap = Infinity;
  private sumAbsAccel = 0;
  private maxAbsAccel = 0;
  private sumAbsJerk = 0;
  private sumSpeed = 0;
  private sumDesired = 0;
  private samples = 0;
  private prevAccel = 0;

  reset(): void {
    this.time = 0;
    this.distance = 0;
    this.collisions = 0;
    this.collidingPrev = false;
    this.offRoadTime = 0;
    this.minGap = Infinity;
    this.sumAbsAccel = 0;
    this.maxAbsAccel = 0;
    this.sumAbsJerk = 0;
    this.sumSpeed = 0;
    this.sumDesired = 0;
    this.samples = 0;
    this.prevAccel = 0;
  }

  update(s: MetricSample): void {
    this.time += s.dt;
    this.distance += s.v * s.dt;
    this.samples++;
    this.sumSpeed += s.v;
    this.sumDesired += s.desiredSpeed;

    const a = Math.abs(s.accel);
    this.sumAbsAccel += a;
    this.maxAbsAccel = Math.max(this.maxAbsAccel, a);
    this.sumAbsJerk += Math.abs((s.accel - this.prevAccel) / Math.max(s.dt, 1e-3));
    this.prevAccel = s.accel;

    if (s.offRoad) this.offRoadTime += s.dt;
    if (Number.isFinite(s.gap)) this.minGap = Math.min(this.minGap, s.gap);
    // Count a collision as one event (rising edge), not every overlapping frame.
    if (s.collided && !this.collidingPrev) this.collisions++;
    this.collidingPrev = s.collided;
  }

  get meanSpeed(): number {
    return this.samples ? this.sumSpeed / this.samples : 0;
  }
  get meanAccel(): number {
    return this.samples ? this.sumAbsAccel / this.samples : 0;
  }
  get meanJerk(): number {
    return this.samples ? this.sumAbsJerk / this.samples : 0;
  }

  scores(): Scores {
    const offRoadFrac = this.time > 0 ? this.offRoadTime / this.time : 0;
    const gapPenalty = Number.isFinite(this.minGap) && this.minGap < 6 ? (6 - this.minGap) * 5 : 0;
    const safety = clamp(100 - this.collisions * 30 - offRoadFrac * 120 - gapPenalty, 0, 100);

    const comfort = clamp(100 - this.meanAccel * 14 - this.meanJerk * 5, 0, 100);

    const targetRef = this.samples ? this.sumDesired / this.samples : 26;
    const efficiency = clamp((this.meanSpeed / Math.max(targetRef, 1)) * 100, 0, 100);

    const overall = 0.5 * safety + 0.25 * comfort + 0.25 * efficiency;
    return { safety, comfort, efficiency, overall };
  }
}
