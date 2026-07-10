// FrenetPlanner — an optimal-trajectory-generation planner in the Frenet frame,
// following Werling et al. (ICRA 2010). This is the "brain" that draws the blue
// line every frame.
//
// Each cycle it:
//   1. Samples a LATTICE of candidate manoeuvres = { target lane } × { horizon
//      time T } × { target speed }.
//   2. For each candidate, builds a smooth motion:
//        - lateral   d(t): a QUINTIC from the current lateral state to the
//          target lane centre with zero end velocity/acceleration.
//        - longitudinal s(t): a QUARTIC "velocity-keeping" profile toward the
//          target speed.
//   3. Scores every candidate with a weighted cost of jerk (comfort), time,
//      speed error, lane-change effort, and proximity to traffic — and rejects
//      any that collide with predicted traffic or violate dynamic limits.
//   4. Returns the minimum-cost trajectory (plus all candidates, for the
//      "planner is thinking" visualisation).

import { QuarticPolynomial, QuinticPolynomial } from "../core/poly.ts";
import { wrapDiff } from "../core/math.ts";
import { Road } from "../world/Road.ts";
import { FrenetState, Obstacle, Trajectory, TrajPoint } from "./Trajectory.ts";

export interface PlannerConfig {
  dt: number; // sampling step within a trajectory (s)
  horizons: number[]; // candidate planning horizons T (s)
  speedSamples: number; // number of target-speed samples
  desiredSpeed: number; // ego's target cruising speed (m/s)
  maxSpeed: number;
  maxAccel: number;
  maxCurvature: number;
  // Cost weights.
  kJerk: number;
  kTime: number;
  kSpeed: number;
  kLaneChange: number;
  kProximity: number;
  kOffCenter: number;
  // Safety margins for collision prediction (added to half-extents).
  lonMargin: number;
  latMargin: number;
}

export const DEFAULT_PLANNER: PlannerConfig = {
  dt: 0.2,
  horizons: [3.0, 4.5],
  speedSamples: 6,
  desiredSpeed: 24,
  maxSpeed: 40,
  maxAccel: 6.5,
  maxCurvature: 0.25,
  kJerk: 0.08,
  kTime: 0.5,
  kSpeed: 0.8,
  kLaneChange: 6.0,
  kProximity: 40.0,
  kOffCenter: 0.4,
  lonMargin: 3.0,
  latMargin: 0.6,
};

const COLLISION_COST = 1e6;
const INFEASIBLE_COST = 1e5;

export interface PlanResult {
  best: Trajectory | null;
  candidates: Trajectory[];
}

export class FrenetPlanner {
  config: PlannerConfig;

  constructor(private road: Road, config: Partial<PlannerConfig> = {}) {
    this.config = { ...DEFAULT_PLANNER, ...config };
  }

  plan(state: FrenetState, obstacles: Obstacle[], currentLane: number): PlanResult {
    const cfg = this.config;
    const L = this.road.path.length;
    const candidates: Trajectory[] = [];

    const targetLanes: number[] = [];
    for (let i = 0; i < this.road.numLanes; i++) targetLanes.push(i);

    for (const lane of targetLanes) {
      const dTarget = this.road.laneCenter(lane);
      for (const T of cfg.horizons) {
        const lat = new QuinticPolynomial(
          state.d, state.dDot, state.dDdot,
          dTarget, 0, 0,
          T,
        );
        for (let k = 0; k < cfg.speedSamples; k++) {
          // Target speeds fan out from desired down toward a stop, so the
          // planner can choose to slow behind traffic (emergent ACC).
          const frac = k / Math.max(1, cfg.speedSamples - 1);
          const vTarget = cfg.desiredSpeed * (1 - frac);
          const lon = new QuarticPolynomial(state.s, state.sDot, state.sDdot, vTarget, 0, T);

          const traj = this.build(lat, lon, T, lane, currentLane, dTarget, vTarget, obstacles, L);
          candidates.push(traj);
        }
      }
    }

    let best: Trajectory | null = null;
    for (const c of candidates) {
      if (!best || c.cost < best.cost) best = c;
    }
    return { best, candidates };
  }

  private build(
    lat: QuinticPolynomial,
    lon: QuarticPolynomial,
    T: number,
    lane: number,
    currentLane: number,
    dTarget: number,
    vTarget: number,
    obstacles: Obstacle[],
    L: number,
  ): Trajectory {
    const cfg = this.config;
    const points: TrajPoint[] = [];

    let jerkSq = 0;
    let feasible = true;
    let colliding = false;
    let proximityCost = 0;
    let maxV = 0;

    const steps = Math.max(2, Math.ceil(T / cfg.dt));
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * T;
      const s = lon.pos(t);
      const d = lat.pos(t);
      const sDot = lon.vel(t);
      const dDot = lat.vel(t);
      const sDdot = lon.acc(t);
      const latJerk = lat.jerk(t);
      const lonJerk = lon.jerk(t);

      const speed = Math.hypot(sDot, dDot);
      maxV = Math.max(maxV, speed);
      jerkSq += (latJerk * latJerk + lonJerk * lonJerk) * cfg.dt;

      // Dynamic feasibility: acceleration & approximate path curvature.
      const accel = Math.hypot(sDdot, lat.acc(t));
      if (accel > cfg.maxAccel) feasible = false;
      if (speed > cfg.maxSpeed + 1) feasible = false;
      const curvature = speed > 0.5 ? Math.abs(lat.acc(t)) / (speed * speed) : 0;
      if (curvature > cfg.maxCurvature) feasible = false;

      const world = this.road.path.toCartesian(s, d);
      points.push({ t, s, d, x: world.x, y: world.y, v: sDot });

      // Collision / proximity against predicted traffic.
      for (const ob of obstacles) {
        const obS = ob.s + ob.v * t;
        const ds = wrapDiff(s, obS, L);
        const dd = d - ob.d;
        const lonReach = 2.35 + ob.length / 2 + cfg.lonMargin; // ego half-len ~2.35
        const latReach = 1.0 + ob.width / 2 + cfg.latMargin; // ego half-width ~1.0
        if (Math.abs(ds) < lonReach && Math.abs(dd) < latReach) {
          colliding = true;
        }
        // Soft proximity term: only cars roughly ahead & nearby matter.
        if (ds > -6 && ds < 35 && Math.abs(dd) < 4) {
          const gap = Math.max(Math.abs(ds) - lonReach, 0.5);
          proximityCost += 1 / gap;
        }
      }
    }

    // ---- cost assembly -----------------------------------------------------
    const laneChangeCost = cfg.kLaneChange * Math.abs(lane - currentLane);
    const speedCost = cfg.kSpeed * (cfg.desiredSpeed - vTarget) ** 2;
    const offCenterCost = cfg.kOffCenter * dTarget * dTarget * 0; // reserved; lanes handle this
    const comfort = cfg.kJerk * jerkSq + cfg.kTime * T;

    let cost = comfort + speedCost + laneChangeCost + offCenterCost + cfg.kProximity * proximityCost;
    if (!feasible) cost += INFEASIBLE_COST;
    if (colliding) cost += COLLISION_COST;

    return { points, targetSpeed: vTarget, targetLane: lane, cost, colliding, feasible };
  }
}
