// TrafficLightView — renders each signalised stop-line as a proper roadside
// signal: a pole on the near side, a mast arm reaching over the road, and a
// signal head whose lamps FACE THE ONCOMING EGO (red/amber/green, the active one
// blooms), plus a bright stop-line painted across the road. Everything is built
// in the light's LOCAL frame (ego travels along local +X, approaching from -X)
// and then rotated/positioned onto the road, so the head always faces traffic.

import * as THREE from "three";
import { ReferencePath } from "../world/ReferencePath.ts";
import { TrafficLight } from "../world/TrafficLight.ts";
import { THEME } from "./theme.ts";

const LAMP = { red: 0xff3b30, yellow: 0xffb020, green: 0x34c759 };

export class TrafficLightView {
  readonly group = new THREE.Group();
  private heads: { lights: TrafficLight; lamps: Record<string, THREE.MeshStandardMaterial> }[] = [];
  private key = "";

  constructor(private path: ReferencePath, private roadHalf: number) {}

  update(lights: TrafficLight[]): void {
    const key = lights.map((l) => l.s.toFixed(0)).join(",");
    if (key !== this.key) {
      this.key = key;
      this.rebuild(lights);
    }
    for (const h of this.heads) {
      const st = h.lights.state;
      for (const k of ["red", "yellow", "green"] as const) {
        const on = k === st;
        h.lamps[k].emissiveIntensity = on ? 1.7 : 0.02;
        h.lamps[k].color.setHex(on ? LAMP[k] : 0x10131a);
      }
    }
  }

  private rebuild(lights: TrafficLight[]): void {
    this.group.clear();
    this.heads = [];
    for (const lt of lights) {
      const p = this.path.cartesianAt(lt.s);
      const g = new THREE.Group();
      g.position.set(p.x, 0, p.y);
      g.rotation.y = -p.heading; // local +X = travel direction; ego approaches from -X

      const poleMat = new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.7 });
      const rightZ = this.roadHalf + 1.0; // near-side kerb (local +Z)

      // Vertical pole on the kerb.
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 6.0, 8), poleMat);
      pole.position.set(0, 3.0, rightZ);
      g.add(pole);

      // Mast arm reaching out over the road.
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, rightZ + 3), poleMat);
      arm.position.set(0, 5.7, rightZ / 2 - 1.5);
      g.add(arm);

      // Signal head hanging over the near lane, facing the oncoming ego (-X).
      const headZ = -this.roadHalf * 0.45;
      const housing = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 2.0, 0.7),
        new THREE.MeshStandardMaterial({ color: 0x12151c, roughness: 0.6 }),
      );
      housing.position.set(0, 5.0, headZ);
      g.add(housing);

      const lamps: Record<string, THREE.MeshStandardMaterial> = {};
      (["red", "yellow", "green"] as const).forEach((k, i) => {
        const mat = new THREE.MeshStandardMaterial({
          color: 0x10131a,
          emissive: LAMP[k],
          emissiveIntensity: 0.02,
          roughness: 0.35,
        });
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.23, 14, 12), mat);
        lamp.position.set(-0.3, 5.6 - i * 0.55, headZ); // protrude toward -X (the ego)
        g.add(lamp);
        lamps[k] = mat;
      });

      // Stop-line across the full road width (local Z), just ahead of the ego.
      const y = 0.06;
      const sl = new THREE.Mesh(
        new THREE.PlaneGeometry(0.7, this.roadHalf * 2),
        new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, toneMapped: false }),
      );
      sl.rotation.x = -Math.PI / 2;
      sl.position.set(-1.2, y, 0); // 1.2 m before the head, across the road
      g.add(sl);

      this.group.add(g);
      this.heads.push({ lights: lt, lamps });
    }
  }
}
