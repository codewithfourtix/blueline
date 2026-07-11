// PedestrianManager — vulnerable road users (pedestrians) that cross the road.
//
// A pedestrian is anchored at a crossing station `s` and walks laterally across
// the road: its lateral offset `d` sweeps from one sidewalk to the other. This
// is what turns the sim from "highway cruise" into genuine hard-case territory:
// the ego must perceive a small, slow, laterally-moving object and yield/stop —
// including when it emerges late from behind a parked car, or darts out.

import { Road } from "../world/Road.ts";
import { mod } from "../core/math.ts";

export type PedState = "waiting" | "crossing" | "done";

export interface Pedestrian {
  id: number;
  s: number; // station of the crossing
  d: number; // current lateral offset (sweeps across the road)
  fromD: number;
  toD: number;
  speed: number; // m/s
  state: PedState;
  waitTimer: number; // seconds until it starts crossing (if no ego trigger)
  triggerDist: number; // if > 0, start crossing when the ego is within this many m
  radius: number;
}

export class PedestrianManager {
  peds: Pedestrian[] = [];
  private nextId = 1;

  constructor(private road: Road) {}

  clear(): void {
    this.peds = [];
    this.nextId = 1;
  }

  get count(): number {
    return this.peds.length;
  }

  add(opts: {
    s: number;
    fromD: number;
    toD: number;
    speed?: number;
    wait?: number;
    triggerDist?: number;
  }): Pedestrian {
    const ped: Pedestrian = {
      id: this.nextId++,
      s: opts.s,
      d: opts.fromD,
      fromD: opts.fromD,
      toD: opts.toD,
      speed: opts.speed ?? 1.4,
      state: "waiting",
      waitTimer: opts.wait ?? 0,
      triggerDist: opts.triggerDist ?? 0,
      radius: 0.4,
    };
    this.peds.push(ped);
    return ped;
  }

  /** Advance all pedestrians. `egoS` lets ego-triggered (jaywalker) crossings fire. */
  update(dt: number, egoS: number, L: number): void {
    for (const p of this.peds) {
      if (p.state === "waiting") {
        const egoAhead = mod(p.s - egoS, L); // how far the ego is behind the ped
        const triggered = p.triggerDist > 0 && egoAhead < p.triggerDist && egoAhead > 2;
        p.waitTimer -= dt;
        if (triggered || (p.triggerDist === 0 && p.waitTimer <= 0)) {
          p.state = "crossing";
        }
        continue;
      }
      if (p.state === "crossing") {
        const dir = Math.sign(p.toD - p.fromD) || 1;
        p.d += dir * p.speed * dt;
        if ((dir > 0 && p.d >= p.toD) || (dir < 0 && p.d <= p.toD)) {
          p.d = p.toD;
          p.state = "done";
        }
      }
    }
  }

  /** Lateral velocity (d/dt of d) — used by the planner to predict the crossing. */
  lateralVel(p: Pedestrian): number {
    if (p.state !== "crossing") return 0;
    return Math.sign(p.toD - p.fromD) * p.speed;
  }
}
