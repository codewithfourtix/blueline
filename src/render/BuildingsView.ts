// BuildingsView — a procedural city laid out on a GRID of blocks around the road
// loop. Buildings are placed on a regular lattice (axis-aligned, like real city
// blocks), skipping any cell that overlaps the road corridor, with lit windows.
// This turns the surroundings into an actual city rather than scattered boxes.

import * as THREE from "three";
import { Road } from "../world/Road.ts";

interface Slot {
  x: number;
  z: number;
  w: number;
  h: number;
  depth: number;
  color: THREE.Color;
}

const PALETTE = [0x2b3a52, 0x33425c, 0x3a4a66, 0x28374d, 0x44566f, 0x222f43, 0x3d4d63, 0x4a5d78];

export class BuildingsView {
  readonly group = new THREE.Group();

  constructor(road: Road) {
    const path = road.path;
    const rand = Math.random;

    // Coarse road points for a fast "is this cell on the road?" test.
    const roadPts: [number, number][] = [];
    for (let i = 0; i < path.count; i += 5) roadPts.push([path.xs[i], path.ys[i]]);
    const clearance = road.totalWidth / 2 + 13;
    const clr2 = clearance * clearance;

    const slots: Slot[] = [];
    const grid = 34;
    for (let x = -600; x <= 600; x += grid) {
      for (let z = -460; z <= 460; z += grid) {
        const bx = x + (rand() - 0.5) * 8;
        const bz = z + (rand() - 0.5) * 8;
        let onRoad = false;
        for (const [rx, rz] of roadPts) {
          const dx = bx - rx;
          const dz = bz - rz;
          if (dx * dx + dz * dz < clr2) {
            onRoad = true;
            break;
          }
        }
        if (onRoad) continue;
        if (rand() < 0.12) continue; // occasional empty lot / plaza
        const t = rand();
        slots.push({
          x: bx,
          z: bz,
          w: 14 + rand() * 12,
          depth: 14 + rand() * 12,
          h: 8 + t * t * t * 90,
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
      metalness: 0.12,
      emissive: 0x0e1830,
      emissiveIntensity: 0.28,
    });
    const mesh = new THREE.InstancedMesh(geo, mat, slots.length);
    const dummy = new THREE.Object3D();
    slots.forEach((b, i) => {
      dummy.position.set(b.x, b.h / 2, b.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(b.w, b.h, b.depth);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, b.color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.group.add(mesh);
  }

  private buildWindows(slots: Slot[]): void {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x9fc4ff,
      transparent: true,
      opacity: 0.13,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const mesh = new THREE.InstancedMesh(geo, mat, slots.length);
    const dummy = new THREE.Object3D();
    slots.forEach((b, i) => {
      dummy.position.set(b.x, b.h / 2, b.z);
      dummy.scale.set(b.w * 1.02, b.h * 0.98, b.depth * 1.02);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    this.group.add(mesh);
  }
}
