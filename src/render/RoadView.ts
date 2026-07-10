// RoadView — builds the static road geometry (asphalt + lane markings) from the
// ReferencePath. Everything is generated once as flat ribbons hugging the ground.

import * as THREE from "three";
import { ReferencePath } from "../world/ReferencePath.ts";
import { Road } from "../world/Road.ts";
import { THEME } from "./theme.ts";

export class RoadView {
  readonly group = new THREE.Group();

  constructor(road: Road) {
    const path = road.path;

    // Asphalt surface across the full road width.
    const asphalt = ribbon(path, 0, road.totalWidth / 2, 0.02, false);
    this.group.add(
      new THREE.Mesh(
        asphalt,
        new THREE.MeshStandardMaterial({ color: THEME.asphalt, roughness: 0.95, metalness: 0.0 }),
      ),
    );

    // Solid outer edge lines.
    for (const sign of [-1, 1]) {
      const edge = ribbon(path, sign * road.totalWidth / 2, 0.12, 0.035, false);
      this.group.add(
        new THREE.Mesh(edge, new THREE.MeshBasicMaterial({ color: THEME.edgeLine })),
      );
    }

    // Dashed interior lane dividers.
    for (let i = 0; i < road.numLanes - 1; i++) {
      const dOff = road.laneCenter(i) + road.laneWidth / 2;
      const divider = ribbon(path, dOff, 0.09, 0.035, true, 3.0, 4.0);
      this.group.add(
        new THREE.Mesh(divider, new THREE.MeshBasicMaterial({ color: THEME.laneLine })),
      );
    }
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
