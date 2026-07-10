// Track definitions — closed-loop control-point sets fed to ReferencePath.
// Coordinates are in metres. A closed loop lets the ego drive forever, which is
// ideal for a demo (no "end of road" edge cases).

export interface TrackDef {
  id: string;
  name: string;
  controlPoints: [number, number][];
}

// A large, smooth highway loop generated as an ellipse. Evenly-spaced points
// mean the Catmull-Rom spline has gentle, uniform curvature everywhere (no tight
// kinks), so the ego can comfortably hold its lane at speed. Big semi-axes keep
// the minimum radius large (~150 m).
function ellipseLoop(a: number, b: number, n: number): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    pts.push([a * Math.cos(t), b * Math.sin(t)]);
  }
  return pts;
}

export const CIRCUIT: TrackDef = {
  id: "circuit",
  name: "Highway Loop",
  controlPoints: ellipseLoop(400, 260, 32),
};

export const DEFAULT_TRACK = CIRCUIT;
