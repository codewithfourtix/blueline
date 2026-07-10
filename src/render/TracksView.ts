// TracksView — draws the ego's *perception*: for every confirmed Kalman track,
// a footprint box oriented along its estimated velocity, plus a short arrow for
// that velocity vector. This is the "what the car thinks is around it" overlay —
// the on-screen proof that the ego is running on tracked estimates, not truth.

import * as THREE from "three";
import { Track } from "../perception/Tracker.ts";

const H = 0.16;

export class TracksView {
  readonly object: THREE.LineSegments;
  private geo = new THREE.BufferGeometry();

  constructor() {
    const mat = new THREE.LineBasicMaterial({
      color: 0x66d9ff,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    this.object = new THREE.LineSegments(this.geo, mat);
    this.object.renderOrder = 6;
  }

  update(tracks: Track[]): void {
    const pos: number[] = [];

    for (const t of tracks) {
      const speed = Math.hypot(t.vx, t.vy);
      const heading = speed > 1 ? Math.atan2(t.vy, t.vx) : 0;
      const cos = Math.cos(heading);
      const sin = Math.sin(heading);
      const hl = t.length / 2;
      const hw = t.width / 2;

      // Four corners of the oriented footprint (world map: x -> x, y -> z).
      const corner = (fx: number, fy: number): [number, number] => [
        t.px + fx * cos - fy * sin,
        t.py + fx * sin + fy * cos,
      ];
      const c1 = corner(hl, hw);
      const c2 = corner(hl, -hw);
      const c3 = corner(-hl, -hw);
      const c4 = corner(-hl, hw);
      const edge = (a: [number, number], b: [number, number]) => {
        pos.push(a[0], H, a[1], b[0], H, b[1]);
      };
      edge(c1, c2);
      edge(c2, c3);
      edge(c3, c4);
      edge(c4, c1);

      // Velocity arrow.
      if (speed > 1) {
        const len = Math.min(speed * 0.4, 12);
        const tipX = t.px + cos * (hl + len);
        const tipY = t.py + sin * (hl + len);
        pos.push(t.px, H, t.py, tipX, H, tipY);
        // Arrowhead.
        const ah = 0.7;
        pos.push(tipX, H, tipY, tipX - cos * ah - sin * ah, H, tipY - sin * ah + cos * ah);
        pos.push(tipX, H, tipY, tipX - cos * ah + sin * ah, H, tipY - sin * ah - cos * ah);
      }
    }

    this.geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    this.geo.computeBoundingSphere();
  }
}
