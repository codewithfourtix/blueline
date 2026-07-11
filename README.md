<p align="center">
  <a href="https://realblueline.vercel.app" title="Open the live Blueline simulator">
    <img src="https://raw.githubusercontent.com/codewithfourtix/blueline/main/docs/media/hero.jpg" width="100%" alt="Blueline — a self-driving car navigating a city loop, entirely in the browser: a Frenet lattice planner picks the green path, Stanley + PID steer it, a Kalman filter tracks the surrounding traffic." />
  </a>
</p>

<h1 align="center">▍&nbsp;B&nbsp;L&nbsp;U&nbsp;E&nbsp;L&nbsp;I&nbsp;N&nbsp;E</h1>

<p align="center">
  <a href="https://realblueline.vercel.app"><img src="https://img.shields.io/badge/▶_TRY_THE_LIVE_DEMO-1fd18b?style=for-the-badge&labelColor=0d0e11&color=1fd18b" alt="Try the live demo" height="34"/></a>
</p>

<p align="center">
  <b>A self-driving car that runs a <em>real autonomy stack</em> in your browser —<br/>
  and a neural driver you <em>train, evolve, and race</em> against it. Live. No backend.</b>
</p>

<p align="center">
  <b>Perception → Planning → Control</b> · a classical stack
  &nbsp;&nbsp;•&nbsp;&nbsp;
  <b>Trained live</b> · imitation + neuroevolution
  &nbsp;&nbsp;•&nbsp;&nbsp;
  <b>0 collisions</b> · 9 scenarios
</p>

<p align="center">
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-strict-1fd18b?style=flat-square&labelColor=0d0e11" alt="TypeScript strict"/></a>
  <a href="https://threejs.org/"><img src="https://img.shields.io/badge/Three.js-r161-1fd18b?style=flat-square&labelColor=0d0e11" alt="Three.js r161"/></a>
  <a href="https://vitejs.dev/"><img src="https://img.shields.io/badge/Vite-5-1fd18b?style=flat-square&labelColor=0d0e11" alt="Vite 5"/></a>
  <a href="#-the-learned-drivers--no-ml-library"><img src="https://img.shields.io/badge/neural%20nets-from%20scratch-1fd18b?style=flat-square&labelColor=0d0e11" alt="Neural nets from scratch"/></a>
  <a href="#-proof-it-actually-works"><img src="https://img.shields.io/badge/9%20scenarios-0%20collisions-1fd18b?style=flat-square&labelColor=0d0e11" alt="0 collisions"/></a>
  <a href="#run-it"><img src="https://img.shields.io/badge/runs-100%25%20client--side-1fd18b?style=flat-square&labelColor=0d0e11" alt="100% client-side"/></a>
</p>

<p align="center">
  <a href="#two-schools-of-autonomy-side-by-side"><b>How it works</b></a> &nbsp;·&nbsp;
  <a href="#-watch-it-drive"><b>Watch it drive</b></a> &nbsp;·&nbsp;
  <a href="#-the-learned-drivers--no-ml-library"><b>The neural drivers</b></a> &nbsp;·&nbsp;
  <a href="#-proof-it-actually-works"><b>Proof</b></a> &nbsp;·&nbsp;
  <a href="#run-it"><b>Run it</b></a>
</p>

<br/>

<h2 align="center">Two schools of autonomy, <em>side by side</em></h2>

<p align="center">
  Blueline is a working implementation of the <b>modular autonomy pipeline</b> from real self-driving<br/>
  research — visualised like a Tesla — plus a second, <em>learned</em> stack you train yourself.<br/>
  Two entire approaches, directly comparable, at 60&nbsp;FPS in a browser tab.<br/>
  <sub><b>~6,400 lines of TypeScript. No game engine. No ML library. No server.</b></sub>
</p>

<table>
<tr>
<td width="33%" valign="top" align="center">

### 🧭 Classical stack
Every named algorithm, wired end to end — **Frenet** lattice planning, **IDM/MOBIL** traffic, **Kalman** tracking, **Stanley** control. Verified headless in Node.

</td>
<td width="33%" valign="top" align="center">

### 🧠 Learned stack
A pure-TS **MLP** (backprop + Adam) trained by **behavioural cloning + DAgger**, and a policy found by **neuroevolution** — no teacher, no framework.

</td>
<td width="33%" valign="top" align="center">

### 📊 Scorecard + race
Live **safety / comfort / efficiency** scoring, and a head-to-head **benchmark** of all three drivers on one identical seeded course.

</td>
</tr>
</table>

<br/><br/>

<h2 align="center">🎬 Watch it <em>drive</em></h2>

