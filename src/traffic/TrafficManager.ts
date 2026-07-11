// TrafficManager — spawns and updates the ambient traffic that the ego has to
// share the road with. Every car runs IDM longitudinally and MOBIL laterally,
// all in the Frenet frame of the road, on a closed loop (so station `s` wraps).
//
// The ego is injected into the neighbour queries as a virtual vehicle, so
// ambient cars slow for it and never drive through it — without the ego itself
// being controlled by IDM (it has its own planner).

import { Road } from "../world/Road.ts";
import { mod, smoothTowards, clamp } from "../core/math.ts";
import { DEFAULT_IDM, IDMParams, idmAcceleration } from "./IDM.ts";
import { DEFAULT_MOBIL, MobilParams, mobilShouldChange, Neighbor } from "./MOBIL.ts";

export type CarKind = "car" | "truck" | "stalled";

export interface TrafficCar {
  id: number;
  s: number; // station along the loop
  d: number; // continuous lateral offset (eases toward the target lane centre)
  v: number;
  lane: number; // logical lane index it is committed to
  desiredSpeed: number;
  length: number;
  width: number;
  changeCooldown: number; // seconds until it may consider another lane change
  hue: number; // stable per-car colour seed for the renderer
  kind: CarKind;
  cutInTimer: number; // >0: a scripted cut-in is pending (scenario use)
  cutInLane: number; // lane the cut-in car will swerve into
}

export type ScenarioName =
  | "highway"
  | "dense"
  | "trucks"
  | "stalled"
  | "cutin"
  | "crossing"
  | "occluded"
  | "jaywalker"
  | "lights"
  | "rush";

export interface EgoSnapshot {
  s: number;
  d: number;
  v: number;
  length: number;
}

interface LaneEntry {
  s: number;
  v: number;
  length: number;
  car: TrafficCar | null; // null == the ego virtual vehicle
}

export class TrafficManager {
  cars: TrafficCar[] = [];
  private nextId = 1;
  private idm: IDMParams = { ...DEFAULT_IDM };
  private mobil: MobilParams = { ...DEFAULT_MOBIL };

  constructor(private road: Road) {}

  get count(): number {
    return this.cars.length;
  }

  clear(): void {
    this.cars = [];
  }

