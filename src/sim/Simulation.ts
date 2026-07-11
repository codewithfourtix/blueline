// Simulation — the headless core that ties the AV stack together. It owns the
// world, the ego vehicle, the traffic, the planner and the controllers, and
// advances everything on a fixed timestep. It deliberately imports NOTHING from
// the renderer, so the full autonomy pipeline can be unit-/smoke-tested without
// a browser or a GPU.
//
//   perception  -> ego Frenet state + obstacle list (ground-truth here)
//   prediction  -> constant-velocity forward roll of traffic (inside planner)
//   planning    -> FrenetPlanner picks the blue line (10 Hz)
//   control     -> Pure Pursuit (steer) + PID (speed) track it (60 Hz)

import { ReferencePath, FrenetPose } from "../world/ReferencePath.ts";
import { Road } from "../world/Road.ts";
import { DEFAULT_TRACK } from "../world/track.ts";
import { Vehicle, EGO_DIMS } from "../vehicle/Vehicle.ts";
import { PID } from "../control/PID.ts";
import { stanleyControl, StanleyConfig } from "../control/Stanley.ts";
import { TrafficManager, ScenarioName } from "../traffic/TrafficManager.ts";
import { FrenetPlanner } from "../planner/FrenetPlanner.ts";
import { FrenetState, Obstacle, Trajectory } from "../planner/Trajectory.ts";
import { Sensor, SensableObject } from "../perception/Sensor.ts";
import { Tracker, Track } from "../perception/Tracker.ts";
import { OccupancyGrid } from "../perception/OccupancyGrid.ts";
import { PedestrianManager } from "../pedestrian/PedestrianManager.ts";
import { TrafficLight } from "../world/TrafficLight.ts";
import { BehaviorPlanner, BehaviorState } from "../behavior/BehaviorPlanner.ts";
import { ImitationAgent } from "../learn/ImitationAgent.ts";
import { DriveContext, extractFeatures } from "../learn/features.ts";
import { MLP } from "../learn/NN.ts";
import { Metrics } from "./Metrics.ts";
import { clamp, wrapAngle, mod, wrapDiff } from "../core/math.ts";

export type ControlMode = "classical" | "learned" | "external";
export type Policy = (features: number[]) => { steer: number; accel: number };
export type Weather = "clear" | "rain" | "fog";
import { DEFAULT_SIM, SimConfig } from "./config.ts";

export interface Telemetry {
  speed: number; // m/s
  targetSpeed: number;
  desiredSpeed: number;
  lane: number;
  planCost: number;
  candidateCount: number;
  planMs: number;
  colliding: boolean;
  steer: number;
  accel: number;
  distanceTravelled: number; // m
  trackedCount: number; // confirmed Kalman tracks
  sensorRange: number;
  usePerception: boolean;
  behaviorState: BehaviorState;
  pedCount: number; // active pedestrians
  controlMode: ControlMode;
}

export class Simulation {
  readonly config: SimConfig;
  readonly path: ReferencePath;
  readonly road: Road;
  readonly ego: Vehicle;
  readonly traffic: TrafficManager;
  readonly planner: FrenetPlanner;
  readonly sensor: Sensor;
  readonly tracker: Tracker;
  readonly occupancy: OccupancyGrid;
  readonly pedestrians: PedestrianManager;
  trafficLights: TrafficLight[] = [];
  readonly behavior: BehaviorPlanner;
  readonly imitation: ImitationAgent;
  readonly metrics = new Metrics();
  private prevDelta = 0;
  behaviorState: BehaviorState = "CRUISE";
  controlMode: ControlMode = "classical";
  externalPolicy: Policy | null = null;
  evolvedChampion: MLP | null = null; // set by the UI after neuroevolution
  safetyShieldEnabled = true; // AEB + LKA for learned drivers (off during evolution)
  collecting = false;
  weather: Weather = "clear";
  private weatherSpeedFactor = 1;
  private baseDesiredSpeed: number;
  private lastObstacles: Obstacle[] = [];

  plan: Trajectory | null = null;
  candidates: Trajectory[] = [];
  tracks: Track[] = [];
  telemetry: Telemetry;
  paused = false;
  showCandidates = true;
  /** When true the planner drives off Kalman tracks; when false, ground truth. */
  usePerception = true;
  scenario: ScenarioName = "highway";

