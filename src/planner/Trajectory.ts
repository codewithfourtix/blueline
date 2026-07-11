// Shared trajectory types produced by the Frenet planner and consumed by the
// controller and the renderer.

export interface TrajPoint {
  t: number; // time from now (s)
  s: number; // station
  d: number; // lateral offset
  x: number; // world x
  y: number; // world y
  v: number; // speed at this point (m/s)
}

export interface Trajectory {
  points: TrajPoint[];
  targetSpeed: number; // terminal speed this trajectory aims for
  targetLane: number;
  cost: number;
  colliding: boolean;
  feasible: boolean;
}

export interface FrenetState {
  s: number;
  d: number;
  sDot: number; // ds/dt  (≈ speed along the road)
  sDdot: number; // d²s/dt²
  dDot: number; // dd/dt  (lateral velocity)
  dDdot: number; // d²d/dt²
  index: number; // nearest reference-sample hint
}

export type ObstacleKind = "car" | "ped";

// Lightweight obstacle used for the planner's forward collision prediction.
export interface Obstacle {
  s: number;
  d: number;
  v: number; // along-road velocity
  vd: number; // lateral velocity (crossing pedestrians move in d)
  length: number;
  width: number;
  kind: ObstacleKind;
}
