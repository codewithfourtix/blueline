// CarFleet — renders the ego vehicle and all ambient traffic as clean, matte
// 3-D car shapes. The ego glows electric blue (and blooms); traffic stays a
// neutral grey unless it is close enough ahead of the ego to warrant attention,
// at which point it warms toward the alert colour — echoing how Tesla's UI only
// colours objects that matter.

import * as THREE from "three";
import { Simulation } from "../sim/Simulation.ts";
import { THEME } from "./theme.ts";
import { VehicleDims } from "../vehicle/Vehicle.ts";
import { wrapDiff, clamp } from "../core/math.ts";

function makeCar(
  dims: VehicleDims,
  color: number,
  emissive: number,
  emissiveIntensity: number,
): THREE.Group {
  const g = new THREE.Group();
  const bodyH = 0.9;
  const cabinH = 0.7;

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(dims.length, bodyH, dims.width),
    new THREE.MeshStandardMaterial({
      color,
      emissive,
      emissiveIntensity,
      roughness: 0.45,
      metalness: 0.5,
    }),
  );
  body.position.y = bodyH / 2 + 0.1;

  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(dims.length * 0.55, cabinH, dims.width * 0.86),
    new THREE.MeshStandardMaterial({
      color,
      emissive,
      emissiveIntensity: emissiveIntensity * 0.7,
      roughness: 0.25,
      metalness: 0.6,
    }),
  );
  cabin.position.y = bodyH + cabinH / 2 + 0.05;
  cabin.position.x = -dims.length * 0.05;

  g.add(body, cabin);
  g.userData.materials = [body.material, cabin.material];
  return g;
}

export class CarFleet {
  readonly group = new THREE.Group();
  private ego: THREE.Group;
  private trafficMeshes: THREE.Group[] = [];

  constructor(private sim: Simulation) {
    this.ego = makeCar(sim.ego.dims, THEME.egoBlue, THEME.egoBlueBright, 1.4);
    this.group.add(this.ego);
  }

  update(): void {
    const sim = this.sim;

    // Ego transform.
    place(this.ego, sim.ego.x, sim.ego.y, sim.ego.yaw);

    // Grow/shrink the traffic mesh pool to match the car count.
    const cars = sim.traffic.cars;
    while (this.trafficMeshes.length < cars.length) {
      const dims: VehicleDims = { length: 4.6, width: 1.9, wheelbase: 2.7 };
      const m = makeCar(dims, THEME.trafficBody, 0x000000, 0);
      this.trafficMeshes.push(m);
      this.group.add(m);
    }
    while (this.trafficMeshes.length > cars.length) {
      const m = this.trafficMeshes.pop()!;
      this.group.remove(m);
    }

    // Ego station for "is this car relevant" colouring.
    const egoF = sim.path.toFrenet(sim.ego.x, sim.ego.y);
    const L = sim.path.length;

    for (let i = 0; i < cars.length; i++) {
      const c = cars[i];
      const mesh = this.trafficMeshes[i];
      // Scale the shared shape to this car's dimensions.
      mesh.scale.set(c.length / 4.6, 1, c.width / 1.9);
      const world = sim.path.toCartesian(c.s, c.d);
      const heading = sim.path.cartesianAt(c.s).heading;
      place(mesh, world.x, world.y, heading);

      // Colour: warm toward alert when close ahead in a nearby lane.
      const ds = wrapDiff(c.s, egoF.s, L);
      const dd = Math.abs(c.d - egoF.d);
      const relevant = ds > 0 && ds < 30 && dd < 4;
      const t = relevant ? clamp(1 - ds / 30, 0, 1) : 0;
      const mats = mesh.userData.materials as THREE.MeshStandardMaterial[];
      if (c.kind === "stalled") {
        // A hazard: steady amber glow regardless of distance.
        const amber = new THREE.Color(0xffb020);
        for (const mat of mats) {
          mat.color.copy(amber);
          mat.emissive.copy(amber);
          mat.emissiveIntensity = 0.6;
        }
      } else {
        const base = new THREE.Color(c.kind === "truck" ? THEME.trafficBodyDim : THEME.trafficBody);
        const alert = new THREE.Color(THEME.trafficAlert);
        const col = base.clone().lerp(alert, t * 0.7);
        for (const mat of mats) {
          mat.color.copy(col);
          mat.emissive.copy(alert);
          mat.emissiveIntensity = t * 0.5;
        }
      }
    }
  }
}

/** Place a car group at sim (x, y) with sim heading `yaw`. */
function place(obj: THREE.Object3D, x: number, y: number, yaw: number): void {
  obj.position.set(x, 0, y);
  obj.rotation.y = -yaw;
}
