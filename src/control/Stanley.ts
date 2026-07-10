// Stanley controller — the path tracker from Stanford's DARPA Grand Challenge
// winner. Unlike Pure Pursuit (which chord-cuts and leaves a steady cross-track
// error on sustained curves), Stanley drives BOTH errors to zero:
//
//     δ = ψ_e + atan( k · e / (v + k_soft) )
//
//   ψ_e = heading error between the reference path and the vehicle (feed-forward:
//         makes the car turn WITH the curve, so it never understeers wide)
//   e   = cross-track error at the front axle from the reference line (feedback:
//         pulls the car back onto the lane centre)
//
// It is fed reference-frame quantities (computed in the road's Frenet frame),
// NOT the ego-originating planned trajectory — the plan passes through the car,
// so its cross-track error is ~0 and would give no correction.

import { clamp } from "../core/math.ts";

export interface StanleyConfig {
  k: number; // cross-track gain
  kSoft: number; // softening term so low speed doesn't blow up the gain
  maxSteer: number;
}

/**
 * @param headingErr  wrapAngle(referenceHeading - vehicleYaw)   [rad]
 * @param crossTrack  signed front-axle offset from the reference line;
 *                    POSITIVE when the vehicle is to the LEFT of the line  [m]
 * @param v           forward speed [m/s]
 */
export function stanleyControl(
  headingErr: number,
  crossTrack: number,
  v: number,
  cfg: StanleyConfig,
): number {
  // Left of the line (crossTrack > 0) → steer right (negative δ), and vice-versa.
  const crossSteer = Math.atan2(-cfg.k * crossTrack, v + cfg.kSoft);
  return clamp(headingErr + crossSteer, -cfg.maxSteer, cfg.maxSteer);
}
