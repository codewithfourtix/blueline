// MOBIL — "Minimizing Overall Braking Induced by Lane changes" (Kesting,
// Treiber & Helbing, 2007). The companion lane-change model to IDM.
//
// A car considers changing lanes when doing so improves its own acceleration,
// subject to two conditions:
//
//   1. SAFETY   — the new follower isn't forced to brake harder than b_safe.
//   2. INCENTIVE — the ego's acceleration gain, plus a "politeness" weighted
//                  sum of the gain/loss it imposes on the old and new followers,
//                  exceeds a switching threshold (with a small bias to keep
//                  right / discourage pointless weaving).
//
// The gains are all evaluated with the IDM, so MOBIL and IDM share one notion
// of "how good is this situation".

import { idmAcceleration, IDMParams } from "./IDM.ts";

export interface MobilParams {
  politeness: number; // p — how much a car cares about others' braking (0..1)
  threshold: number; // Δa_th — minimum net gain to bother changing (m/s²)
  bSafe: number; // maximum decel we may impose on the new follower (m/s²)
  bias: number; // small asymmetric bias per lane index
}

export const DEFAULT_MOBIL: MobilParams = {
  politeness: 0.2,
  threshold: 0.2,
  bSafe: 4.0,
  bias: 0.1,
};

// A neighbouring vehicle relative to the subject. `dv` is that neighbour's
// approach rate toward the vehicle IT follows (positive = closing in):
//   - for a LEAD neighbour:     dv = subject.v - lead.v
//   - for a FOLLOWER neighbour: dv = follower.v - subject.v
export interface Neighbor {
  v: number;
  gap: number; // bumper-to-bumper gap along the road
  dv: number;
}

const BIG_GAP = 1000;

/**
 * Decide whether the subject should change into a target lane.
 */
export function mobilShouldChange(
  subjectV: number,
  curLead: Neighbor | null,
  curFollower: Neighbor | null,
  newLead: Neighbor | null,
  newFollower: Neighbor | null,
  idm: IDMParams,
  mob: MobilParams,
  laneBias = 0,
): boolean {
  // Subject acceleration now vs. after the change.
  const aOld = idmAcceleration(subjectV, curLead?.gap ?? BIG_GAP, curLead?.dv ?? 0, idm);
  const aNew = idmAcceleration(subjectV, newLead?.gap ?? BIG_GAP, newLead?.dv ?? 0, idm);

  // The new follower will have the subject as its lead once we move over.
  const newFollowerAfter = newFollower
    ? idmAcceleration(newFollower.v, newFollower.gap, newFollower.dv, idm)
    : 0;

  // SAFETY GATE: never cut someone off hard.
  if (newFollower && newFollowerAfter < -mob.bSafe) return false;

  // INCENTIVE: self gain + politeness * (impact on the two affected followers).
  const newFollowerBefore = newFollower ? idmAcceleration(newFollower.v, BIG_GAP, 0, idm) : 0;
  const oldFollowerBefore = curFollower
    ? idmAcceleration(curFollower.v, curFollower.gap, curFollower.dv, idm)
    : 0;
  const oldFollowerAfter = curFollower ? idmAcceleration(curFollower.v, BIG_GAP, 0, idm) : 0;

  const selfGain = aNew - aOld;
  const othersImpact =
    (newFollowerAfter - newFollowerBefore) + (oldFollowerAfter - oldFollowerBefore);

  const incentive = selfGain + mob.politeness * othersImpact + laneBias;
  return incentive > mob.threshold;
}
