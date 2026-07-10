// OccupancyView — renders the ego-centred occupancy grid as a field of subtle
// glowing tiles over blocked cells. It's the visual shorthand for "occupancy
// network": a unified, obstacle-agnostic picture of where the car may not go.

import * as THREE from "three";
import { OccupancyGrid } from "../perception/OccupancyGrid.ts";
import { THEME } from "./theme.ts";

export class OccupancyView {
  readonly object: THREE.InstancedMesh;
  private dummy = new THREE.Object3D();

  constructor(grid: OccupancyGrid) {
    const max = grid.cols * grid.rows;
    const geo = new THREE.PlaneGeometry(grid.cell * 0.9, grid.cell * 0.9);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color: THEME.egoBlue,
      transparent: true,
      opacity: 0.11,
      depthWrite: false,
    });
    this.object = new THREE.InstancedMesh(geo, mat, max);
    this.object.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.object.count = 0;
    this.object.renderOrder = 2;
  }

  update(grid: OccupancyGrid): void {
    if (!this.object.visible) return;
    let n = 0;
    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.cols; c++) {
        if (!grid.occupied[r * grid.cols + c]) continue;
        const [wx, wy] = grid.cellCenter(c, r);
        this.dummy.position.set(wx, 0.03, wy);
        this.dummy.updateMatrix();
        this.object.setMatrixAt(n++, this.dummy.matrix);
      }
    }
    this.object.count = n;
    this.object.instanceMatrix.needsUpdate = true;
  }
}
