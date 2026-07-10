// Blueline visual language — a restrained, Tesla-inspired dark palette.
// The whole look leans on: a near-black desaturated background, matte grey
// vehicles that only gain colour when they matter, and one confident electric
// blue reserved for the ego + its planned path (which then blooms).

export const THEME = {
  // Scene
  background: 0x0a0e14,
  fog: 0x0a0e14,
  ground: 0x0c1119,
  grid: 0x161d29,

  // Road
  asphalt: 0x151a22,
  laneLine: 0x3a4763,
  edgeLine: 0x5b6b8c,

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