<table>
<tr>
<td width="50%" align="center">
<img src="https://raw.githubusercontent.com/codewithfourtix/blueline/main/docs/media/streets.webp" width="100%" alt="Chase-cam view cruising the city block with live HUD telemetry"/><br/>
<sub><b>Chase cam</b> — cruising the block, lane markings, live telemetry.</sub>
</td>
<td width="50%" align="center">
<img src="https://raw.githubusercontent.com/codewithfourtix/blueline/main/docs/media/neural.webp" width="100%" alt="A from-scratch neural network driving after training, with its loss curve falling in real time"/><br/>
<sub><b>Neural net at the wheel</b> — trained live (watch the loss fall), then driving.</sub>
</td>
</tr>
<tr>
<td width="50%" align="center">
<img src="https://raw.githubusercontent.com/codewithfourtix/blueline/main/docs/media/map.png" width="100%" alt="Top-down view of a rounded 90-degree junction with cross-streets, radar minimap, and occupancy grid"/><br/>
<sub><b>Top-down</b> — a rounded 90° junction, cross-streets, radar, occupancy grid.</sub>
</td>
<td width="50%" align="center">
<img src="https://raw.githubusercontent.com/codewithfourtix/blueline/main/docs/media/rain.png" width="100%" alt="Rain weather that physically degrades the sensor range from 95 to 68 metres"/><br/>
<sub><b>Rain</b> — weather physically <i>degrades sensor range</i> (95 m → 68 m).</sub>
</td>
</tr>
</table>

<br/><br/>

<h2 align="center">The <em>modular</em> autonomy pipeline</h2>

<p align="center">
  Every arrow is a real module. The ego <b>never reads ground truth</b> — it plans off noisy<br/>
  sensor detections fused by a Kalman tracker, exactly like the real thing.
</p>

```mermaid
%%{init: {'theme':'base','themeVariables':{'primaryColor':'#1b1d22','primaryTextColor':'#e8eaed','primaryBorderColor':'#1fd18b','lineColor':'#5fe6ad','fontSize':'14px'}}}%%
flowchart LR
  subgraph WORLD["🌍 World"]
    ENV["Traffic · IDM + MOBIL<br/>Pedestrians · Lights · Weather"]
  end
  subgraph PERCEPTION["👁 Perception"]
    SENSE["Sensor<br/>noise · occlusion · dropout"] --> TRACK["Kalman Tracker<br/>const-velocity + association"]
    TRACK --> GRID["Occupancy Grid"]
  end
  subgraph DECIDE["🧠 Decision"]
    PRED["Prediction"] --> FSM["Behaviour FSM<br/>cruise · follow · overtake<br/>yield · stop · emergency"]
    FSM --> PLAN["Frenet Lattice Planner<br/>quintic + quartic · cost-ranked"]
  end
  subgraph ACT["🕹 Control"]
    STANLEY["Stanley + PID"] --> BICYCLE["Kinematic Bicycle"]
  end
  ENV --> SENSE
  TRACK --> PRED
  GRID --> PLAN
  PLAN --> STANLEY
  BICYCLE -->|"ego pose"| ENV

  LEARN["🎓 Learned driver<br/>MLP · imitation / evolved"] -.->|"can replace<br/>Decision + Control"| STANLEY
  PLAN -.->|"demonstrations"| LEARN

  classDef s fill:#16181d,stroke:#2b2e34,color:#e8eaed;
  classDef learn fill:#1a2b22,stroke:#1fd18b,color:#5fe6ad;
  class ENV,SENSE,TRACK,GRID,PRED,FSM,PLAN,STANLEY,BICYCLE s;
  class LEARN learn;
```

<details>
<summary><b>The stack, module by module</b> — with source links</summary>

<br/>

