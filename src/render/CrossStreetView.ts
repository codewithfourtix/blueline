// CrossStreetView — renders a perpendicular cross-street through each city
// junction, so a corner reads as a proper 4-way intersection (the main road
// turns; the cross traffic would go straight through).

import * as THREE from "three";
import { ReferencePath } from "../world/ReferencePath.ts";
import { THEME } from "./theme.ts";

export class CrossStreetView {
  readonly group = new THREE.Group();

  constructor(path: ReferencePath, junctions: [number, number][], roadHalf: number) {
    const reach = 34; // how far the cross-street extends each side
    const asphaltPos: number[] = [];
    const linePos: number[] = [];

    for (const [cx, cy] of junctions) {
      const s = path.toFrenet(cx, cy).s;
      const p = path.cartesianAt(s);
      const tx = Math.cos(p.heading);
      const ty = Math.sin(p.heading);
      const nx = -ty; // normal (cross-street direction)
      const ny = tx;

      // Asphalt quad: along the normal (±reach), across the road width (±roadHalf).
      const corner = (a: number, b: number): [number, number] => [
        p.x + nx * a + tx * b,
        p.y + ny * a + ty * b,
      ];
      const A = corner(reach, roadHalf);
      const B = corner(reach, -roadHalf);
      const C = corner(-reach, -roadHalf);
      const D = corner(-reach, roadHalf);
      const y = 0.018;
      asphaltPos.push(A[0], y, A[1], B[0], y, B[1], C[0], y, C[1]);
      asphaltPos.push(A[0], y, A[1], C[0], y, C[1], D[0], y, D[1]);

      // A dashed centre line along the cross-street.
      for (let k = -3; k <= 3; k++) {
        const off = k * 4.5;
        const p0 = corner(off - 1.1, 0);
        const p1 = corner(off + 1.1, 0);
        const hw = 0.16;
        const ly = 0.05;
        linePos.push(p0[0] - tx * hw, ly, p0[1] - ty * hw, p0[0] + tx * hw, ly, p0[1] + ty * hw, p1[0] + tx * hw, ly, p1[1] + ty * hw);
        linePos.push(p0[0] - tx * hw, ly, p0[1] - ty * hw, p1[0] + tx * hw, ly, p1[1] + ty * hw, p1[0] - tx * hw, ly, p1[1] - ty * hw);
      }
    }

    const ageo = new THREE.BufferGeometry();
    ageo.setAttribute("position", new THREE.Float32BufferAttribute(asphaltPos, 3));
    this.group.add(new THREE.Mesh(ageo, new THREE.MeshBasicMaterial({ color: THEME.asphalt, side: THREE.DoubleSide, toneMapped: false })));

    const lgeo = new THREE.BufferGeometry();
    lgeo.setAttribute("position", new THREE.Float32BufferAttribute(linePos, 3));
    this.group.add(new THREE.Mesh(lgeo, new THREE.MeshBasicMaterial({ color: 0xdfe6f0, side: THREE.DoubleSide, toneMapped: false })));
  }
}
