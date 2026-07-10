// BehaviorPlanner — the high-level decision layer, implemented as a finite state
// machine. Real AV stacks separate "what manoeuvre should I do" (behaviour) from
// "what exact path realises it" (motion planning). This FSM inspects the tracked
// obstacles in the ego's Frenet frame and picks one of:
//
//   CRUISE     — open road: aim for the target cruising speed.
//   FOLLOW     — a slower lead is ahead and lanes are blocked: adaptive cruise,
//                match a safe speed for the current gap.
//   OVERTAKE   — a slower lead is ahead and an adjacent lane is clear: keep the
//                target speed and make lane changes cheap so the motion planner
//                pulls out and passes.
//   EMERGENCY  — imminent collision (tiny gap / low time-to-collision): stop.
//
// Its output modulates the FrenetPlanner (target speed + lane-change cost), so
// the two layers stay cleanly separated but cooperate.

import { Road } from "../world/Road.ts";
import { Obstacle } from "../planner/Trajectory.ts";
import { wrapDiff, clamp } from "../core/math.ts";

export type BehaviorState = "CRUISE" | "FOLLOW" | "OVERTAKE" | "EMERGENCY";

export interface EgoState {
  s: number;
  d: number;
  v: number;
  lane: number;
}

export interface Decision {
  state: BehaviorState;
  targetSpeed: number;
  kLaneChange: number; // lane-change cost handed to the motion planner
}

const EGO_HALF_LEN = 2.35;

export class BehaviorPlanner {
  constructor(private road: Road) {}

  decide(ego: EgoState, obstacles: Obstacle[], baseSpeed: number): Decision {
    const L = this.road.path.length;
    const laneHalf = this.road.laneWidth * 0.6;

    // Nearest lead in the ego's own lane.
    let lead: { gap: number; v: number } | null = null;
    let bestFwd = Infinity;
    for (const o of obstacles) {
      if (Math.abs(o.d - ego.d) > laneHalf) continue;
      const fwd = ((o.s - ego.s) % L + L) % L;
      if (fwd > 0 && fwd < bestFwd) {
        bestFwd = fwd;
        lead = { gap: fwd - (EGO_HALF_LEN + o.length / 2), v: o.v };
      }
    }

    if (!lead) {
      return { state: "CRUISE", targetSpeed: baseSpeed, kLaneChange: 6 };
    }

    const gap = Math.max(lead.gap, 0);
    const closing = ego.v - lead.v;
    const ttc = closing > 0.1 ? gap / closing : Infinity;

    // Emergency: tiny gap or very low time-to-collision.
    if (gap < 5 || ttc < 1.6) {
      return { state: "EMERGENCY", targetSpeed: 0, kLaneChange: 30 };
    }

    const leadIsSlow = lead.v < baseSpeed - 1.0;
    const withinFollow = gap < 48;

    if (leadIsSlow && withinFollow) {
      // Prefer to overtake if an adjacent lane is clear (left first, then right).
      const left = ego.lane + 1;
      const right = ego.lane - 1;
      if (left < this.road.numLanes && this.laneClear(ego, obstacles, left, L)) {
        return { state: "OVERTAKE", targetSpeed: baseSpeed, kLaneChange: 2.5 };
      }
      if (right >= 0 && this.laneClear(ego, obstacles, right, L)) {
        return { state: "OVERTAKE", targetSpeed: baseSpeed, kLaneChange: 2.5 };
      }
      // Otherwise settle into adaptive-cruise following.
      return { state: "FOLLOW", targetSpeed: this.accSpeed(gap, lead.v, ego.v, baseSpeed), kLaneChange: 10 };
    }

    // Lead present but fast/far enough — cruise, but don't tailgate.
    const target = withinFollow ? Math.min(baseSpeed, this.accSpeed(gap, lead.v, ego.v, baseSpeed)) : baseSpeed;
    return { state: "CRUISE", targetSpeed: target, kLaneChange: 6 };
  }

  /** Is `lane` free of obstacles in a window around the ego? */
  private laneClear(ego: EgoState, obstacles: Obstacle[], lane: number, L: number): boolean {
    const dT = this.road.laneCenter(lane);
    const laneHalf = this.road.laneWidth * 0.6;
    for (const o of obstacles) {
      if (Math.abs(o.d - dT) > laneHalf) continue;
      const ds = wrapDiff(o.s, ego.s, L);
      if (ds > -10 && ds < 32) return false; // something alongside or just ahead
    }
    return true;
  }

  /** Adaptive-cruise target speed for a given gap to a lead. */
  private accSpeed(gap: number, leadV: number, egoV: number, baseSpeed: number): number {
    const desiredGap = 6 + 1.2 * egoV;
    const target = leadV + (gap - desiredGap) * 0.4;
    return clamp(target, 0, baseSpeed);
  }
}
