// PedestrianView — renders pedestrians as simple upright figures, plus zebra
// crosswalk markings at signalised crossings. A crossing pedestrian glows amber
// (an alert colour) so it reads instantly; waiting ones stay a muted grey.

import * as THREE from "three";
import { Pedestrian } from "../pedestrian/PedestrianManager.ts";
import { ReferencePath } from "../world/ReferencePath.ts";

function makeFigure(): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: 0x8892a5,
    emissive: 0x000000,
    roughness: 0.7,
    metalness: 0.1,
  });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 1.1, 10), mat);
  body.position.y = 0.75;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), mat.clone());
  head.position.y = 1.55;
  g.add(body, head);
  g.userData.mats = [mat, head.material];
  return g;
}

export class PedestrianView {
  readonly group = new THREE.Group();
  private figures: THREE.Group[] = [];
  private crosswalks = new THREE.Group();
  private crosswalkKey = "";

  constructor(private path: ReferencePath) {
    this.group.add(this.crosswalks);
  }

  update(peds: Pedestrian[]): void {
    const active = peds.filter((p) => p.state !== "done");

    // Grow/shrink the figure pool.
    while (this.figures.length < active.length) {
      const f = makeFigure();
      this.figures.push(f);
      this.group.add(f);
    }
    for (let i = active.length; i < this.figures.length; i++) this.figures[i].visible = false;

    for (let i = 0; i < active.length; i++) {
      const p = active[i];
      const f = this.figures[i];
      f.visible = true;
      const w = this.path.toCartesian(p.s, p.d);
      f.position.set(w.x, 0, w.y);
      const crossing = p.state === "crossing";
      const col = new THREE.Color(crossing ? 0xffb020 : 0x8892a5);
      for (const m of f.userData.mats as THREE.MeshStandardMaterial[]) {
        m.color.copy(col);
        m.emissive.copy(crossing ? col : new THREE.Color(0x000000));
        m.emissiveIntensity = crossing ? 0.6 : 0;
      }
    }

    // Rebuild crosswalk markings only when the crossing set changes. Jaywalkers
    // (triggered crossings) get no crosswalk — that's the whole point.
    const key = peds
      .filter((p) => p.triggerDist === 0)
      .map((p) => p.s.toFixed(0))
      .join(",");
    if (key !== this.crosswalkKey) {
      this.crosswalkKey = key;
      this.rebuildCrosswalks(peds.filter((p) => p.triggerDist === 0));
    }
  }

  private rebuildCrosswalks(peds: Pedestrian[]): void {
    this.crosswalks.clear();
    for (const p of peds) {
      const positions: number[] = [];
      const halfW = Math.max(Math.abs(p.fromD), Math.abs(p.toD));
      for (let k = -3; k <= 3; k++) {
        const sc = p.s + k * 1.3;
        const a = this.path.toCartesian(sc - 0.32, -halfW);
        const b = this.path.toCartesian(sc - 0.32, halfW);
        const c = this.path.toCartesian(sc + 0.32, halfW);
        const d = this.path.toCartesian(sc + 0.32, -halfW);
        const y = 0.055;
        positions.push(a.x, y, a.y, b.x, y, b.y, c.x, y, c.y);
        positions.push(a.x, y, a.y, c.x, y, c.y, d.x, y, d.y);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      const mat = new THREE.MeshBasicMaterial({
        color: 0xdfe6f0,
        transparent: true,
        opacity: 0.5,
        toneMapped: false,
      });
      this.crosswalks.add(new THREE.Mesh(geo, mat));
    }
  }
}
