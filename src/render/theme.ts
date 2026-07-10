// Blueline visual language — a restrained, Tesla-inspired dark palette.
// The whole look leans on: a near-black desaturated background, matte grey
// vehicles that only gain colour when they matter, and one confident electric
// blue reserved for the ego + its planned path (which then blooms).

export const THEME = {
  // Scene
  background: 0x090c12,
  fog: 0x090c12,
  ground: 0x0e141d,
  grid: 0x1b2534,

  // Road — asphalt is deliberately LIGHTER than the ground so the ribbon reads.
  asphalt: 0x2b303b,
  asphaltEdge: 0x22262f,
  shoulder: 0x1a1e26,
  laneLine: 0x9aa6bd,
  edgeLine: 0xd8dee8,
  delineator: 0x6fd0ff,
  delineatorWarm: 0xffb44d,

  // Ego + path (the one accent colour)
  egoBlue: 0x2e8bff,
  egoBlueBright: 0x5fb0ff,
  pathBlue: 0x2e8bff,
  pathBlueFaint: 0x14385f,

  // Traffic
  trafficBody: 0x9aa6bd,
  trafficBodyDim: 0x6d7891,
  trafficAlert: 0xff5a5a,

  // Planner viz
  candidate: 0x2a3550,
  candidateColliding: 0x5c2230,
} as const;

// CSS custom-property equivalents for the DOM HUD.
export const CSS_VARS: Record<string, string> = {
  "--bl-bg": "#0a0e14",
  "--bl-panel": "rgba(16, 22, 33, 0.72)",
  "--bl-panel-solid": "#10161f",
  "--bl-border": "rgba(90, 107, 140, 0.22)",
  "--bl-blue": "#2e8bff",
  "--bl-blue-bright": "#5fb0ff",
  "--bl-text": "#e8edf6",
  "--bl-text-dim": "#8b98af",
  "--bl-alert": "#ff5a5a",
};
