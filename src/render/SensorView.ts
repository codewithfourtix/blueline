// SensorView — a faint ring on the ground marking the ego's sensor range, plus
// a very subtle filled disc. It makes the perception horizon legible: cars only
// become tracks once they cross inside this circle.

import * as THREE from "three";
import { THEME } from "./theme.ts";

export class SensorView {
  readonly object = new THREE.Group();
  private ring: THREE.Mesh;
  private disc: THREE.Mesh;
  private currentRange = -1;

  constructor(range: number) {
    const ringMat = new THREE.MeshBasicMaterial({
      color: THEME.egoBlue,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const discMat = new THREE.MeshBasicMaterial({
      color: THEME.egoBlue,
      transparent: true,
      opacity: 0.05,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.ring = new THREE.Mesh(new THREE.RingGeometry(range - 0.4, range, 96), ringMat);
    this.disc = new THREE.Mesh(new THREE.CircleGeometry(range, 96), discMat);
    this.ring.rotation.x = -Math.PI / 2;
    this.disc.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.02;
    this.disc.position.y = 0.015;
    this.object.add(this.disc, this.ring);
    this.currentRange = range;
  }

  update(egoX: number, egoY: number, range: number): void {
    this.object.position.set(egoX, 0, egoY);
    if (Math.abs(range - this.currentRange) > 0.5) {
      this.ring.geometry.dispose();
      this.disc.geometry.dispose();
      this.ring.geometry = new THREE.RingGeometry(range - 0.4, range, 96);
      this.disc.geometry = new THREE.CircleGeometry(range, 96);
      this.currentRange = range;
    }
  }
}