  /** Populate the loop with `n` cars spaced out and given varied target speeds. */
  spawn(n: number, rand: () => number = Math.random): void {
    this.clear();
    const L = this.road.path.length;
    const minSpacing = 14;
    const attempts = n * 20;
    let placed = 0;
    for (let i = 0; i < attempts && placed < n; i++) {
      const lane = Math.floor(rand() * this.road.numLanes);
      const s = rand() * L;
      // Keep the ego's start box (s ≈ 0) clear so nothing spawns on top of it.
      if (s < 22 || s > L - 10) continue;
      // Reject if too close to an existing car in the same lane.
      let ok = true;
      for (const c of this.cars) {
        if (c.lane === lane && Math.abs(mod(c.s - s + L / 2, L) - L / 2) < minSpacing) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      const desired = 15 + rand() * 12; // 15–27 m/s ≈ 54–97 km/h
      this.cars.push(
        this.make(lane, s, desired * (0.6 + 0.4 * rand()), desired, 4.4 + rand() * 0.8, 1.9, "car"),
      );
      placed++;
    }
  }

  private make(
    lane: number,
    s: number,
    v: number,
    desiredSpeed: number,
    length: number,
    width: number,
    kind: CarKind,
  ): TrafficCar {
    return {
      id: this.nextId++,
      s,
      d: this.road.laneCenter(lane),
      v,
      lane,
      desiredSpeed,
      length,
      width,
      changeCooldown: Math.random() * 3,
      hue: Math.random(),
      kind,
      cutInTimer: -1,
      cutInLane: lane,
    };
  }

  /** Set up a named demo scenario. `egoLane` is the ego's starting lane. */
  spawnScenario(name: ScenarioName, egoLane: number): void {
    const L = this.road.path.length;
    switch (name) {
      case "highway":
        this.spawn(16);
        break;
      case "dense":
        this.spawn(30);
        break;
      case "trucks": {
        this.spawn(8);
        // A convoy of slow trucks IN THE EGO'S LANE, so it must overtake them.
        for (let i = 0; i < 4; i++) {
          const s = 70 + i * 60;
          this.cars.push(this.make(egoLane, s % L, 12, 13, 9 + i, 2.4, "truck"));
        }
        break;
      }
      case "stalled": {
        this.spawn(12);
        // A dead-stopped car directly in the ego's path — must be perceived & avoided.
        this.cars.push(this.make(egoLane, 95, 0, 0, 4.6, 1.95, "stalled"));
        break;
      }
      case "cutin": {
        this.spawn(12);
        // An aggressive car one lane over that swerves into the ego's lane.
        const from = egoLane + 1 < this.road.numLanes ? egoLane + 1 : egoLane - 1;
        const car = this.make(from, 42, 20, 22, 4.6, 1.95, "car");
        car.cutInTimer = 2.6;
        car.cutInLane = egoLane;
        this.cars.push(car);
        break;
      }
    }
  }

  setDensity(n: number): void {
    if (n === this.cars.length) return;
    this.spawn(n);
  }

  /** Advance all ambient cars by dt, reacting to each other and to the ego. */
  update(dt: number, ego: EgoSnapshot): void {
    const L = this.road.path.length;

    // Build per-lane, station-sorted lists including the ego virtual vehicle.
    const lanes: LaneEntry[][] = Array.from({ length: this.road.numLanes }, () => []);
    for (const c of this.cars) {
      lanes[clamp(c.lane, 0, this.road.numLanes - 1)].push({
        s: c.s,
        v: c.v,
        length: c.length,
        car: c,
      });
    }
    const egoLane = this.road.laneOf(ego.d);
    lanes[egoLane].push({ s: ego.s, v: ego.v, length: ego.length, car: null });
    for (const lane of lanes) lane.sort((a, b) => a.s - b.s);

    // --- Longitudinal (IDM) + lane-change (MOBIL) decisions -----------------
    for (const c of this.cars) {
      // Stalled cars are inert obstacles.
      if (c.kind === "stalled") {
        c.v = 0;
        continue;
      }
      // Scripted cut-in: after the timer expires, force the swerve.
      if (c.cutInTimer > 0) {
        c.cutInTimer -= dt;
        if (c.cutInTimer <= 0) {
          c.lane = c.cutInLane;
          c.changeCooldown = 5;
        }
      }

      const idmForCar: IDMParams = { ...this.idm, v0: c.desiredSpeed };

      const lead = this.lead(lanes[c.lane], c.s, c.length);
      const accel = idmAcceleration(
        c.v,
        lead ? lead.gap : 1000,
        lead ? c.v - lead.v : 0,
        idmForCar,
      );

      // Lane-change consideration (rate-limited).
      c.changeCooldown -= dt;
      if (c.changeCooldown <= 0 && Math.abs(c.d - this.road.laneCenter(c.lane)) < 0.3) {
        const options: number[] = [];
        if (c.lane + 1 < this.road.numLanes) options.push(c.lane + 1);
        if (c.lane - 1 >= 0) options.push(c.lane - 1);
        for (const target of options) {
          const curLead = this.leadNeighbor(lanes[c.lane], c.s, c.length, c.v);
          const curFollower = this.followerNeighbor(lanes[c.lane], c.s, c.length, c.v);
          const newLead = this.leadNeighbor(lanes[target], c.s, c.length, c.v);
          const newFollower = this.followerNeighbor(lanes[target], c.s, c.length, c.v);
          // Slight bias toward the right-most lanes (lower index) for realism.
          const bias = (c.lane - target) * this.mobil.bias;
          if (
            mobilShouldChange(c.v, curLead, curFollower, newLead, newFollower, idmForCar, this.mobil, bias)
          ) {
            c.lane = target;
            c.changeCooldown = 4 + Math.random() * 2;
            break;
          }
        }
      }

      // Integrate longitudinal motion.
      c.v = clamp(c.v + accel * dt, 0, c.desiredSpeed * 1.15);
      c.s = mod(c.s + c.v * dt, L);
      // Ease lateral offset toward the committed lane centre (smooth changes).
      c.d = smoothTowards(c.d, this.road.laneCenter(c.lane), 2.5, dt);
    }
  }

  // ---- neighbour queries -------------------------------------------------

  /** Nearest vehicle AHEAD of station `s` in a sorted lane; gap is bumper-to-bumper. */
  private lead(list: LaneEntry[], s: number, selfLen: number): { v: number; gap: number } | null {
    const L = this.road.path.length;
    let best: LaneEntry | null = null;
    let bestFwd = Infinity;
    for (const e of list) {
      const fwd = mod(e.s - s, L);
      if (fwd > 1e-3 && fwd < bestFwd) {
        bestFwd = fwd;
        best = e;
      }
    }
    if (!best) return null;
    return { v: best.v, gap: bestFwd - (selfLen / 2 + best.length / 2) };
  }

  private follower(list: LaneEntry[], s: number, selfLen: number): { v: number; gap: number } | null {
    const L = this.road.path.length;
    let best: LaneEntry | null = null;
    let bestBack = Infinity;
    for (const e of list) {
      const back = mod(s - e.s, L);
      if (back > 1e-3 && back < bestBack) {
        bestBack = back;
        best = e;
      }
    }
    if (!best) return null;
    return { v: best.v, gap: bestBack - (selfLen / 2 + best.length / 2) };
  }

  private leadNeighbor(list: LaneEntry[], s: number, selfLen: number, selfV: number): Neighbor | null {
    const l = this.lead(list, s, selfLen);
    return l ? { v: l.v, gap: Math.max(l.gap, 0.1), dv: selfV - l.v } : null;
  }

  private followerNeighbor(list: LaneEntry[], s: number, selfLen: number, selfV: number): Neighbor | null {
    const f = this.follower(list, s, selfLen);
    return f ? { v: f.v, gap: Math.max(f.gap, 0.1), dv: f.v - selfV } : null;
  }
}
