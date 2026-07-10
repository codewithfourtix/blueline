// Sensor — a simplified perception front-end. Instead of handing the planner
// ground-truth traffic, the ego now only "sees" objects that are within sensor
// range and not occluded by a nearer vehicle, and every measurement is corrupted
// by Gaussian noise. This is what forces the rest of the stack (tracker →
// prediction → planning) to cope with real, imperfect perception.

import { TrafficCar } from "../traffic/TrafficManager.ts";
import { ReferencePath } from "../world/ReferencePath.ts";

export interface Detection {
  x: number;
  y: number;
  length: number; // measured extent (noisy)
  width: number;
}

export interface SensorConfig {
  range: number; // detection radius (m)
  posNoise: number; // std-dev of position noise (m)
  sizeNoise: number; // std-dev of size noise (m)
  occlusion: boolean; // drop objects hidden behind a nearer one
}

export const DEFAULT_SENSOR: SensorConfig = {
  range: 95,
  posNoise: 0.35,
  sizeNoise: 0.15,
  occlusion: true,
};

// Box–Muller standard normal.
function randn(): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export class Sensor {
  config: SensorConfig;

  constructor(private path: ReferencePath, config: Partial<SensorConfig> = {}) {
    this.config = { ...DEFAULT_SENSOR, ...config };
  }

  /** Produce noisy detections of the cars the ego can currently perceive. */
  sense(egoX: number, egoY: number, cars: TrafficCar[]): Detection[] {
    const cfg = this.config;

    // Gather in-range candidates with their true world positions & bearings.
    const cand = cars
      .map((c) => {
        const w = this.path.toCartesian(c.s, c.d);
        const dx = w.x - egoX;
        const dy = w.y - egoY;
        const dist = Math.hypot(dx, dy);
        return { c, x: w.x, y: w.y, dist, bearing: Math.atan2(dy, dx) };
      })
      .filter((o) => o.dist <= cfg.range)
      .sort((a, b) => a.dist - b.dist);

    const detections: Detection[] = [];
    const takenBearings: { bearing: number; halfAngle: number }[] = [];

    for (const o of cand) {
      if (cfg.occlusion) {
        // Angular half-width this object subtends at its range.
        const half = Math.atan2(Math.max(o.c.width, o.c.length) / 2, Math.max(o.dist, 1));
        let occluded = false;
        for (const t of takenBearings) {
          let db = Math.abs(o.bearing - t.bearing);
          if (db > Math.PI) db = 2 * Math.PI - db;
          if (db < t.halfAngle * 0.8) {
            occluded = true;
            break;
          }
        }
        takenBearings.push({ bearing: o.bearing, halfAngle: half });
        if (occluded) continue;
      }

      detections.push({
        x: o.x + randn() * cfg.posNoise,
        y: o.y + randn() * cfg.posNoise,
        length: Math.max(3, o.c.length + randn() * cfg.sizeNoise),
        width: Math.max(1.4, o.c.width + randn() * cfg.sizeNoise),
      });
    }
    return detections;
  }
}
