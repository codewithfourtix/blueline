// Central tunables for the simulation. Anything the UI can change lives here.

export interface SimConfig {
  numLanes: number;
  laneWidth: number;
  trafficCount: number;
  egoDesiredSpeed: number; // m/s
  planIntervalSec: number; // how often the Frenet planner re-plans
  fixedDt: number; // physics/control step (s)
}

export const DEFAULT_SIM: SimConfig = {
  numLanes: 3,
  laneWidth: 3.7,
  trafficCount: 16,
  egoDesiredSpeed: 26, // ~94 km/h
  planIntervalSec: 0.1, // 10 Hz planning, 60 Hz control
  fixedDt: 1 / 60,
};
