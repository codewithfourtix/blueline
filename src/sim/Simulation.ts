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

import { ReferencePath } from "../world/ReferencePath.ts";
import { Road } from "../world/Road.ts";
import { DEFAULT_TRACK } from "../world/track.ts";
import { Vehicle, EGO_DIMS } from "../vehicle/Vehicle.ts";
import { PID } from "../control/PID.ts";
import { purePursuitSteer, PurePursuitConfig } from "../control/PurePursuit.ts";
import { TrafficManager } from "../traffic/TrafficManager.ts";
import { FrenetPlanner } from "../planner/FrenetPlanner.ts";
import { FrenetState, Obstacle, Trajectory } from "../planner/Trajectory.ts";
import { Sensor } from "../perception/Sensor.ts";
import { Tracker, Track } from "../perception/Tracker.ts";
import { OccupancyGrid } from "../perception/OccupancyGrid.ts";
import { clamp, wrapAngle } from "../core/math.ts";
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

  plan: Trajectory | null = null;
  candidates: Trajectory[] = [];
  tracks: Track[] = [];
  telemetry: Telemetry;
  paused = false;
  showCandidates = true;
  /** When true the planner drives off Kalman tracks; when false, ground truth. */
  usePerception = true;

  private speedPID: PID;
  private ppConfig: PurePursuitConfig;
  private planTimer = 0;
  private lastEgoIndex = -1;
  private lastPlanMs = 0;
  private distance = 0;

  constructor(config: Partial<SimConfig> = {}) {
    this.config = { ...DEFAULT_SIM, ...config };

    this.path = new ReferencePath(DEFAULT_TRACK.controlPoints);
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

    this.sensor = new Sensor(this.path);
    this.tracker = new Tracker();
    this.occupancy = new OccupancyGrid(50, 2);

    this.speedPID = new PID(1.2, 0.15, 0.05, -this.ego.maxDecel, this.ego.maxAccel);
    this.ppConfig = {
      wheelbase: EGO_DIMS.wheelbase,
      gain: 0.6,
      minLookahead: 5,
      maxLookahead: 22,
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
    };

    // Prime perception + the first plan so control has something on frame 1.
    this.perceive(this.config.fixedDt);
    this.replan();
  }

  setDesiredSpeed(v: number): void {
    this.planner.config.desiredSpeed = v;
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
    this.traffic.spawn(this.config.trafficCount);
    this.tracker.reset();
    this.tracks = [];
    this.perceive(this.config.fixedDt);
    this.replan();
  }

  setSensorRange(r: number): void {
    this.sensor.config.range = r;
  }

  /** Current ego state expressed in the road's Frenet frame. */
  private egoFrenet(): FrenetState {
    const f = this.path.toFrenet(this.ego.x, this.ego.y, this.lastEgoIndex);
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
      return this.traffic.cars.map((c) => ({
        s: c.s, d: c.d, v: c.v, length: c.length, width: c.width,
      }));
    }
    // Project each confirmed Kalman track into the road's Frenet frame, using
    // its ESTIMATED velocity for the along-road speed (real prediction).
    return this.tracks.map((t) => {
      const f = this.path.toFrenet(t.px, t.py);
      const h = this.path.cartesianAt(f.s).heading;
      const vAlong = t.vx * Math.cos(h) + t.vy * Math.sin(h);
      return { s: f.s, d: f.d, v: vAlong, length: t.length, width: t.width };
    });
  }

  /** Run the perception pipeline: sensor → tracker → occupancy grid. */
  private perceive(dt: number): void {
    const detections = this.sensor.sense(this.ego.x, this.ego.y, this.traffic.cars);
    this.tracks = this.tracker.update(detections, dt);
    this.occupancy.build(this.ego.x, this.ego.y, this.tracks);
  }

  private replan(): void {
    const state = this.egoFrenet();
    const currentLane = this.road.laneOf(state.d);
    const t0 = performance.now();
    const result = this.planner.plan(state, this.obstacles(), currentLane);
    this.lastPlanMs = performance.now() - t0;
    this.plan = result.best;
    this.candidates = result.candidates;
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
    let steer = 0;
    let targetSpeed = this.planner.config.desiredSpeed;
    if (this.plan && this.plan.points.length >= 2) {
      steer = purePursuitSteer(
        this.ego.x, this.ego.y, this.ego.yaw, this.ego.v,
        this.plan.points,
        this.ppConfig,
      );
      // Target the planned speed ~0.8 s ahead for a responsive but smooth ACC.
      targetSpeed = speedAtTime(this.plan, 0.8);
    }
    const accel = this.speedPID.update(targetSpeed - this.ego.v, dt);

    const prevX = this.ego.x;
    const prevY = this.ego.y;
    this.ego.step(steer, accel, dt);
    this.distance += Math.hypot(this.ego.x - prevX, this.ego.y - prevY);

    // --- traffic ------------------------------------------------------------
    const ef = this.path.toFrenet(this.ego.x, this.ego.y, this.lastEgoIndex);
    this.traffic.update(dt, { s: ef.s, d: ef.d, v: this.ego.v, length: EGO_DIMS.length });

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