  private speedPID: PID;
  private steerConfig: StanleyConfig;
  private planTimer = 0;
  private lastEgoIndex = -1;
  private lastPlanMs = 0;
  private distance = 0;

  constructor(config: Partial<SimConfig> = {}) {
    this.config = { ...DEFAULT_SIM, ...config };

    this.path = new ReferencePath(DEFAULT_TRACK.controlPoints, 40);
    this.road = new Road(this.path, this.config.numLanes, this.config.laneWidth);

    // Place the ego on the centre lane, aligned with the road.
    const start = this.path.toCartesian(0, this.road.laneCenter(Math.floor(this.config.numLanes / 2)));
    this.ego = new Vehicle(start.x, start.y, start.heading, 14, EGO_DIMS, {
      maxSpeed: 42,
    });

    this.traffic = new TrafficManager(this.road);
    this.traffic.spawn(this.config.trafficCount);

    this.planner = new FrenetPlanner(this.road, {
      desiredSpeed: this.config.egoDesiredSpeed,
    });

    this.sensor = new Sensor();
    this.tracker = new Tracker();
    this.occupancy = new OccupancyGrid(50, 2);
    this.pedestrians = new PedestrianManager(this.road);
    this.behavior = new BehaviorPlanner(this.road);
    this.imitation = new ImitationAgent();
    this.baseDesiredSpeed = this.config.egoDesiredSpeed;

    this.speedPID = new PID(1.2, 0.15, 0.05, -this.ego.maxDecel, this.ego.maxAccel);
    this.steerConfig = {
      k: 3.0, // cross-track gain
      kSoft: 1.2,
      maxSteer: this.ego.maxSteer,
    };

    this.telemetry = {
      speed: this.ego.v,
      targetSpeed: this.config.egoDesiredSpeed,
      desiredSpeed: this.config.egoDesiredSpeed,
      lane: this.road.laneOf(0),
      planCost: 0,
      candidateCount: 0,
      planMs: 0,
      colliding: false,
      steer: 0,
      accel: 0,
      distanceTravelled: 0,
      trackedCount: 0,
      sensorRange: this.sensor.config.range,
      usePerception: this.usePerception,
      behaviorState: "CRUISE",
      pedCount: 0,
      controlMode: "classical",
    };

    // Prime perception + the first plan so control has something on frame 1.
    this.perceive(this.config.fixedDt);
    this.replan();
  }

  setDesiredSpeed(v: number): void {
    this.baseDesiredSpeed = v;
    this.telemetry.desiredSpeed = v;
  }

  setTrafficCount(n: number): void {
    this.traffic.setDensity(n);
  }

  reset(): void {
    const mid = Math.floor(this.config.numLanes / 2);
    const start = this.path.toCartesian(0, this.road.laneCenter(mid));
    this.ego.x = start.x;
    this.ego.y = start.y;
    this.ego.yaw = start.heading;
    this.ego.v = 14;
    this.ego.a = 0;
    this.ego.delta = 0;
    this.speedPID.reset();
    this.distance = 0;
    this.lastEgoIndex = -1;
    this.configureScenario(mid);
    this.tracker.reset();
    this.tracks = [];
    this.metrics.reset();
    this.prevDelta = 0;
    this.perceive(this.config.fixedDt);
    this.replan();
  }

