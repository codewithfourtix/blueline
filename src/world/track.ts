// Track definitions — the road network the ego drives. Coordinates are metres.
//
// The default is a CITY LOOP: long straight "streets" joined by rounded 90°
// junction turns, so the ego actually drives an urban block circuit (slowing
// hard for the corners) rather than a lazy oval. The loop is closed so the ego
// drives forever. Junction turn radii are large enough (~30 m) to keep the
// Frenet frame well-behaved while still reading as square city blocks.

export interface TrackDef {
  id: string;
  name: string;
  controlPoints: [number, number][];
  /** Approximate corner centres (world x,y) — junctions get lights + cross-streets. */
  junctions: [number, number][];
}

// Walk the perimeter of a rounded rectangle emitting UNIFORMLY-spaced points
// (straights + quarter-circle corners), so the Catmull-Rom spline stays clean
// through the junctions (uneven spacing makes it overshoot).
function cityLoop(halfW: number, halfH: number, r: number): { pts: [number, number][]; corners: [number, number][] } {
  const pts: [number, number][] = [];
  const corners: [number, number][] = [];
  const step = 9; // ~metres between points

  const emitStraight = (x0: number, y0: number, x1: number, y1: number) => {
    const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / step));
    for (let i = 0; i < n; i++) {
      const t = i / n;
      pts.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]);
    }
  };
  const emitArc = (cx: number, cy: number, a0: number, a1: number) => {
    const n = Math.max(3, Math.round((Math.abs(a1 - a0) * r) / step));
    for (let i = 0; i < n; i++) {
      const a = a0 + (a1 - a0) * (i / n);
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
    corners.push([cx, cy]);
  };

  // Corners counter-clockwise from the bottom-right.
  const C = [
    { cx: halfW - r, cy: -halfH + r, a0: -Math.PI / 2, a1: 0 },
    { cx: halfW - r, cy: halfH - r, a0: 0, a1: Math.PI / 2 },
    { cx: -halfW + r, cy: halfH - r, a0: Math.PI / 2, a1: Math.PI },
    { cx: -halfW + r, cy: -halfH + r, a0: Math.PI, a1: 1.5 * Math.PI },
  ];
  for (let i = 0; i < 4; i++) {
    emitArc(C[i].cx, C[i].cy, C[i].a0, C[i].a1);
    const ex = C[i].cx + r * Math.cos(C[i].a1);
    const ey = C[i].cy + r * Math.sin(C[i].a1);
    const next = C[(i + 1) % 4];
    const sx = next.cx + r * Math.cos(next.a0);
    const sy = next.cy + r * Math.sin(next.a0);
    emitStraight(ex, ey, sx, sy);
  }
  return { pts, corners };
}

const loop = cityLoop(360, 250, 40);

export const CIRCUIT: TrackDef = {
  id: "city",
  name: "City Loop",
  controlPoints: loop.pts,
  junctions: loop.corners,
};

export const DEFAULT_TRACK = CIRCUIT;
