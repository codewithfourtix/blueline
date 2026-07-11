// BehaviorPlanner — the high-level decision layer, a finite state machine.
// Real AV stacks separate "what manoeuvre" (behaviour) from "what exact path"
// (motion planning). This FSM inspects the tracked obstacles in the Frenet frame
// and picks a manoeuvre AND an explicit desired lane (one lane step at a time):
//
//   CRUISE     — open road: aim for target speed, and keep right when clear.
//   FOLLOW     — slower lead, no room to pass: adaptive-cruise behind it.
//   OVERTAKE   — slower lead and an adjacent lane is clear: move over ONE lane
//                to pass (prefer the left).
//   EMERGENCY  — imminent collision with no escape: stop.
//
// It hands the motion planner a `biasLane` so lane changes are deliberate and
// single-step — never a random multi-lane swerve.

import { Road } from "../world/Road.ts";
import { Obstacle } from "../planner/Trajectory.ts";
import { wrapDiff, clamp, mod } from "../core/math.ts";

export type BehaviorState = "CRUISE" | "FOLLOW" | "OVERTAKE" | "EMERGENCY" | "YIELD" | "STOP";

export interface EgoState {
  s: number;
  d: number;
  v: number;
  lane: number;
}

export interface Decision {
  state: BehaviorState;
  targetSpeed: number;
  biasLane: number; // the lane the motion planner should aim for
}

const EGO_HALF_LEN = 2.35;

export class BehaviorPlanner {
  constructor(private road: Road) {}

  decide(ego: EgoState, obstacles: Obstacle[], baseSpeed: number): Decision {
    const L = this.road.path.length;
    const laneHalf = this.road.laneWidth * 0.6;

    // ---- Pedestrians first: yield to any that are (or will be) in our path. --
    const yieldSpeed = this.pedestrianYield(ego, obstacles, L, laneHalf);
    if (yieldSpeed < baseSpeed) {
      return { state: "YIELD", targetSpeed: Math.max(0, yieldSpeed), biasLane: ego.lane };
    }

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

    const leftClear = ego.lane + 1 < this.road.numLanes && this.laneClear(ego, obstacles, ego.lane + 1, L);
    const rightClear = ego.lane - 1 >= 0 && this.laneClear(ego, obstacles, ego.lane - 1, L);

    // Open road: cruise and hold the lane (no cosmetic lane changes).
    if (!lead) {
      return { state: "CRUISE", targetSpeed: baseSpeed, biasLane: ego.lane };
    }

    const gap = Math.max(lead.gap, 0);
    const closing = ego.v - lead.v;
    const ttc = closing > 0.1 ? gap / closing : Infinity;

    const leadIsSlow = lead.v < baseSpeed - 2.0;
    // Distance at which a slower lead becomes "our problem" (grows with speed).
    const withinFollow = gap < Math.max(45, ego.v * 1.9);

    // 1) Slower lead + an open lane → move over ONE lane to pass (prefer left).
    if (leadIsSlow && withinFollow) {
      if (leftClear) return { state: "OVERTAKE", targetSpeed: baseSpeed, biasLane: ego.lane + 1 };
      if (rightClear) return { state: "OVERTAKE", targetSpeed: baseSpeed, biasLane: ego.lane - 1 };
    }

    // 2) Boxed in and dangerously close → stop.
    if (gap < 5 || ttc < 1.8) {
      return { state: "EMERGENCY", targetSpeed: 0, biasLane: ego.lane };
    }

    // 3) Slower lead, no room to pass → adaptive-cruise follow.
    if (leadIsSlow && withinFollow) {
      return { state: "FOLLOW", targetSpeed: this.accSpeed(gap, lead.v, ego.v, baseSpeed), biasLane: ego.lane };
    }

    // 4) Lead present but fast/far — cruise (don't tailgate), hold the lane.
    const target = withinFollow ? Math.min(baseSpeed, this.accSpeed(gap, lead.v, ego.v, baseSpeed)) : baseSpeed;
    return { state: "CRUISE", targetSpeed: target, biasLane: ego.lane };
  }

  /**
   * Speed the ego should slow to for pedestrians ahead — Infinity if none are a
   * concern. Predicts each pedestrian's crossing so the ego stops in time, and
   * is cautious about any pedestrian on the road surface ahead.
   */
  private pedestrianYield(ego: EgoState, obstacles: Obstacle[], L: number, laneHalf: number): number {
    const roadHalf = this.road.totalWidth / 2;
    // Lower value = target speed drops sooner = the ego starts braking earlier
    // (the actual stop uses the vehicle's real max decel to catch the profile).
    const brake = 3.0;
    let best = Infinity;
    for (const o of obstacles) {
      if (o.kind !== "ped") continue;
      const fwd = mod(o.s - ego.s, L);
      if (fwd <= 0 || fwd > 80) continue;

      const tReach = ego.v > 0.5 ? fwd / ego.v : 3;
      const predD = o.d + o.vd * tReach;
      const inLaneNow = Math.abs(o.d - ego.d) < laneHalf + 1.0;
      const inLaneSoon = Math.abs(predD - ego.d) < laneHalf + 1.0;
      const onRoadAhead = Math.abs(o.d) < roadHalf + 1.5 && fwd < 40;

      if (inLaneNow || inLaneSoon || onRoadAhead) {
        const stopDist = Math.max(fwd - 12, 0); // aim to stop ~12 m short of the ped
        best = Math.min(best, Math.sqrt(2 * brake * stopDist));
      }
    }
    return best;
  }

  /** Is `lane` free of obstacles in a window around the ego (behind → ahead)? */
  private laneClear(ego: EgoState, obstacles: Obstacle[], lane: number, L: number): boolean {
    const dT = this.road.laneCenter(lane);
    const laneHalf = this.road.laneWidth * 0.6;
    for (const o of obstacles) {
      if (Math.abs(o.d - dT) > laneHalf) continue;
      const ds = wrapDiff(o.s, ego.s, L);
      if (ds > -14 && ds < 40) return false; // alongside or just ahead/behind
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