  /** Set up traffic AND pedestrians for the current scenario. */
  private configureScenario(mid: number): void {
    const half = this.road.totalWidth / 2;
    this.pedestrians.clear();
    this.trafficLights = [];
    switch (this.scenario) {
      case "crossing": {
        // A pedestrian using a crosswalk ahead — the ego must stop and yield.
        this.traffic.spawn(8);
        this.pedestrians.add({ s: 115, fromD: half + 3, toD: -half - 3, speed: 1.4, wait: 1.5 });
        // Keep the ego's lane clear on the approach so the crosswalk is never
        // occluded by (or blocked behind) another vehicle.
        const L = this.path.length;
        const start = mod(115 - 70, L);
        this.traffic.cars = this.traffic.cars.filter((c) => !(mod(c.s - start, L) < 80 && c.lane === mid));
        break;
      }
      case "occluded":
        // A pedestrian steps out from behind a stalled car — seen late. THE
        // textbook hard case for perception + emergency braking.
        this.traffic.spawnScenario("stalled", mid);
        this.pedestrians.add({ s: 104, fromD: -(half + 3), toD: half + 3, speed: 1.7, wait: 0.6 });
        break;
      case "jaywalker":
        // Someone darts across right in front of the ego with no warning.
        this.traffic.spawn(8);
        this.pedestrians.add({ s: 135, fromD: half + 3, toD: -half - 3, speed: 2.6, triggerDist: 76 });
        break;
      case "lights":
        // A signalised intersection: the ego must stop on red, go on green.
        this.traffic.spawn(8);
        this.trafficLights = [new TrafficLight(150, { green: 7, yellow: 2, red: 12, offset: 8 })];
        break;
      case "stalled": {
        this.traffic.spawnScenario("stalled", mid);
        // Guarantee a clear overtaking corridor beside the stalled car so the
        // ego can reliably go around it (not get randomly boxed in).
        const L = this.path.length;
        const start = mod(95 - 22, L); // just behind the stalled car (~s=95)
        this.traffic.cars = this.traffic.cars.filter(
          (c) => c.kind === "stalled" || !(mod(c.s - start, L) < 70 && c.lane !== mid),
        );
        break;
      }
      case "trucks": {
        this.traffic.spawnScenario("trucks", mid);
        // Keep the lanes beside the convoy clear so the ego can pass reliably.
        const L = this.path.length;
        const start = mod(60, L);
        this.traffic.cars = this.traffic.cars.filter(
          (c) => c.kind === "truck" || !(mod(c.s - start, L) < 220 && c.lane !== mid),
        );
        break;
      }
      default:
        this.traffic.spawnScenario(this.scenario, mid);
    }
  }

  setScenario(name: ScenarioName): void {
    this.scenario = name;
    this.reset();
  }

  setSensorRange(r: number): void {
    this.sensor.config.range = r;
  }

  /** Current ego state expressed in the road's Frenet frame. */
  private egoFrenet(): FrenetState {
    // Full search (no hint) — cheap at 10 Hz and immune to hint drift on curves.
    const f = this.path.toFrenet(this.ego.x, this.ego.y, -1);
    this.lastEgoIndex = f.index;
    const pathHeading = this.path.cartesianAt(f.s).heading;
    const yawErr = wrapAngle(this.ego.yaw - pathHeading);
    const sDot = this.ego.v * Math.cos(yawErr);
    const dDot = this.ego.v * Math.sin(yawErr);
    return {
      s: f.s,
      d: f.d,
      sDot,
      sDdot: this.ego.a * Math.cos(yawErr),
      dDot,
      dDdot: 0,
      index: f.index,
    };
  }

  /** Obstacles the planner reasons about — perceived tracks or ground truth. */
  private obstacles(): Obstacle[] {
    if (!this.usePerception) {
      const obs: Obstacle[] = this.traffic.cars.map((c) => ({
        s: c.s, d: c.d, v: c.v, vd: 0, length: c.length, width: c.width, kind: "car" as const,
      }));
      for (const p of this.pedestrians.peds) {
        if (p.state === "done") continue;
        obs.push({
          s: p.s, d: p.d, v: 0, vd: this.pedestrians.lateralVel(p),
          length: p.radius * 2, width: p.radius * 2, kind: "ped",
        });
      }
      return obs;
    }
    // Project each confirmed Kalman track into the road's Frenet frame, using
    // its ESTIMATED velocity for both along-road and lateral (crossing) speed.
    return this.tracks.map((t) => {
      const f = this.path.toFrenet(t.px, t.py);
      const h = this.path.cartesianAt(f.s).heading;
      const tx = Math.cos(h);
      const ty = Math.sin(h);
      const vAlong = t.vx * tx + t.vy * ty;
      const vLat = -t.vx * ty + t.vy * tx; // component along the left normal
      return { s: f.s, d: f.d, v: vAlong, vd: vLat, length: t.length, width: t.width, kind: t.kind };
    });
  }

  /** Run the perception pipeline: sensor → tracker → occupancy grid. */
  private perceive(dt: number): void {
    const objects: SensableObject[] = [];
    for (const c of this.traffic.cars) {
      const w = this.path.toCartesian(c.s, c.d);
      objects.push({ x: w.x, y: w.y, length: c.length, width: c.width, kind: "car" });
    }
    for (const p of this.pedestrians.peds) {
      if (p.state === "done") continue;
      const w = this.path.toCartesian(p.s, p.d);
      objects.push({ x: w.x, y: w.y, length: p.radius * 2, width: p.radius * 2, kind: "ped" });
    }
    const detections = this.sensor.sense(this.ego.x, this.ego.y, objects);
    this.tracks = this.tracker.update(detections, dt);
    this.occupancy.build(this.ego.x, this.ego.y, this.tracks);
  }

