// CarFleet — renders the ego and all ambient traffic as proper 3-D vehicles:
// a rounded painted body, a dark-glass greenhouse, four wheels, and head/tail
// lights. Cars, trucks and the ego use distinct shapes. The ego glows electric
// blue (and blooms); traffic stays neutral grey and only warms toward the alert
// colour when it's close ahead — echoing how Tesla's UI colours what matters.

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { Simulation } from "../sim/Simulation.ts";
import { THEME } from "./theme.ts";
import { VehicleDims } from "../vehicle/Vehicle.ts";
import { wrapDiff, clamp } from "../core/math.ts";

type Kind = "car" | "truck" | "stalled" | "ego";

function wheel(radius: number, tread: number, x: number, z: number): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, tread, 16),
    new THREE.MeshStandardMaterial({ color: 0x0c0e13, roughness: 0.85, metalness: 0.1 }),
  );
  m.rotation.x = Math.PI / 2; // axle along the car's width
  m.position.set(x, radius, z);
  return m;
}

function lightBar(x: number, z: number, y: number, color: number, w: number): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.16, w),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.1, roughness: 0.4 }),
  );
  m.position.set(x, y, z);
  return m;
}

function makeVehicle(kind: Kind, paint: number, emissive: number, emiss: number, dims: VehicleDims): THREE.Group {
  const g = new THREE.Group();
  const L = dims.length;
  const W = dims.width;

  const bodyMat = new THREE.MeshStandardMaterial({
    color: paint,
    emissive,
    emissiveIntensity: emiss,
    roughness: 0.42,
    metalness: 0.55,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x0e131c,
    emissive: 0x05070b,
    roughness: 0.08,
    metalness: 0.3,
  });

  if (kind === "truck") {
    // Cab-over lorry: tall cab up front + a long box trailer.
    const wr = 0.46;
    for (const fx of [L * 0.34, -L * 0.16, -L * 0.34]) {
      g.add(wheel(wr, 0.3, fx, W * 0.5 - 0.05), wheel(wr, 0.3, fx, -(W * 0.5 - 0.05)));
    }
    const cab = new THREE.Mesh(new RoundedBoxGeometry(L * 0.26, 1.5, W, 3, 0.14), bodyMat);
    cab.position.set(L * 0.34, wr + 0.75, 0);
    const cabGlass = new THREE.Mesh(new RoundedBoxGeometry(L * 0.1, 0.55, W * 0.9, 2, 0.1), glassMat);
    cabGlass.position.set(L * 0.4, wr + 1.15, 0);
    const box = new THREE.Mesh(new RoundedBoxGeometry(L * 0.62, 1.7, W, 3, 0.1), bodyMat.clone());
    box.position.set(-L * 0.1, wr + 0.85, 0);
    g.add(cab, cabGlass, box);
    g.add(lightBar(L * 0.47, W * 0.34, wr + 0.4, 0xfff2cc, 0.3), lightBar(L * 0.47, -W * 0.34, wr + 0.4, 0xfff2cc, 0.3));
    g.userData.bodyMats = [bodyMat, box.material];
  } else {
    // Passenger car: rounded hull + glass greenhouse.
    const wr = 0.34;
    g.add(wheel(wr, 0.24, L * 0.31, W * 0.5 - 0.02), wheel(wr, 0.24, L * 0.31, -(W * 0.5 - 0.02)));
    g.add(wheel(wr, 0.24, -L * 0.31, W * 0.5 - 0.02), wheel(wr, 0.24, -L * 0.31, -(W * 0.5 - 0.02)));

    const body = new THREE.Mesh(new RoundedBoxGeometry(L, 0.66, W, 4, 0.18), bodyMat);
    body.position.y = wr + 0.28;
    const green = new THREE.Mesh(new RoundedBoxGeometry(L * 0.52, 0.52, W * 0.84, 4, 0.16), glassMat);
    green.position.set(-L * 0.05, wr + 0.78, 0);
    g.add(body, green);
    g.add(lightBar(L * 0.5, W * 0.32, wr + 0.28, 0xfff2cc, 0.34), lightBar(L * 0.5, -W * 0.32, wr + 0.28, 0xfff2cc, 0.34));
    g.add(lightBar(-L * 0.5, W * 0.32, wr + 0.3, 0xff2a20, 0.34), lightBar(-L * 0.5, -W * 0.32, wr + 0.3, 0xff2a20, 0.34));
    g.userData.bodyMats = [bodyMat];
  }

  g.userData.builtKind = kind;
  return g;
}

