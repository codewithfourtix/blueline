# 🔵 Blueline — Autonomous Driving Simulator

**A self-driving car, in your browser — running a real autonomous-vehicle software stack, visualised like a Tesla.**

Blueline is not a car *game*. It is a working implementation of the same
modular autonomy pipeline used in real self-driving research — **perception →
tracking → prediction → behaviour → planning → control** — wrapped in a clean,
Tesla-inspired 3D visualisation. A simulated sensor sees nearby traffic through
noise and occlusion, a bank of Kalman filters tracks each object and estimates
its velocity, a behaviour state machine decides the manoeuvre, and a Frenet
lattice planner draws the optimal path in real time (the glowing **blue line**)
which the car then steers and brakes itself to follow. All at 60 FPS, entirely
client-side.

> **Deploy:** it's a static site — `npm run build` produces `dist/`, which drops
> straight onto any static host (Vercel, Netlify, Cloudflare Pages, S3, …).

---

## What it actually does

- 👁️ **Perceives, doesn't cheat.** A simulated range sensor only reports cars
  within range and line-of-sight, with Gaussian noise. A **Kalman-filter
  multi-object tracker** turns those messy detections into stable tracks with
  estimated velocity — and coasts through brief occlusions. The planner drives
  off these tracks, not ground truth (toggle to compare).
- 🧠 **Plans in real time.** A **Frenet-frame lattice planner** generates dozens
  of candidate trajectories every cycle, scores each on comfort, speed, and
  safety, rejects any that collide with *predicted* traffic, and renders the
  winner as the blue path — the technique from Werling et al. (ICRA 2010).
- 🚦 **Decides like a driver.** A **behaviour state machine** (CRUISE / FOLLOW /
  OVERTAKE / EMERGENCY) sits above the planner: it does proper adaptive-cruise
  following, pulls out to overtake when a lane is clear, and hard-stops for
  hazards. The current state is shown live in the HUD.
- 🚗 **Drives itself.** **Pure Pursuit** geometric steering + a **PID** speed
  controller track the planned path via a **kinematic bicycle model**.
- 🛣️ **Shares the road.** Ambient traffic runs the **Intelligent Driver Model
  (IDM)** for car-following and **MOBIL** for lane-change decisions — the
  standard models from traffic-flow research — and reacts to the ego too.
- 🎬 **Scenarios.** One click to throw a **slow truck convoy**, a **stalled car**
  in your lane, an **aggressive cut-in**, or **dense traffic** at the planner.
- 👁️ **Shows its thinking.** Toggle overlays for the planner's full candidate
  lattice, the perceived **track boxes + velocity vectors**, the **occupancy
  grid**, and the **sensor range** — watch the autonomy reason in real time.

---

## The autonomy stack

| Layer | Technique | Where |
|---|---|---|
| **World / road model** | Closed-loop centreline with arc-length **Frenet frame** (station `s`, lateral `d`) | [`world/ReferencePath.ts`](src/world/ReferencePath.ts) |
| **Perception (sensing)** | Range + line-of-sight **sensor** with Gaussian noise & occlusion | [`perception/Sensor.ts`](src/perception/Sensor.ts) |
| **Perception (tracking)** | **Kalman-filter** multi-object tracker (constant-velocity), NN data association, track lifecycle | [`perception/Tracker.ts`](src/perception/Tracker.ts) |
| **Occupancy** | Ego-centred **occupancy grid** from tracks | [`perception/OccupancyGrid.ts`](src/perception/OccupancyGrid.ts) |
| **Prediction** | Constant-velocity roll of each track's *estimated* velocity | [`planner/FrenetPlanner.ts`](src/planner/FrenetPlanner.ts) |
| **Behaviour** | **FSM**: CRUISE / FOLLOW / OVERTAKE / EMERGENCY | [`behavior/BehaviorPlanner.ts`](src/behavior/BehaviorPlanner.ts) |
| **Planning** | **Frenet lattice**: quintic (lateral) + quartic (longitudinal) polynomials, cost-based selection, collision checking | [`planner/FrenetPlanner.ts`](src/planner/FrenetPlanner.ts) · [`core/poly.ts`](src/core/poly.ts) |
| **Control** | **Pure Pursuit** steering + **PID** speed | [`control/`](src/control) |
| **Vehicle model** | **Kinematic bicycle model** | [`vehicle/Vehicle.ts`](src/vehicle/Vehicle.ts) |
| **Traffic** | **IDM** (following) + **MOBIL** (lane changes) + scenarios | [`traffic/`](src/traffic) |
| **Visualisation** | Three.js + UnrealBloom, perception overlays, Tesla-style HUD | [`render/`](src/render) · [`ui/`](src/ui) |

The entire simulation core (`src/core`, `world`, `vehicle`, `control`,
`traffic`, `perception`, `behavior`, `planner`, `sim`) is **decoupled from the
renderer** — it imports no Three.js and runs headless, which is why the full
stack can be smoke-tested in Node.

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

Runs the full stack (sensor → tracking → behaviour → planning → control) with no
browser across **four scenarios**, and asserts it stays numerically healthy,
perceives traffic, and — crucially — **hits zero collisions**, including
avoiding the stalled car and surviving the cut-in:

```bash
npx esbuild scripts/smoke.ts --bundle --platform=node --format=esm --outfile=smoke.mjs && node smoke.mjs
```

```
[trucks]
  distance         : 1.04 km
  lane changes     : 5
  max tracks       : 5
  behaviour states : CRUISE, OVERTAKE, FOLLOW, EMERGENCY
  crash steps      : 0

SMOKE PASS — all scenarios healthy, zero collisions.
```

---

## Tech

**TypeScript · Three.js · Vite.** No backend, no build-time secrets, deploys as
a static site. Sim runs on a fixed timestep (deterministic physics/planning)
decoupled from the render loop.

## Roadmap

- [x] **Sensor + Kalman tracking** perception (v2) — ego drives off estimates, not truth
- [x] **Behaviour FSM** + adaptive-cruise following (v2)
- [x] **Occupancy grid** + scenario library: trucks, stalled car, cut-in, dense (v2)
- [ ] Traffic lights + intersections + stop-line planning
- [ ] A learned driving policy (imitation / RL) benchmarked against the classical planner
- [ ] Recorded scenarios + a "hard cases" gallery

---

Built by [@codewithfourtix](https://github.com/codewithfourtix).