| Layer | Technique | Source |
|---|---|---|
| **World model** | Arc-length **Frenet frame** (station `s`, lateral `d`) + curvature over a closed centreline | [`world/ReferencePath.ts`](src/world/ReferencePath.ts) |
| **Perception — sensing** | Range + line-of-sight **sensor** with Gaussian noise, occlusion & random dropout | [`perception/Sensor.ts`](src/perception/Sensor.ts) |
| **Perception — tracking** | **Kalman-filter** multi-object tracker (const-velocity), NN data association, track lifecycle, object classes | [`perception/Tracker.ts`](src/perception/Tracker.ts) |
| **Occupancy** | Ego-centred **occupancy grid** | [`perception/OccupancyGrid.ts`](src/perception/OccupancyGrid.ts) |
| **Prediction** | Constant-velocity roll of each track's *estimated* velocity (lateral term for pedestrians) | [`planner/FrenetPlanner.ts`](src/planner/FrenetPlanner.ts) |
| **Behaviour** | **Finite-state machine**: cruise / follow / overtake / emergency / yield / stop | [`behavior/BehaviorPlanner.ts`](src/behavior/BehaviorPlanner.ts) |
| **Planning** | **Frenet lattice**: quintic + quartic polynomial trajectories, cost-based selection, collision checking | [`planner/FrenetPlanner.ts`](src/planner/FrenetPlanner.ts) · [`core/poly.ts`](src/core/poly.ts) |
| **Control** | **Stanley** lateral tracker + **PID** longitudinal | [`control/`](src/control) |
| **Vehicle** | **Kinematic bicycle model** | [`vehicle/Vehicle.ts`](src/vehicle/Vehicle.ts) |
| **Traffic** | **IDM** car-following + **MOBIL** lane changes | [`traffic/`](src/traffic) |
| **Urban** | **Traffic lights** with stop-line planning | [`world/TrafficLight.ts`](src/world/TrafficLight.ts) |

The entire simulation core imports **zero Three.js** and runs headless in Node — which is
exactly why every claim below is a passing test, not a screenshot.

</details>

<br/><br/>

<h2 align="center">🧠 The <em>learned</em> drivers — no ML library</h2>

<p align="center">
  A pure-TypeScript MLP with backprop + Adam (<a href="src/learn/NN.ts"><code>learn/NN.ts</code></a>) learns to drive from a<br/>
  16-feature view of the road. Two ways to teach it — <b>watch the loss curve fall in real time.</b>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/codewithfourtix/blueline/main/docs/media/neural.webp" width="80%" alt="The neural driver panel: loss curve falling to 0.0144 over 29,400 samples, NEURAL NET at the wheel, drive score 84"/>
</p>

<table>
<tr>
<td width="50%" valign="top">

### 🎓 Imitation + DAgger
The classical stack drives; the network records `(state → action)` demonstrations and clones them. Then **DAgger** flips it — the *learner* drives while the *expert* labels the states it actually visits, curing the covariate-shift drift that sinks naive cloning.

> **Result:** holds its lane at **max 0.99 m** off centre (half-width 5.55 m) over **1.05 km**, **0 collisions.**

→ [`ImitationAgent.ts`](src/learn/ImitationAgent.ts) · [`Trainer.ts`](src/learn/Trainer.ts)

</td>
<td width="50%" valign="top">

### 🧬 Neuroevolution — no teacher
A genetic algorithm evolves the weights, scored purely by driving-rollout fitness (distance minus penalties for leaving the road or hitting traffic). Selection + crossover + mutation discover a driver **from random weights.**

> **Result:** fitness climbs **53 → 378** over 16 generations; the champion then drives **1.52 km**, **0 collisions.**

→ [`Evolution.ts`](src/learn/Evolution.ts)

</td>
</tr>
</table>

<p align="center">
  A <b>safety shield</b> (AEB + lane-keeping + virtual guardrail) guards the learned drivers in play —<br/>
  but switches <b>off</b> during evolution, so fitness judges the raw policy, not the shield.
</p>

<br/><br/>

<h2 align="center">📊 <em>Proof</em> it actually works</h2>

<p align="center">
  Everything is verified <b>headless and deterministically</b> in Node (seeded RNG) — no browser,<br/>
  no hand-waving. Reproduce every number yourself (see <a href="#run-it">Run it</a>).
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/codewithfourtix/blueline/main/docs/media/benchmark.png" width="760" alt="In-browser head-to-head benchmark: Classical 78 (winner), Neural Net 75, Evolved 62 — all with zero collisions over one identical seeded course"/>
</p>

<p align="center">
  <sub><b>In-browser head-to-head</b> — all three drivers over one identical seeded course. Classical wins on balance;<br/>the evolved policy is fastest but rougher. All three: <b>zero collisions.</b></sub>
</p>

**`smoke.ts` — the classical stack across 9 scenarios**

```text
[highway]     0.74 km   CRUISE                                  crashes 0   ped-hits 0
[highway@fast]1.09 km   CRUISE                                  crashes 0   ped-hits 0
[stalled]     0.51 km   CRUISE · OVERTAKE                       crashes 0   ped-hits 0
[cutin]       0.47 km   CRUISE · OVERTAKE                       crashes 0   ped-hits 0
[trucks]      0.58 km   CRUISE · OVERTAKE · FOLLOW              crashes 0   ped-hits 0
[crossing]    0.53 km   CRUISE · YIELD · OVERTAKE · STOP        crashes 0   ped-hits 0
[occluded]    0.58 km   CRUISE · OVERTAKE · YIELD · STOP        crashes 0   ped-hits 0
[jaywalker]   0.53 km   CRUISE · YIELD · STOP                   crashes 0   ped-hits 0
[rush]        0.62 km   CRUISE · YIELD · STOP                   crashes 0   ped-hits 0

SMOKE PASS — all scenarios: on-road, zero collisions, pedestrians safe.
```

