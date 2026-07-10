// Road — lane structure layered on top of a ReferencePath.
//
// Lanes are indexed 0..numLanes-1 from RIGHT to LEFT. Each lane has a constant
// lateral offset (d) from the centerline, so "drive in lane i" == "hold
// d = laneCenter(i)". This is what makes lane keeping and lane changes trivial
// to express for both the ego planner and the traffic model.

import { ReferencePath } from "./ReferencePath.ts";

export class Road {
  readonly path: ReferencePath;
  readonly numLanes: number;
  readonly laneWidth: number;

  constructor(path: ReferencePath, numLanes = 3, laneWidth = 3.7) {
    this.path = path;
    this.numLanes = numLanes;
    this.laneWidth = laneWidth;
  }

  get totalWidth(): number {
    return this.numLanes * this.laneWidth;
  }

  /** Signed lateral offset (d) of the centre of lane `i`. Right lanes are -d. */
  laneCenter(i: number): number {
    return (i - (this.numLanes - 1) / 2) * this.laneWidth;
  }

  /** Which lane index a given lateral offset falls into (clamped to the road). */
  laneOf(d: number): number {
    const raw = Math.round(d / this.laneWidth + (this.numLanes - 1) / 2);
    return Math.max(0, Math.min(this.numLanes - 1, raw));
  }

  /** d of the left/right paint edge of the drivable surface. */
  get leftEdge(): number {
    return this.totalWidth / 2;
  }
  get rightEdge(): number {
    return -this.totalWidth / 2;
  }
}
