// OccupancyGrid — an ego-centred grid that marks which cells are occupied by
// tracked objects (inflated by the ego's footprint). This is a lightweight nod
// to the "occupancy network" idea popularised by Tesla: a unified, obstacle-
// agnostic representation of free vs. blocked space around the car. Here it is
// primarily a visualisation, built from the Kalman tracks.

import { Track } from "./Tracker.ts";

export class OccupancyGrid {
  readonly cols: number;
  readonly rows: number;
  readonly cell: number;
  readonly halfExtent: number;
  occupied: Uint8Array;
  originX = 0;
  originY = 0;

  constructor(extent = 50, cell = 2) {
    this.cell = cell;
    this.halfExtent = extent;
    this.cols = Math.ceil((extent * 2) / cell);
    this.rows = this.cols;
    this.occupied = new Uint8Array(this.cols * this.rows);
  }

  /** Rebuild the grid centred on the ego from the current tracks. */
  build(egoX: number, egoY: number, tracks: Track[]): void {
    this.occupied.fill(0);
    this.originX = egoX - this.halfExtent;
    this.originY = egoY - this.halfExtent;

    for (const t of tracks) {
      const half = Math.max(t.length, t.width) / 2 + 1.0; // inflate a little
      const minX = t.px - half;
      const maxX = t.px + half;
      const minY = t.py - half;
      const maxY = t.py + half;
      const ci0 = Math.floor((minX - this.originX) / this.cell);
      const ci1 = Math.floor((maxX - this.originX) / this.cell);
      const ri0 = Math.floor((minY - this.originY) / this.cell);
      const ri1 = Math.floor((maxY - this.originY) / this.cell);
      for (let r = ri0; r <= ri1; r++) {
        for (let c = ci0; c <= ci1; c++) {
          if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) continue;
          this.occupied[r * this.cols + c] = 1;
        }
      }
    }
  }

  /** World-space centre of a cell. */
  cellCenter(c: number, r: number): [number, number] {
    return [this.originX + (c + 0.5) * this.cell, this.originY + (r + 0.5) * this.cell];
  }

  countOccupied(): number {
    let n = 0;
    for (let i = 0; i < this.occupied.length; i++) n += this.occupied[i];
    return n;
  }
}
