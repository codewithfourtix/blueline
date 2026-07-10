# 🔵 Blueline — Autonomous Driving Simulator

**A self-driving car, in your browser — running a real autonomous-vehicle software stack, visualised like a Tesla.**

Blueline is not a car *game*. It is a working implementation of the same
modular autonomy pipeline used in real self-driving research — perception →
prediction → planning → control — wrapped in a clean, Tesla-inspired 3D
visualisation. The ego car perceives surrounding traffic, predicts where it's
going, plans an optimal path in real time (the glowing **blue line**), and
steers + brakes itself to follow it. All at 60 FPS, entirely client-side.

> **Live demo:** enable GitHub Pages for this repo (Settings → Pages → Source:
> _GitHub Actions_) and it deploys automatically → `https://codewithfourtix.github.io/blueline/`

---

## What it actually does

- 🧠 **Plans in real time.** A **Frenet-frame lattice planner** generates dozens
  of candidate trajectories every cycle, scores each on comfort, speed, and
  safety, rejects any that collide with predicted traffic, and renders the
  winner as the blue path — exactly the technique from Werling et al. (ICRA 2010).
- 🚗 **Drives itself.** **Pure Pursuit** geometric steering + a **PID** speed
  controller track the planned path. Emergent adaptive cruise + autonomous
  overtaking fall straight out of the cost function.
- 🛣️ **Shares the road.** Ambient traffic runs the **Intelligent Driver Model
  (IDM)** for car-following and **MOBIL** for lane-change decisions — the
  standard models from traffic-flow research — and reacts to the ego too.
- 👁️ **Shows its thinking.** Toggle the planner's full candidate lattice to
  watch it evaluate and discard paths in real time. This is the part that makes
  people go "wait, that's actually reasoning."
- 🎛️ **Fully interactive.** Change target speed, add/remove traffic, switch
  camera, pause, reset — live.

---

## The autonomy stack

| Layer | Technique | Where |
|---|---|---|
| **World / road model** | Closed-loop centreline with arc-length **Frenet frame** (station `s`, lateral `d`) | [`world/ReferencePath.ts`](src/world/ReferencePath.ts) |
| **Perception** | Ground-truth obstacle extraction in the Frenet frame | [`sim/Simulation.ts`](src/sim/Simulation.ts) |
| **Prediction** | Constant-velocity forward roll of traffic | [`planner/FrenetPlanner.ts`](src/planner/FrenetPlanner.ts) |
| **Planning** | **Frenet lattice**: quintic (lateral) + quartic (longitudinal) polynomials, cost-based selection, collision checking | [`planner/FrenetPlanner.ts`](src/planner/FrenetPlanner.ts) · [`core/poly.ts`](src/core/poly.ts) |
| **Control** | **Pure Pursuit** steering + **PID** speed | [`control/`](src/control) |
| **Vehicle model** | **Kinematic bicycle model** | [`vehicle/Vehicle.ts`](src/vehicle/Vehicle.ts) |
| **Traffic** | **IDM** (following) + **MOBIL** (lane changes) | [`traffic/`](src/traffic) |
| **Visualisation** | Three.js + UnrealBloom, Tesla-style HUD | [`render/`](src/render) · [`ui/`](src/ui) |

The entire simulation core (`src/core`, `world`, `vehicle`, `control`,
`traffic`, `planner`, `sim`) is **decoupled from the renderer** — it imports no
Three.js and runs headless, which is why it can be smoke-tested in Node.

---

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

```bash
npm run build      # typecheck + production bundle -> dist/
npm run typecheck  # tsc --noEmit
```

### Headless smoke test

Runs the full stack for 50 simulated seconds with no browser and asserts it
drives cleanly (no NaNs, real forward progress, live re-planning):

```bash
npx esbuild scripts/smoke.ts --bundle --platform=node --format=esm --outfile=smoke.mjs && node smoke.mjs
```

```
SMOKE PASS
  distance travelled : 1.01 km
  speed range        : 14.0 – 28.0 m/s
  ego lane changes   : 4          # autonomous overtakes
  plan time (last)   : 0.69 ms    # 10 Hz planning, easily real-time
```

---

## Tech

**TypeScript · Three.js · Vite.** No backend, no build-time secrets, deploys as
a static site. Sim runs on a fixed timestep (deterministic physics/planning)
decoupled from the render loop.

## Roadmap

- [ ] Traffic lights + intersections + stop-line planning
- [ ] Occupancy-grid perception from simulated "sensors" instead of ground truth
- [ ] A learned driving policy (imitation / RL) benchmarked against the classical planner
- [ ] Recorded scenarios + a "hard cases" gallery

---

Built by [@codewithfourtix](https://github.com/codewithfourtix).
