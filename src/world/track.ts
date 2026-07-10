// Track definitions — closed-loop control-point sets fed to ReferencePath.
// Coordinates are in metres. A closed loop lets the ego drive forever, which is
// ideal for a demo (no "end of road" edge cases).

export interface TrackDef {
  id: string;
  name: string;
  controlPoints: [number, number][];
}

// A flowing circuit: long sweepers, a hairpin-ish tightening, and an S-bend so
// the Frenet planner has genuinely curved geometry to solve (not just a ring).
export const CIRCUIT: TrackDef = {
  id: "circuit",
  name: "Circuit",
  controlPoints: [
    [0, 0],
    [140, -10],
    [250, 20],
    [320, 110],
    [300, 210],
    [220, 250],
    [120, 235],
    [60, 275],
    [-40, 300],
    [-140, 250],
    [-170, 150],
    [-120, 60],
    [-40, 40],
  ],
};

export const DEFAULT_TRACK = CIRCUIT;
