// Pure Pursuit — a geometric path-tracking controller widely used in real
// self-driving stacks for its simplicity and stability.
//
// Idea: pick a "look-ahead" point on the reference path a distance Ld in front
// of the rear axle, then compute the steering angle of the circular arc that
// connects the rear axle to that point:
//
//     delta = atan2( 2 * L * sin(alpha), Ld )
//
// where L is the wheelbase and alpha is the angle between the vehicle heading
// and the line to the look-ahead point. Ld scales with speed so the car looks
// further ahead when moving faster (smoother at speed, tighter when slow).

import { clamp, wrapAngle } from "../core/math.ts";

export interface PathPoint {
  x: number;
  y: number;
}

export interface PurePursuitConfig {
  wheelbase: number;
  gain: number; // look-ahead gain k in Ld = k*v + minLookahead
  minLookahead: number;
  maxLookahead: number;
  maxSteer: number;
}

export function purePursuitSteer(
  x: number,
  y: number,
  yaw: number,
  v: number,
  path: PathPoint[],
  cfg: PurePursuitConfig,
): number {
  if (path.length < 2) return 0;

  const Ld = clamp(cfg.gain * v + cfg.minLookahead, cfg.minLookahead, cfg.maxLookahead);

  // The rear axle is the reference point for the bicycle model.
  const rearX = x - (cfg.wheelbase / 2) * Math.cos(yaw);
  const rearY = y - (cfg.wheelbase / 2) * Math.sin(yaw);

  // Find the first path point at least Ld away from the rear axle. Because the
  // planned path starts at the vehicle, walking forward gives a stable target.
  let target = path[path.length - 1];
  for (let i = 0; i < path.length; i++) {
    const dx = path[i].x - rearX;
    const dy = path[i].y - rearY;
    if (Math.hypot(dx, dy) >= Ld) {
      target = path[i];
      break;
    }
  }

  const alpha = wrapAngle(Math.atan2(target.y - rearY, target.x - rearX) - yaw);
  const ld = Math.max(Math.hypot(target.x - rearX, target.y - rearY), 1e-3);
  const delta = Math.atan2(2 * cfg.wheelbase * Math.sin(alpha), ld);
  return clamp(delta, -cfg.maxSteer, cfg.maxSteer);
}
