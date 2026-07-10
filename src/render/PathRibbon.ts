// PathRibbon — the signature "blue line". Renders the planner's chosen
// trajectory as a smooth glowing ribbon on the road. Following the Tesla FSD
// convention, brightness encodes intent: bright electric blue where the car
// intends to carry speed, fading toward deep blue where it plans to slow.

import * as THREE from "three";
import { Trajectory } from "../planner/Trajectory.ts";
import { THEME } from "./theme.ts";
import { clamp } from "../core/math.ts";

const HALF_WIDTH = 0.7;
const HEIGHT = 0.07;

export class PathRibbon {
  readonly mesh: THREE.Mesh;
  private geo = new THREE.BufferGeometry();

  constructor() {
    const mat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.92,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(this.geo, mat);
    this.mesh.renderOrder = 5;
  }

  update(plan: Trajectory | null, desiredSpeed: number): void {
    const pts = plan?.points ?? [];
    if (pts.length < 2) {
      this.mesh.visible = false;
      return;
    }
    this.mesh.visible = true;

    const positions: number[] = [];
    const colors: number[] = [];
    const bright = new THREE.Color(THEME.pathBlue).multiplyScalar(1.6);
    const faint = new THREE.Color(THEME.pathBlueFaint);

    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const prev = pts[Math.max(0, i - 1)];
      const next = pts[Math.min(pts.length - 1, i + 1)];
      let dx = next.x - prev.x;
      let dy = next.y - prev.y;
      const len = Math.hypot(dx, dy) || 1;
      dx /= len;
      dy /= len;
      // Left/right offsets perpendicular to travel direction.
      const px = -dy * HALF_WIDTH;
      const py = dx * HALF_WIDTH;
      positions.push(p.x + px, HEIGHT, p.y + py);
      positions.push(p.x - px, HEIGHT, p.y - py);

      const speedFrac = clamp(p.v / Math.max(desiredSpeed, 1), 0, 1);
      const c = faint.clone().lerp(bright, 0.25 + 0.75 * speedFrac);
      colors.push(c.r, c.g, c.b, c.r, c.g, c.b);
    }

    const indices: number[] = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }

    this.geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    this.geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    this.geo.setIndex(indices);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
    this.geo.setDrawRange(0, indices.length);
    this.geo.computeBoundingSphere();
  }
}
