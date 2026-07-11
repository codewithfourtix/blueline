// PathRibbon — the signature planned-path ribbon. Following the Tesla FSD look
// it is SHORT (only the immediate ~35 m of intent, not the full horizon) and
// TEMPORALLY SMOOTHED: the displayed points ease toward each new plan, so the
// ribbon glides when the planner switches lanes instead of snapping across the
// road. Brightness encodes intent (brighter where the car will carry speed).

import * as THREE from "three";
import { Trajectory } from "../planner/Trajectory.ts";
import { THEME } from "./theme.ts";
import { clamp } from "../core/math.ts";

const HALF_WIDTH = 0.65;
const HEIGHT = 0.08;
const N = 18; // display points
const SPACING = 2.0; // metres between them → ~36 m of path shown
const EASE = 0.35; // temporal smoothing per frame

interface P {
  x: number;
  y: number;
  v: number;
}

export class PathRibbon {
  readonly mesh: THREE.Mesh;
  private geo = new THREE.BufferGeometry();
  private smooth: P[] = [];

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

  /** Resample the plan to N points at fixed arc-length spacing. */
  private resample(pts: Trajectory["points"]): P[] {
    const out: P[] = [];
    // Cumulative arc length.
    const cum: number[] = [0];
    for (let i = 1; i < pts.length; i++) {
      cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
    }
    let seg = 0;
    for (let k = 0; k < N; k++) {
      const target = k * SPACING;
      while (seg < pts.length - 2 && cum[seg + 1] < target) seg++;
      const segLen = cum[seg + 1] - cum[seg] || 1;
      const t = clamp((target - cum[seg]) / segLen, 0, 1);
      const a = pts[seg];
      const b = pts[Math.min(seg + 1, pts.length - 1)];
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, v: a.v + (b.v - a.v) * t });
    }
    return out;
  }

  update(plan: Trajectory | null, desiredSpeed: number): void {
    const pts = plan?.points ?? [];
    if (pts.length < 2) {
      this.mesh.visible = false;
      return;
    }
    this.mesh.visible = true;

    const target = this.resample(pts);
    // Snap on a big discontinuity (reset / teleport), otherwise ease.
    if (this.smooth.length !== N || Math.hypot(target[0].x - this.smooth[0].x, target[0].y - this.smooth[0].y) > 8) {
      this.smooth = target.map((p) => ({ ...p }));
    } else {
      for (let i = 0; i < N; i++) {
        this.smooth[i].x += (target[i].x - this.smooth[i].x) * EASE;
        this.smooth[i].y += (target[i].y - this.smooth[i].y) * EASE;
        this.smooth[i].v += (target[i].v - this.smooth[i].v) * EASE;
      }
    }

    const s = this.smooth;
    const positions: number[] = [];
    const colors: number[] = [];
    const bright = new THREE.Color(THEME.pathBlue).multiplyScalar(1.6);
    const faint = new THREE.Color(THEME.pathBlueFaint);
    for (let i = 0; i < N; i++) {
      const prev = s[Math.max(0, i - 1)];
      const next = s[Math.min(N - 1, i + 1)];
      let dx = next.x - prev.x;
      let dy = next.y - prev.y;
      const len = Math.hypot(dx, dy) || 1;
      dx /= len;
      dy /= len;
      const px = -dy * HALF_WIDTH;
      const py = dx * HALF_WIDTH;
      positions.push(s[i].x + px, HEIGHT, s[i].y + py, s[i].x - px, HEIGHT, s[i].y - py);
      const frac = clamp(s[i].v / Math.max(desiredSpeed, 1), 0, 1);
      const c = faint.clone().lerp(bright, 0.25 + 0.75 * frac);
      colors.push(c.r, c.g, c.b, c.r, c.g, c.b);
    }
    const indices: number[] = [];
    for (let i = 0; i < N - 1; i++) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    this.geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    this.geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    this.geo.setIndex(indices);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.computeBoundingSphere();
  }
}