export class CarFleet {
  readonly group = new THREE.Group();
  private ego: THREE.Group;
  private pool: THREE.Group[] = [];

  constructor(private sim: Simulation) {
    this.ego = makeVehicle("ego", THEME.egoBlue, THEME.egoBlueBright, 1.3, sim.ego.dims);
    this.group.add(this.ego);
  }

  update(): void {
    const sim = this.sim;
    place(this.ego, sim.ego.x, sim.ego.y, sim.ego.yaw);

    const cars = sim.traffic.cars;
    while (this.pool.length < cars.length) {
      const m = makeVehicle("car", THEME.trafficBody, 0x000000, 0, { length: 4.6, width: 1.9, wheelbase: 2.7 });
      this.pool.push(m);
      this.group.add(m);
    }
    while (this.pool.length > cars.length) {
      this.group.remove(this.pool.pop()!);
    }

    const egoF = sim.path.toFrenet(sim.ego.x, sim.ego.y);
    const L = sim.path.length;

    for (let i = 0; i < cars.length; i++) {
      const c = cars[i];
      let mesh = this.pool[i];
      // Rebuild if this slot now holds a different vehicle kind.
      const wantKind: Kind = c.kind === "truck" ? "truck" : "car";
      if (mesh.userData.builtKind !== wantKind) {
        this.group.remove(mesh);
        const dims: VehicleDims =
          wantKind === "truck" ? { length: 10, width: 2.4, wheelbase: 4 } : { length: 4.6, width: 1.9, wheelbase: 2.7 };
        mesh = makeVehicle(wantKind, THEME.trafficBody, 0x000000, 0, dims);
        this.pool[i] = mesh;
        this.group.add(mesh);
      }

      if (wantKind === "truck") mesh.scale.set(c.length / 10, 1, c.width / 2.4);
      else mesh.scale.set(c.length / 4.6, 1, c.width / 1.9);

      const world = sim.path.toCartesian(c.s, c.d);
      const heading = sim.path.cartesianAt(c.s).heading;
      place(mesh, world.x, world.y, heading);

      const ds = wrapDiff(c.s, egoF.s, L);
      const dd = Math.abs(c.d - egoF.d);
      const t = ds > 0 && ds < 30 && dd < 4 ? clamp(1 - ds / 30, 0, 1) : 0;
      const mats = mesh.userData.bodyMats as THREE.MeshStandardMaterial[];
      if (c.kind === "stalled") {
        const amber = new THREE.Color(0xffb020);
        for (const m of mats) {
          m.color.copy(amber);
          m.emissive.copy(amber);
          m.emissiveIntensity = 0.6;
        }
      } else {
        const base = new THREE.Color(c.kind === "truck" ? THEME.trafficBodyDim : THEME.trafficBody);
        const col = base.clone().lerp(new THREE.Color(THEME.trafficAlert), t * 0.7);
        for (const m of mats) {
          m.color.copy(col);
          m.emissive.copy(new THREE.Color(THEME.trafficAlert));
          m.emissiveIntensity = t * 0.5;
        }
      }
    }
  }
}

/** Place a vehicle group at sim (x, y) with sim heading `yaw`. */
function place(obj: THREE.Object3D, x: number, y: number, yaw: number): void {
  obj.position.set(x, 0, y);
  obj.rotation.y = -yaw;
}
