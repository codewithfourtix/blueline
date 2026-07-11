// TrafficLightView — renders each signalised stop-line: a roadside signal head
// with red/amber/green lamps (the active one glows and blooms) plus a bright
// stop-line painted across the road. Rebuilt when the set of lights changes;
// lamp colours update every frame from the light state.

import * as THREE from "three";
import { ReferencePath } from "../world/ReferencePath.ts";
import { TrafficLight } from "../world/TrafficLight.ts";

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
        h.lamps[k].emissiveIntensity = on ? 1.6 : 0.02;
        h.lamps[k].color.setHex(on ? LAMP[k] : 0x11151c);
      }
    }
  }

  private rebuild(lights: TrafficLight[]): void {
    this.group.clear();
    this.heads = [];
    for (const lt of lights) {
      const g = new THREE.Group();
      // Roadside pole on the left edge.
      const base = this.path.toCartesian(lt.s, this.roadHalf + 1.8);
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.14, 5.2, 8),
        new THREE.MeshStandardMaterial({ color: 0x2a3444, roughness: 0.7 }),
      );
      pole.position.set(base.x, 2.6, base.y);
      g.add(pole);

      // Signal housing with three lamps.
      const housing = new THREE.Mesh(
        new THREE.BoxGeometry(0.7, 2.0, 0.5),
        new THREE.MeshStandardMaterial({ color: 0x11161f, roughness: 0.6 }),
      );
      housing.position.set(base.x, 5.4, base.y);
      g.add(housing);

      const lamps: Record<string, THREE.MeshStandardMaterial> = {};
      const order: (keyof typeof LAMP)[] = ["red", "yellow", "green"];
      order.forEach((k, i) => {
        const mat = new THREE.MeshStandardMaterial({
          color: 0x11151c,
          emissive: LAMP[k],
          emissiveIntensity: 0.02,
          roughness: 0.4,
        });
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 12), mat);
        lamp.position.set(base.x, 6.0 - i * 0.6, base.y + 0.28);
        g.add(lamp);
        lamps[k] = mat;
      });

      // Stop line across the road.
      const positions: number[] = [];
      const a = this.path.toCartesian(lt.s - 0.35, this.roadHalf);
      const b = this.path.toCartesian(lt.s - 0.35, -this.roadHalf);
      const c = this.path.toCartesian(lt.s + 0.35, -this.roadHalf);
      const d = this.path.toCartesian(lt.s + 0.35, this.roadHalf);
      const y = 0.06;
      positions.push(a.x, y, a.y, b.x, y, b.y, c.x, y, c.y, a.x, y, a.y, c.x, y, c.y, d.x, y, d.y);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      g.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })));

      this.group.add(g);
      this.heads.push({ lights: lt, lamps });
    }
  }
}
