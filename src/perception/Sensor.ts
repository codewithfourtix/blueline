// Sensor — a simplified perception front-end. Instead of ground-truth objects,
// the ego only "sees" what is within range and not occluded by a nearer object,
// every measurement is corrupted by Gaussian noise, and a fraction of detections
// randomly drop out. Cars AND pedestrians flow through the same sensor, so the
// downstream tracker/planner must cope with small, slow, laterally-moving,
// sometimes-late (occluded) objects.

import { ObstacleKind } from "../planner/Trajectory.ts";

export interface SensableObject {
  x: number;
  y: number;
  length: number;
  width: number;
  kind: ObstacleKind;
}

export interface Detection {
  x: number;
  y: number;
  length: number;
  width: number;
  kind: ObstacleKind;
}

export interface SensorConfig {
  range: number;
  posNoise: number;
  sizeNoise: number;
  occlusion: boolean;
  dropout: number; // probability [0,1] a given in-range detection is missed
}

export const DEFAULT_SENSOR: SensorConfig = {
  range: 95,
  posNoise: 0.35,
  sizeNoise: 0.15,
  occlusion: true,
  dropout: 0.04,
};

function randn(): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export class Sensor {
  config: SensorConfig;

  constructor(config: Partial<SensorConfig> = {}) {
    this.config = { ...DEFAULT_SENSOR, ...config };
  }

  /** Produce noisy detections of the objects the ego can currently perceive. */
  sense(egoX: number, egoY: number, objects: SensableObject[]): Detection[] {
    const cfg = this.config;

    const cand = objects
      .map((o) => {
        const dx = o.x - egoX;
        const dy = o.y - egoY;
        return { o, dist: Math.hypot(dx, dy), bearing: Math.atan2(dy, dx) };
      })
      .filter((c) => c.dist <= cfg.range)
      .sort((a, b) => a.dist - b.dist);

    const detections: Detection[] = [];
    const blockers: { bearing: number; halfAngle: number }[] = [];

    for (const c of cand) {
      const o = c.o;
      // Angular half-width this object subtends at its range.
      const half = Math.atan2(Math.max(o.width, o.length) / 2, Math.max(c.dist, 1));

      if (cfg.occlusion) {
        let occluded = false;
        for (const b of blockers) {
          let db = Math.abs(c.bearing - b.bearing);
          if (db > Math.PI) db = 2 * Math.PI - db;
          if (db < b.halfAngle * 0.8) {
            occluded = true;
            break;
          }
        }
        // Only solid, wide objects (vehicles) meaningfully occlude.
        if (o.kind === "car") blockers.push({ bearing: c.bearing, halfAngle: half });
        if (occluded) continue;
      }

      // Random dropout of an otherwise-visible object.
      if (Math.random() < cfg.dropout) continue;

      detections.push({
        x: o.x + randn() * cfg.posNoise,
        y: o.y + randn() * cfg.posNoise,
        length: Math.max(0.5, o.length + randn() * cfg.sizeNoise),
        width: Math.max(0.5, o.width + randn() * cfg.sizeNoise),
        kind: o.kind,
      });
    }
    return detections;
  }
}
