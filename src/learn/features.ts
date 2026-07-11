// Feature extraction — turns the driving situation into a fixed-length, roughly
// [-1,1]-normalised vector the neural network can learn from, and defines how the
// network's two outputs map to (steering, acceleration). Both the imitation and
// the evolved agents share this representation.

import { ObstacleKind } from "../planner/Trajectory.ts";
import { mod, clamp } from "../core/math.ts";

export const STEER_NORM = 0.6; // rad — network steer output is scaled by this
export const ACCEL_NORM = 7.0; // m/s² — network accel output is scaled by this
export const FEATURE_SIZE = 16;

export interface DriveObstacle {
  s: number;
  d: number;
  v: number;
  kind: ObstacleKind;
  length: number;
}

export interface DriveContext {
  v: number;
  d: number;
  headingErr: number;
  curvature: number; // signed
  laneIndex: number;
  numLanes: number;
  laneWidth: number;
  roadHalf: number;
  egoS: number;
  L: number;
  desiredSpeed: number;
  obstacles: DriveObstacle[];
}

function laneLead(ctx: DriveContext, laneCenterD: number): { gap: number; dv: number } {
  const laneHalf = ctx.laneWidth * 0.6;
  let bestFwd = Infinity;
  let leadV = ctx.v;
  for (const o of ctx.obstacles) {
    if (Math.abs(o.d - laneCenterD) > laneHalf) continue;
    const fwd = mod(o.s - ctx.egoS, ctx.L);
    if (fwd > 0 && fwd < bestFwd) {
      bestFwd = fwd;
      leadV = o.v;
    }
  }
  if (bestFwd === Infinity) return { gap: 80, dv: 0 };
  return { gap: clamp(bestFwd - 5, 0, 80), dv: ctx.v - leadV };
}

function laneCenter(ctx: DriveContext, i: number): number {
  return (i - (ctx.numLanes - 1) / 2) * ctx.laneWidth;
}

export function extractFeatures(ctx: DriveContext): number[] {
  const cur = laneLead(ctx, laneCenter(ctx, ctx.laneIndex));
  const leftExists = ctx.laneIndex + 1 < ctx.numLanes;
  const rightExists = ctx.laneIndex - 1 >= 0;
  const left = leftExists ? laneLead(ctx, laneCenter(ctx, ctx.laneIndex + 1)) : { gap: 0, dv: 0 };
  const right = rightExists ? laneLead(ctx, laneCenter(ctx, ctx.laneIndex - 1)) : { gap: 0, dv: 0 };

  // Nearest pedestrian ahead.
  let pedDist = 80;
  let pedInPath = 0;
  const laneHalf = ctx.laneWidth * 0.7;
  for (const o of ctx.obstacles) {
    if (o.kind !== "ped") continue;
    const fwd = mod(o.s - ctx.egoS, ctx.L);
    if (fwd > 0 && fwd < pedDist) {
      pedDist = fwd;
      pedInPath = Math.abs(o.d - ctx.d) < laneHalf + 1.5 ? 1 : 0;
    }
  }

  return [
    clamp(ctx.v / 30, 0, 1.5),
    clamp(ctx.d / ctx.roadHalf, -1.5, 1.5),
    clamp(ctx.headingErr / (Math.PI / 4), -1.5, 1.5),
    clamp(ctx.curvature * 60, -1.5, 1.5),
    ctx.numLanes > 1 ? ctx.laneIndex / (ctx.numLanes - 1) : 0,
    cur.gap / 80,
    clamp(cur.dv / 20, -1.5, 1.5),
    left.gap / 80,
    clamp(left.dv / 20, -1.5, 1.5),
    right.gap / 80,
    clamp(right.dv / 20, -1.5, 1.5),
    leftExists ? 1 : 0,
    rightExists ? 1 : 0,
    pedDist / 80,
    pedInPath,
    clamp(ctx.desiredSpeed / 30, 0, 1.5),
  ];
}