<table>
<tr>
<td valign="top" width="50%">

**`learn-test.ts` — the net learns**
```text
DAgger 4: samples 60000, loss 0.0230
network now driving:
  [highway] 1.05 km | max|d| 0.99 (half 5.55) | crash 0
  [trucks]  0.61 km | max|d| 1.14 (half 5.55) | crash 0
LEARN-TEST PASS
```

</td>
<td valign="top" width="50%">

**`evo-test.ts` — evolution from scratch**
```text
gen 16/16: best 378.2, avg 151.4
fitness: 53.1 -> 378.2
champion drives: 1.52 km | crash 0
EVO-TEST PASS
```

</td>
</tr>
</table>

<p align="center">
  Plus <code>lights-test.ts</code> (stops on red, goes on green) and <code>weather-test.ts</code> (rain/fog degrade the sensor). <b>All green.</b>
</p>

<br/><br/>

<h2 align="center">🎬 One-click <em>scenarios</em></h2>

<p align="center">
  <code>Highway</code> · <code>Trucks</code> (overtake a convoy) · <code>Stalled</code> car · <code>Cut-in</code> · <code>Dense</code> traffic ·<br/>
  <code>Crossing</code> pedestrian · <b><code>Occluded ped</code></b> (steps out from behind a stalled car, seen late) ·<br/>
  <code>Jaywalker</code> (emergency stop) · <b><code>🚦 Lights</code></b> · <b><code>🌆 Rush hour</code></b>
</p>

<p align="center">
  Deep-link any of them: <code>?scenario=occluded&cam=top&weather=rain</code>
</p>

<br/>

## Run it

```bash
npm install
npm run dev        # → http://localhost:5173
npm run build      # typecheck + production bundle → dist/  (drop on any static host)
```

<details>
<summary><b>Headless verification</b> — reproduce every number above, no browser needed</summary>

<br/>

```bash
npx tsx scripts/smoke.ts        # 9 scenarios: on-road, zero vehicle & pedestrian collisions
npx tsx scripts/learn-test.ts   # the neural net learns to drive (imitation + DAgger)
npx tsx scripts/evo-test.ts     # neuroevolution discovers a driver from random weights
npx tsx scripts/lights-test.ts  # ego obeys the traffic light
npx tsx scripts/weather-test.ts # rain/fog degrade perception
```

Each asserts real, measurable behaviour — stays on road, zero collisions, loss falls,
fitness climbs, red light obeyed.

</details>

<p align="center">
  <b>Keyboard</b> &nbsp;·&nbsp; <code>1–9</code> scenarios &nbsp;·&nbsp; <code>T</code> train &nbsp;·&nbsp; <code>E</code> evolve &nbsp;·&nbsp; <code>C/N/V</code> switch driver &nbsp;·&nbsp; <code>Space</code> pause &nbsp;·&nbsp; <code>R</code> reset &nbsp;·&nbsp; <code>B</code> benchmark
</p>

<br/>

## Under the hood

**TypeScript · Three.js · Vite.** Fixed-timestep deterministic physics & planning, decoupled
from the render loop. The neural networks — MLP with backprop + Adam, and the genetic
algorithm — are written by hand; there is **no TensorFlow, no PyTorch, no ONNX.** No backend,
no build-time secrets. It's a static site.

The render layer (Three.js + UnrealBloom, the green path ribbon, candidate-trajectory viz,
the Tesla-style DOM HUD) is a thin skin over a headless core — which is why the same code that
renders in the browser is the code the tests drive in Node.

## Roadmap

- [x] Classical AV stack — Frenet planner, IDM/MOBIL, Stanley + PID, Kalman tracking
- [x] Pedestrians + hard cases — crossing / occluded / jaywalker
- [x] City map — rounded 90° junctions, cross-streets, traffic lights
- [x] **Imitation learning** driver — behavioural cloning + DAgger
- [x] **Neuroevolution** driver — learn from scratch, no teacher
- [x] Analytics — live scorecard + head-to-head benchmark
- [x] Weather — rain/fog that degrades perception
- [ ] Intersections with cross-traffic & turns
- [ ] Reinforcement learning (policy-gradient) driver
- [ ] Recording & replay

<br/>

<p align="center">
  <sub>Built by <a href="https://github.com/codewithfourtix">@codewithfourtix</a> — perception, planning, and a little bit of evolution.</sub>
</p>
