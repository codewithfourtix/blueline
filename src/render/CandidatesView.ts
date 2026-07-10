// CandidatesView — draws every trajectory the Frenet planner evaluated this
// cycle as faint thin lines: greyish-blue for viable candidates, dim red for
// ones rejected due to a predicted collision. It turns the planner's internal
// search into something you can actually watch — a big part of why the demo
// reads as "real autonomy" rather than a scripted animation.

import * as THREE from "three";
import { Trajectory } from "../planner/Trajectory.ts";
import { THEME } from "./theme.ts";

const HEIGHT = 0.05;

export class CandidatesView {
  readonly lines: THREE.LineSegments;
  private geo = new THREE.BufferGeometry();
  visible = true;

  constructor() {
    const mat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });
    this.lines = new THREE.LineSegments(this.geo, mat);
    this.lines.renderOrder = 3;
  }

  setVisible(v: boolean): void {
    this.visible = v;
    this.lines.visible = v;
  }

  update(candidates: Trajectory[], best: Trajectory | null): void {
    if (!this.visible) {
      this.lines.visible = false;
      return;
    }
    this.lines.visible = true;

    const positions: number[] = [];
    const colors: number[] = [];
    const viable = new THREE.Color(THEME.candidate);
    const bad = new THREE.Color(THEME.candidateColliding);

    for (const cand of candidates) {
      if (cand === best) continue; // the best one is drawn by PathRibbon
      const c = cand.colliding ? bad : viable;
      const pts = cand.points;
      for (let i = 0; i < pts.length - 1; i++) {
        positions.push(pts[i].x, HEIGHT, pts[i].y);
        positions.push(pts[i + 1].x, HEIGHT, pts[i + 1].y);
        colors.push(c.r, c.g, c.b, c.r, c.g, c.b);
      }
    }

    this.geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    this.geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    this.geo.computeBoundingSphere();
  }
}