  private replan(): void {
    const state = this.egoFrenet();
    const currentLane = this.road.laneOf(state.d);
    const obstacles = this.obstacles();

    // Behaviour FSM decides the manoeuvre; it modulates the motion planner.
    const decision = this.behavior.decide(
      { s: state.s, d: state.d, v: this.ego.v, lane: currentLane },
      obstacles,
      this.baseDesiredSpeed,
    );
    this.behaviorState = decision.state;
    // Slow for road curvature (lateral-acceleration limit) so the car can
    // actually hold its lane through bends instead of understeering wide.
    const aLatMax = 2.2;
    const k = this.path.maxCurvatureAhead(state.s, 100);
    const curveCap = k > 1e-4 ? Math.sqrt(aLatMax / k) : Infinity;
    let target = Math.min(decision.targetSpeed * this.weatherSpeedFactor, curveCap);

    // Traffic-light stop-line: stop at the line on red (and yellow if we can).
    for (const lt of this.trafficLights) {
      const fwd = mod(lt.s - state.s, this.path.length);
      if (fwd <= 0 || fwd > 90) continue;
      const stopForLight = lt.state === "red" || (lt.state === "yellow" && fwd > 14);
      if (stopForLight) {
        const stopSpeed = Math.sqrt(2 * 2.3 * Math.max(fwd - 5, 0)); // brake early, stop ~5 m before line
        if (stopSpeed < target) {
          target = stopSpeed;
          this.behaviorState = "STOP";
        }
      }
    }
    this.planner.config.desiredSpeed = Math.max(0, target);

    const t0 = performance.now();
    const result = this.planner.plan(state, obstacles, currentLane, decision.biasLane);
    this.lastPlanMs = performance.now() - t0;
    this.plan = result.best;
    this.candidates = result.candidates;
    this.lastObstacles = obstacles;
  }

  /** Build the normalised feature vector the learned agents see. */
  private buildFeatures(): number[] {
    const f = this.path.toFrenet(this.ego.x, this.ego.y, this.lastEgoIndex);
    const pathHeading = this.path.cartesianAt(f.s).heading;
    const ctx: DriveContext = {
      v: this.ego.v,
      d: f.d,
      headingErr: wrapAngle(this.ego.yaw - pathHeading),
      curvature: this.path.signedCurvatureAt(f.s),
      laneIndex: this.road.laneOf(f.d),
      numLanes: this.road.numLanes,
      laneWidth: this.road.laneWidth,
      roadHalf: this.road.totalWidth / 2,
      egoS: f.s,
      L: this.path.length,
      desiredSpeed: this.baseDesiredSpeed,
      obstacles: this.lastObstacles.map((o) => ({ s: o.s, d: o.d, v: o.v, kind: o.kind, length: o.length })),
    };
    return extractFeatures(ctx);
  }

  /**
   * Automatic emergency braking. Returns a hard-braking acceleration if any
   * obstacle is imminently in the ego's path, else null. Used to shield the
   * learned drivers from collisions.
   */
  private safetyShield(f: FrenetPose): number | null {
    const L = this.path.length;
    const laneHalf = this.road.laneWidth * 0.6;
    let brake: number | null = null;
    for (const o of this.lastObstacles) {
      const fwd = mod(o.s - f.s, L);
      if (fwd <= 0 || fwd > 42) continue;
      const latTol = laneHalf + (o.kind === "ped" ? 1.6 : 0.4);
      if (Math.abs(o.d - f.d) > latTol) continue;
      const gap = fwd - (2.35 + o.length / 2);
      const closing = this.ego.v - o.v;
      const ttc = closing > 0.1 ? gap / closing : Infinity;
      if (gap < 4.5 || ttc < 1.7) brake = -this.ego.maxDecel;
    }
    return brake;
  }

  setControlMode(m: ControlMode): void {
    if (m !== this.controlMode) this.metrics.reset(); // fresh scorecard per driver
    this.controlMode = m;
  }

