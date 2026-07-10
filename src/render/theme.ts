// Blueline visual language — modelled on the Tesla FSD screen.
// The defining idea: a cool NAVY-BLUE world (never pure black), with a
// distinctly LIGHTER neutral-grey road that pops against it, crisp white lane
// lines, clean light-grey vehicles, and one confident electric blue reserved
// for the ego + its planned path (which then blooms).

export const THEME = {
  // Scene — the background is a vertical gradient built in Scene.ts from these.
  bgTop: 0x0e141e,
  bgHorizon: 0x243650,
  background: 0x141d2b,
  fog: 0x1c2942,
  ground: 0x172231,
  grid: 0x2f4058,

  // Road — a distinctly LIGHTER neutral grey that reads against the blue world.
  asphalt: 0x6b7280,
  asphaltEdge: 0x3c414b,
  shoulder: 0x2a3446,
  laneLine: 0xe2e8f1,
  edgeLine: 0xf2f5fa,
  delineator: 0x6fd0ff,
  delineatorWarm: 0xffb44d,

  // Ego + path (the one accent colour)
  egoBlue: 0x2e8bff,
  egoBlueBright: 0x5fb0ff,
  pathBlue: 0x2e8bff,
  pathBlueFaint: 0x1a4a7a,

  // Traffic — clean light grey, Tesla-style.
  trafficBody: 0xc4ccd6,
  trafficBodyDim: 0x9aa4b4,
  trafficAlert: 0xff5a5a,

  // Planner viz
  candidate: 0x35507a,
  candidateColliding: 0x7a2f42,
} as const;

// CSS custom-property equivalents for the DOM HUD.
export const CSS_VARS: Record<string, string> = {
  "--bl-bg": "#0e141e",
  "--bl-panel": "rgba(18, 26, 40, 0.72)",
  "--bl-panel-solid": "#121a28",
  "--bl-border": "rgba(90, 107, 140, 0.22)",
  "--bl-blue": "#2e8bff",
  "--bl-blue-bright": "#5fb0ff",
  "--bl-text": "#e8edf6",
  "--bl-text-dim": "#8b98af",
  "--bl-alert": "#ff5a5a",
};
