# 🔵 Blueline — Autonomous Driving Simulator

**A self-driving car, in your browser — running a real autonomous-vehicle software
stack, *and* neural drivers you train live, visualised like a Tesla.**

Blueline is not a car *game*. It is a working implementation of the modular
autonomy pipeline used in real self-driving research — **perception → tracking →
prediction → behaviour → planning → control** — plus a second, learned stack: a
neural network you can **train by imitation** or **evolve from scratch**, hand the
wheel to, and **benchmark head-to-head** against the classical planner. Everything
runs entirely client-side, at 60 FPS, with no ML library.

> **Deploy:** it's a static site — `npm run build` produces `dist/`, which drops
> onto any static host (Vercel, Netlify, Cloudflare Pages, S3, …).

---

## What makes it special

Most "self-driving simulators" are one of two things: a scripted animation, or a
toy neural net that learns to stay on a line. Blueline is both halves of the real
field, side by side and directly comparable:

- 🧠 **A hand-engineered classical stack** with every named algorithm — Frenet
  lattice planning, IDM/MOBIL traffic, Kalman tracking, Stanley control.
- 🎓 **A learned stack built from scratch** — an MLP trained by **behavioural
  cloning + DAgger**, and a policy discovered by **neuroevolution** with no teacher.
- 📊 **A scorecard + benchmark** that scores safety / comfort / efficiency and puts
  Classical vs Neural Net vs Evolved on the same seeded course to see who wins.

---

## The classical autonomy stack

| Layer | Technique | Where |
|---|---|---|
| **World model** | Closed-loop centreline with arc-length **Frenet frame** (station `s`, lateral `d`) + curvature | [`world/ReferencePath.ts`](src/world/ReferencePath.ts) |
| **Perception — sensing** | Range + line-of-sight **sensor** with Gaussian noise, occlusion & dropout | [`perception/Sensor.ts`](src/perception/Sensor.ts) |
| **Perception — tracking** | **Kalman-filter** multi-object tracker (const-velocity), NN association, track lifecycle, object classes | [`perception/Tracker.ts`](src/perception/Tracker.ts) |
| **Occupancy** | Ego-centred **occupancy grid** | [`perception/OccupancyGrid.ts`](src/perception/OccupancyGrid.ts) |
| **Prediction** | Constant-velocity roll of each track's *estimated* velocity (lateral for pedestrians) | [`planner/FrenetPlanner.ts`](src/planner/FrenetPlanner.ts) |
| **Behaviour** | **FSM**: CRUISE / FOLLOW / OVERTAKE / EMERGENCY / YIELD / STOP | [`behavior/BehaviorPlanner.ts`](src/behavior/BehaviorPlanner.ts) |
| **Planning** | **Frenet lattice**: quintic + quartic polynomials, cost-based selection, collision checking | [`planner/FrenetPlanner.ts`](src/planner/FrenetPlanner.ts) · [`core/poly.ts`](src/core/poly.ts) |
| **Control** | **Stanley** lateral tracker + **PID** speed | [`control/`](src/control) |
| **Vehicle** | **Kinematic bicycle model** | [`vehicle/Vehicle.ts`](src/vehicle/Vehicle.ts) |
| **Traffic** | **IDM** (car-following) + **MOBIL** (lane changes) | [`traffic/`](src/traffic) |
| **Urban** | **Traffic lights** with stop-line planning | [`world/TrafficLight.ts`](src/world/TrafficLight.ts) |

The entire simulation core imports **no Three.js** and runs headless — which is
why the whole stack (including the learned drivers) is verified in Node.

---

## 🧠 The learned drivers (from scratch — no ML library)

A pure-TypeScript MLP with backprop + Adam ([`learn/NN.ts`](src/learn/NN.ts)) that
learns to drive from a 16-feature view of the road ([`learn/features.ts`](src/learn/features.ts)):

### Imitation learning (+ DAgger)
Click **Train** and watch it: the classical stack drives while the network records
`(state → action)` demonstrations; the net trains by behavioural cloning; then
**DAgger** takes over — the *learner* drives while the *expert* labels the states
it actually visits, fixing the covariate-shift problem that makes naive cloning
drift off the road. The result holds its lane with **0 collisions**.
→ [`learn/ImitationAgent.ts`](src/learn/ImitationAgent.ts) · [`learn/Trainer.ts`](src/learn/Trainer.ts)

### Neuroevolution (no teacher at all)
Click **Evolve** and watch generations improve live: a genetic algorithm evolves
network weights, scored by driving-rollout fitness (distance minus penalties for
leaving the road / hitting traffic). Selection + crossover + mutation discover a
driving policy **from random weights, with no expert** — survival of the fittest.
→ [`learn/Evolution.ts`](src/learn/Evolution.ts)

Toggle **Classical ↔ Neural Net ↔ Evolved** any time and watch a different brain
take the wheel.

---

## 📊 Analytics

- **Live Drive Score** — safety / comfort / efficiency (0–100), resets per driver
  so you can *feel* the difference. → [`sim/Metrics.ts`](src/sim/Metrics.ts)
- **Driver benchmark** — runs each available driver over an **identical seeded
  course** and crowns a winner. → [`learn/Benchmark.ts`](src/learn/Benchmark.ts)
- **Cockpit minimap** radar + full autonomy telemetry.

---

## 🎬 Scenarios (one click each)

`Highway` · `Trucks` (overtake a convoy) · `Stalled` car · `Cut-in` · `Dense`
traffic · `Crossing` pedestrian · **`Occluded ped`** (steps out from behind a
stalled car — seen late) · `Jaywalker` (emergency stop) · **`🚦 Lights`** (stop on
red, go on green). Deep-link any with `?scenario=occluded` (add `&cam=top`).

---

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production bundle -> dist/
```

### Headless verification (no browser, deterministic)

```bash
# full driving stack across 8 scenarios: on-road, zero vehicle & pedestrian collisions
npx esbuild scripts/smoke.ts       --bundle --platform=node --format=esm --outfile=smoke.mjs && node smoke.mjs
# the neural net learns to drive (imitation + DAgger)
npx esbuild scripts/learn-test.ts  --bundle --platform=node --format=esm --outfile=learn.mjs && node learn.mjs
# neuroevolution discovers a driver from scratch
npx esbuild scripts/evo-test.ts    --bundle --platform=node --format=esm --outfile=evo.mjs   && node evo.mjs
# ego obeys the traffic light
npx esbuild scripts/lights-test.ts --bundle --platform=node --format=esm --outfile=lt.mjs    && node lt.mjs
```

Each asserts real, measurable behaviour (stays on road, zero collisions, network
loss falls, evolution fitness climbs, red light obeyed).

---

## Tech

**TypeScript · Three.js · Vite.** No backend, no ML library, no build-time secrets.
The neural networks (MLP + Adam + backprop, and a genetic algorithm) are written
from scratch. Fixed-timestep deterministic physics/planning, decoupled from the
render loop.

## Roadmap

- [x] Classical AV stack (Frenet planner, IDM/MOBIL, Stanley + PID, Kalman tracking)
- [x] Pedestrians + hard cases (crossing / occluded / jaywalker)
- [x] **Imitation learning** neural driver (behavioural cloning + DAgger)
- [x] **Neuroevolution** driver (learn from scratch, no teacher)
- [x] Analytics: live scorecard + head-to-head driver benchmark
- [x] Urban: traffic lights + stop-line behaviour
- [ ] Intersections with cross-traffic & turns
- [ ] Reinforcement learning (policy gradient) driver
- [ ] Recording & replay

---

Built by [@codewithfourtix](https://github.com/codewithfourtix).
