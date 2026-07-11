// TrailView — a fading breadcrumb ribbon of where the ego has driven, laid on
// the road behind it. Together with the blue planned path ahead, it shows the
// car's full trajectory: past (fading white) and intended future (blue).

import * as THREE from "three";

const MAX = 120; // points retained
const HALF_W = 0.35;
const MIN_STEP = 0.6; // metres between retained points

export class TrailView {
  readonly mesh: THREE.Mesh;
  private geo = new THREE.BufferGeometry();
  private pts: { x: number; y: number }[] = [];
  private lastX = Infinity;
  private lastY = Infinity;

  constructor() {
    const mat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(this.geo, mat);
    this.mesh.renderOrder = 4;
  }

  reset(): void {
    this.pts = [];
    this.lastX = Infinity;
    this.lastY = Infinity;
  }

  update(egoX: number, egoY: number): void {
    if (Math.hypot(egoX - this.lastX, egoY - this.lastY) >= MIN_STEP) {
      this.pts.push({ x: egoX, y: egoY });
      if (this.pts.length > MAX) this.pts.shift();
      this.lastX = egoX;
      this.lastY = egoY;
    }
    // If the ego teleported (reset), drop a stale segment.
    if (Math.hypot(egoX - this.lastX, egoY - this.lastY) > 15) this.reset();

    const n = this.pts.length;
    if (n < 2) {
      this.mesh.visible = false;
      return;
    }
    this.mesh.visible = true;

    const positions: number[] = [];
    const colors: number[] = [];
    for (let i = 0; i < n; i++) {
      const p = this.pts[i];
      const prev = this.pts[Math.max(0, i - 1)];
      const next = this.pts[Math.min(n - 1, i + 1)];
      let dx = next.x - prev.x;
      let dy = next.y - prev.y;
      const len = Math.hypot(dx, dy) || 1;
      dx /= len;
      dy /= len;
      const px = -dy * HALF_W;
      const py = dx * HALF_W;
      positions.push(p.x + px, 0.05, p.y + py, p.x - px, 0.05, p.y - py);
      // Fade from tail (transparent) to head (bright).
      const t = i / (n - 1);
      const c = 0.35 + 0.55 * t;
      colors.push(c * 0.75, c * 0.85, c, c * 0.75, c * 0.85, c);
    }
    const indices: number[] = [];
    for (let i = 0; i < n - 1; i++) {
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