  /** Adverse weather degrades the sensor AND makes the ego drive more cautiously. */
  setWeather(w: Weather): void {
    this.weather = w;
    const s = this.sensor.config;
    if (w === "rain") {
      s.range = 68;
      s.dropout = 0.1;
      s.posNoise = 0.6;
      this.weatherSpeedFactor = 0.8;
    } else if (w === "fog") {
      s.range = 46;
      s.dropout = 0.07;
      s.posNoise = 0.5;
      this.weatherSpeedFactor = 0.62;
    } else {
      s.range = 95;
      s.dropout = 0.04;
      s.posNoise = 0.35;
      this.weatherSpeedFactor = 1;
    }
  }
  setCollecting(on: boolean): void {
    this.collecting = on;
  }
  trainImitation(epochs = 60) {
    return this.imitation.train(epochs);
  }

  /** Advance the simulation by one fixed step. */
  step(dt: number): void {
    if (this.paused) return;

    // --- perception (every step: sensor → Kalman tracks → occupancy) -------
    this.perceive(dt);

    // --- planning (rate-limited) -------------------------------------------
    this.planTimer += dt;
    if (this.planTimer >= this.config.planIntervalSec || !this.plan) {
      this.planTimer = 0;
      this.replan();
    }

    // --- control (every step) ----------------------------------------------
    // 1) The classical controller always runs — it's both a fallback and the
    //    expert whose actions the learned agent imitates.
    let classicalSteer = 0;
    let targetSpeed = this.planner.config.desiredSpeed;
    if (this.plan && this.plan.points.length >= 2) {
      // Stanley lateral control tracking the TARGET LANE CENTRE in the road's
      // Frenet frame (the plan chooses which lane + the speed; this holds it).
      const wb = EGO_DIMS.wheelbase;
      const fx = this.ego.x + (wb / 2) * Math.cos(this.ego.yaw);
      const fy = this.ego.y + (wb / 2) * Math.sin(this.ego.yaw);
      const ff = this.path.toFrenet(fx, fy, -1);
      const targetLaneD = this.road.laneCenter(this.plan.targetLane);
      const roadHeading = this.path.cartesianAt(ff.s).heading;
      const headingErr = wrapAngle(roadHeading - this.ego.yaw);
      const crossTrack = ff.d - targetLaneD; // +ve when ego is left of lane centre
      classicalSteer = stanleyControl(headingErr, crossTrack, this.ego.v, this.steerConfig);
      // Never target above the current desired-speed cap, so a stop command
      // (red light / yield / emergency) takes effect without the look-ahead lag.
      // Never target above the current desired-speed cap, so a stop command
      // (red light / yield / emergency) takes effect without the look-ahead lag.
      targetSpeed = Math.min(speedAtTime(this.plan, 0.8), this.planner.config.desiredSpeed);
    }
    const classicalAccel = this.speedPID.update(targetSpeed - this.ego.v, dt);

    // 2) Features + optional imitation data collection.
    const feat = this.buildFeatures();
    if (this.collecting) this.imitation.addSample(feat, classicalSteer, classicalAccel);

    // 3) Choose who drives.
    let steer = classicalSteer;
    let accel = classicalAccel;
    if (this.controlMode === "learned" && this.imitation.trained) {
      const a = this.imitation.act(feat);
      steer = a.steer;
      accel = a.accel;
    } else if (this.controlMode === "external" && this.externalPolicy) {
      const a = this.externalPolicy(feat);
      steer = a.steer;
      accel = a.accel;
    }

    // Safety shield for the learned drivers — a real AV's independent monitor:
    //   • Lane-keeping assist: blend toward the classical steer near the edge.
    //   • Automatic emergency braking: hard-brake if a collision is imminent.
    // A rough policy drives its own style but is never allowed to leave the road
    // or hit anything.
    if (this.controlMode !== "classical" && this.safetyShieldEnabled) {
      const f = this.path.toFrenet(this.ego.x, this.ego.y, this.lastEgoIndex);
      const roadHalf = this.road.totalWidth / 2;
      const over = Math.abs(f.d) - (roadHalf - 2.2);
      if (over > 0) {
        // Blend strongly toward the classical steer, and ease off the throttle
        // (coast, don't hard-brake) near the edge so the correction can catch it.
        const blend = clamp(over / 1.6, 0, 1);
        steer = steer * (1 - blend) + classicalSteer * blend;
        if (Math.abs(f.d) > roadHalf - 0.8) accel = Math.min(accel, 0);
      }
      const shield = this.safetyShield(f);
      if (shield !== null) accel = Math.min(accel, shield);
    }

    const prevX = this.ego.x;
    const prevY = this.ego.y;
    this.ego.step(steer, accel, dt);
    this.distance += Math.hypot(this.ego.x - prevX, this.ego.y - prevY);

    // Virtual guardrail for the learned drivers: keep them physically on the
    // road (a scrappy evolved policy is never allowed to end up in the grass).
    if (this.controlMode !== "classical" && this.safetyShieldEnabled) {
      const fg = this.path.toFrenet(this.ego.x, this.ego.y, this.lastEgoIndex);
      const lim = this.road.totalWidth / 2 - 0.3;
      if (Math.abs(fg.d) > lim) {
        const w = this.path.toCartesian(fg.s, Math.sign(fg.d) * lim);
        this.ego.x = w.x;
        this.ego.y = w.y;
        this.ego.v *= 0.9; // scrub speed against the barrier
      }
    }

    // --- traffic ------------------------------------------------------------
    const ef = this.path.toFrenet(this.ego.x, this.ego.y, this.lastEgoIndex);
    this.traffic.update(dt, { s: ef.s, d: ef.d, v: this.ego.v, length: EGO_DIMS.length });
    this.pedestrians.update(dt, ef.s, this.path.length);
    for (const lt of this.trafficLights) lt.update(dt);

    // --- live metrics (safety / comfort / efficiency) -----------------------
    const Lm = this.path.length;
    let collided = false;
    let minGap = Infinity;
    const laneHalf = this.road.laneWidth * 0.6;
    for (const c of this.traffic.cars) {
      const ds = wrapDiff(c.s, ef.s, Lm);
      const dd = c.d - ef.d;
      if (Math.abs(ds) < (2.35 + c.length / 2) * 0.8 && Math.abs(dd) < (1.0 + c.width / 2) * 0.75) collided = true;
      if (Math.abs(dd) < laneHalf && ds > 0) minGap = Math.min(minGap, ds - (2.35 + c.length / 2));
    }
    for (const p of this.pedestrians.peds) {
      if (p.state === "done") continue;
      if (Math.abs(wrapDiff(p.s, ef.s, Lm)) < 2.35 + p.radius && Math.abs(p.d - ef.d) < 1.0 + p.radius) collided = true;
    }
    const steerRate = (this.ego.delta - this.prevDelta) / dt;
    this.prevDelta = this.ego.delta;
    this.metrics.update({
      v: this.ego.v,
      accel: this.ego.a,
      steerRate,
      offRoad: Math.abs(ef.d) > this.road.totalWidth / 2,
      gap: minGap,
      collided,
      desiredSpeed: this.baseDesiredSpeed,
      dt,
    });

    // --- telemetry ----------------------------------------------------------
    this.telemetry.speed = this.ego.v;
    this.telemetry.targetSpeed = targetSpeed;
    this.telemetry.lane = this.road.laneOf(ef.d);
    this.telemetry.planCost = this.plan ? this.plan.cost : 0;
    this.telemetry.candidateCount = this.candidates.length;
    this.telemetry.planMs = this.lastPlanMs;
    this.telemetry.colliding = this.plan ? this.plan.colliding : false;
    this.telemetry.steer = this.ego.delta;
    this.telemetry.accel = this.ego.a;
    this.telemetry.distanceTravelled = this.distance;
    this.telemetry.trackedCount = this.tracks.length;
    this.telemetry.sensorRange = this.sensor.config.range;
    this.telemetry.usePerception = this.usePerception;
    this.telemetry.behaviorState = this.behaviorState;
    this.telemetry.pedCount = this.pedestrians.peds.filter((p) => p.state !== "done").length;
    this.telemetry.controlMode = this.controlMode;
  }
}

/** Sample a trajectory's speed at a given time offset (clamped to its horizon). */
function speedAtTime(traj: Trajectory, t: number): number {
  const pts = traj.points;
  if (pts.length === 0) return 0;
  for (let i = 0; i < pts.length; i++) {
    if (pts[i].t >= t) return clamp(pts[i].v, 0, 60);
  }
  return clamp(pts[pts.length - 1].v, 0, 60);
}
