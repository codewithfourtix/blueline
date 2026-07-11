// Blueline visual language — a clean, NON-BLUE dark theme. The world is neutral
// dark grey (no navy tint), the road a neutral grey, and the single accent is a
// confident teal-green reserved for the ego + its planned path (which then
// blooms). Vehicles stay light grey; lane lines crisp white.

export const THEME = {
  // Scene — neutral dark-grey gradient world (built in Scene.ts from these).
  bgTop: 0x101114,
  bgHorizon: 0x2b2e34,
  background: 0x191b1f,
  fog: 0x1d1f23,
  ground: 0x202227,
  grid: 0x363940,

  // Road — neutral grey (no blue), clearly lighter than the ground.
  asphalt: 0x4c4f56,
  asphaltEdge: 0x3c3f45,
  shoulder: 0x2c2f35,
  laneLine: 0xe4e6ea,
  edgeLine: 0xf3f4f6,
  delineator: 0x3fe0a8,
  delineatorWarm: 0xffb44d,

  // Ego + path — the one accent colour (teal-green).
  egoBlue: 0x1fd18b,
  egoBlueBright: 0x5fe6ad,
  pathBlue: 0x1fd18b,
  pathBlueFaint: 0x134e3a,

  // Traffic — clean light grey.
  trafficBody: 0xc6cace,
  trafficBodyDim: 0x9ba0a6,
  trafficAlert: 0xff6a4d,

  // Planner viz
  candidate: 0x3a4048,
  candidateColliding: 0x6e3038,
} as const;

// CSS custom-property equivalents for the DOM HUD.
export const CSS_VARS: Record<string, string> = {
  "--bl-bg": "#191b1f",
  "--bl-panel": "rgba(28, 30, 34, 0.74)",
  "--bl-panel-solid": "#1c1e22",
  "--bl-border": "rgba(120, 126, 134, 0.22)",
  "--bl-blue": "#1fd18b",
  "--bl-blue-bright": "#5fe6ad",
  "--bl-text": "#e9ebe9",
  "--bl-text-dim": "#8b9099",
  "--bl-alert": "#ff6a4d",
};
