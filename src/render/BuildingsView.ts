// BuildingsView — a lightweight procedural city lining the road. Buildings of
// random footprint and height are scattered along both sides (set back beyond
// the shoulder), with lit windows, so the world feels inhabited without
// cluttering the drivable scene. All buildings live in two InstancedMeshes
// (bodies + emissive window shells) for cheap rendering.

import * as THREE from "three";
import { Road } from "../world/Road.ts";

interface Slot {
  x: number;
  z: number;
  w: number;
  h: number;
  depth: number;
  rotY: number;
  color: THREE.Color;
}

// Cool blue-grey facades, a few lighter, occasionally a warm-lit tower.
const PALETTE = [0x2b3a52, 0x33425c, 0x3a4a66, 0x28374d, 0x44566f, 0x222f43, 0x3d4d63];

export class BuildingsView {
  readonly group = new THREE.Group();

  constructor(road: Road) {
    const path = road.path;
    const L = path.length;
    const slots: Slot[] = [];

    const spacing = 30;
    const edge = road.totalWidth / 2 + 6; // clear of shoulder + posts
    const rand = Math.random;

    for (let s = 0; s < L; s += spacing) {
      for (const side of [-1, 1]) {
        if (rand() < 0.25) continue; // occasional gaps → not a solid wall
        const jitterS = (rand() - 0.5) * spacing * 0.7;
        const lateral = edge + 16 + rand() * 55; // 22–77 m off the road edge
        const w = 7 + rand() * 14;
        const depth = 7 + rand() * 14;
        // Height weighted toward low-rise, with the occasional tower.
        const t = rand();
        const h = 7 + t * t * t * 58;

        const p = path.toCartesian(s + jitterS, side * lateral);
        const heading = path.cartesianAt(s + jitterS).heading + (rand() - 0.5) * 0.5;
        slots.push({
          x: p.x,
          z: p.y,
          w,
          h,
          depth,
          rotY: -heading,
          color: new THREE.Color(PALETTE[(rand() * PALETTE.length) | 0]),
        });
      }
    }

    this.buildBodies(slots);
    this.buildWindows(slots);
  }

  private buildBodies(slots: Slot[]): void {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({
      roughness: 0.85,
      metalness: 0.1,
      emissive: 0x0e1830,
      emissiveIntensity: 0.3,
    });
    const mesh = new THREE.InstancedMesh(geo, mat, slots.length);
    const dummy = new THREE.Object3D();
    slots.forEach((b, i) => {
      dummy.position.set(b.x, b.h / 2, b.z);
      dummy.rotation.set(0, b.rotY, 0);
      dummy.scale.set(b.w, b.h, b.depth);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, b.color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.group.add(mesh);
  }

  /**
   * A thin emissive "window" shell slightly inset on each building, giving the
   * impression of lit windows glowing in the night (and blooming).
   */
  private buildWindows(slots: Slot[]): void {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x9fc4ff,
      transparent: true,
      opacity: 0.14,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const mesh = new THREE.InstancedMesh(geo, mat, slots.length);
    const dummy = new THREE.Object3D();
    slots.forEach((b, i) => {
      dummy.position.set(b.x, b.h / 2, b.z);
      dummy.rotation.set(0, b.rotY, 0);
      // Slightly larger than the body so it reads as a glowing rim of windows.
      dummy.scale.set(b.w * 1.02, b.h * 0.98, b.depth * 1.02);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    this.group.add(mesh);
  }
}
