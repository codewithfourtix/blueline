// RoadView — builds the static road environment from the ReferencePath:
// the asphalt surface, soft shoulders framing it, solid edge lines, dashed lane
// dividers, and a run of glowing roadside delineator posts that give the scene
// depth and a clear sense of the road sweeping away into the night.

import * as THREE from "three";
import { ReferencePath } from "../world/ReferencePath.ts";
import { Road } from "../world/Road.ts";
import { THEME } from "./theme.ts";

export class RoadView {
  readonly group = new THREE.Group();

  constructor(road: Road) {
    const path = road.path;
    const halfW = road.totalWidth / 2;

    // Soft shoulders just outside the road, to frame the asphalt.
    for (const sign of [-1, 1]) {
      const shoulder = ribbon(path, sign * (halfW + 1.3), 1.4, 0.012, false);
      this.group.add(
        new THREE.Mesh(
          shoulder,
          new THREE.MeshStandardMaterial({ color: THEME.shoulder, roughness: 1, metalness: 0 }),
        ),
      );
    }

    // Asphalt surface — lighter than the ground, with a faint wet-night sheen.
    const asphalt = ribbon(path, 0, halfW, 0.02, false);
    this.group.add(
      new THREE.Mesh(
        asphalt,
        new THREE.MeshStandardMaterial({
          color: THEME.asphalt,
          roughness: 0.62,
          metalness: 0.22,
        }),
      ),
    );

    // Solid outer edge lines.
    for (const sign of [-1, 1]) {
      const edge = ribbon(path, sign * halfW, 0.16, 0.035, false);
      this.group.add(
        new THREE.Mesh(edge, new THREE.MeshBasicMaterial({ color: THEME.edgeLine })),
      );
    }

    // Dashed interior lane dividers.
    for (let i = 0; i < road.numLanes - 1; i++) {
      const dOff = road.laneCenter(i) + road.laneWidth / 2;
      const divider = ribbon(path, dOff, 0.11, 0.035, true, 3.0, 5.0);
      this.group.add(
        new THREE.Mesh(divider, new THREE.MeshBasicMaterial({ color: THEME.laneLine })),
      );
    }

    // Glowing roadside delineator posts (blue on the left, amber on the right).
    this.group.add(this.delineators(path, halfW + 3.0, THEME.delineator));
    this.group.add(this.delineators(path, -(halfW + 3.0), THEME.delineatorWarm));
  }

  private delineators(path: ReferencePath, dOff: number, color: number): THREE.InstancedMesh {
    const spacing = 20; // metres between posts
    const count = Math.max(1, Math.floor(path.length / spacing));
    const geo = new THREE.BoxGeometry(0.16, 1.1, 0.16);
    const mat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 1.3,
      roughness: 0.5,
    });
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const s = i * spacing;
      const p = path.toCartesian(s, dOff);
      dummy.position.set(p.x, 0.55, p.y);
      dummy.rotation.y = -p.heading;
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
  }
}

/**
 * Build a flat ribbon centred at lateral offset `dCenter`, `halfWidth` to each
 * side, laid at height `y`. If `dashed`, only segments whose arc-length falls in
 * the "on" part of a dash/gap cycle are emitted.
 */
function ribbon(
  path: ReferencePath,
  dCenter: number,
  halfWidth: number,
  y: number,
  dashed: boolean,
  dashLen = 3,
  gapLen = 4,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const n = path.count;
  const period = dashLen + gapLen;

  const offsetPoint = (i: number, lat: number): [number, number] => {
    const h = path.headings[i];
    const nx = -Math.sin(h);
    const ny = Math.cos(h);
    return [path.xs[i] + nx * lat, path.ys[i] + ny * lat];
  };

  for (let i = 0; i < n; i++) {
    const ni = (i + 1) % n;
    if (dashed) {
      const on = path.ss[i] % period < dashLen;
      if (!on) continue;
    }
    const [lix, liy] = offsetPoint(i, dCenter + halfWidth);
    const [rix, riy] = offsetPoint(i, dCenter - halfWidth);
    const [lnx, lny] = offsetPoint(ni, dCenter + halfWidth);
    const [rnx, rny] = offsetPoint(ni, dCenter - halfWidth);

    // Two triangles (world mapping: sim x -> x, sim y -> z).
    positions.push(lix, y, liy, rix, y, riy, lnx, y, lny);
    positions.push(rix, y, riy, rnx, y, rny, lnx, y, lny);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  return geo;
}
