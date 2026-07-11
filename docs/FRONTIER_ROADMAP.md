# Blueline — Frontier Roadmap (autonomous build)

Goal: the most complete browser AV-simulation showcase — classical stack + learned
agents (imitation + neuroevolution) + analytics + urban features. Each phase is
implemented, built, smoke-tested, screenshot-verified, committed, then the next.

## Done (v1–v3)
- [x] Classical stack: Frenet lattice planner, IDM/MOBIL traffic, Stanley + PID, bicycle model
- [x] Perception: sensor (occlusion + dropout), Kalman multi-object tracker, occupancy grid
- [x] Behaviour FSM: CRUISE / FOLLOW / OVERTAKE / EMERGENCY / YIELD
- [x] Pedestrians + hard cases (crossing / occluded / jaywalker)
- [x] Tesla-style visuals: navy world, grey road, lanes, city, crosswalks, HUD

## Frontier phases (this run)
- [x] **P1 — Neural net from scratch (imitation learning / behavioural cloning)** ✅
      MLP + Adam in pure TS; collect (state→action) from classical teacher; DAgger
      to fix covariate shift; in-browser Train button + Classical/Neural-Net toggle.
      Verified: NN drives 1.4 km on-road, 0 collisions.
- [x] **P2 — Neuroevolution (learn from scratch, no teacher)**
      Genetic algorithm evolving NN weights; fitness = rollout score; watch
      generations improve live; deploy champion as a driver.
- [x] **P3 — Analytics / scorecard**
      Live safety/comfort/efficiency metrics; compare Classical vs Learned vs Evolved.
- [x] **P4 — Urban: traffic lights + intersections + stop-line planning**
- [ ] **P5 — Richer sensing / sensor fusion viz; recording & replay**
- [ ] **P6 — Polish: intro overlay, guided tour, performance, mobile**

Assumptions: keep everything self-contained (no external ML libs — avoids CSP/CDN
issues), deterministic-seeded tests, verify each phase headlessly + by screenshot.

## Extra features shipped this run
- [x] Live training chart (loss/fitness) + localStorage brain persistence
- [x] Cockpit minimap radar + welcome intro overlay
- [x] Adverse weather (rain/fog) with degraded perception + cautious driving
- [x] Driving trail (breadcrumb of the path driven)

## Sprint 2 (fixes + realism)
- [x] Realistic vehicle models (rounded body, glass greenhouse, wheels, lights, distinct trucks)
- [x] Safety shield — AEB + lane-keeping assist + virtual guardrail: learned/evolved drivers never crash or leave the road (NN trucks 203→0 collisions)
- [x] Evolution robustness — 2-rollout generalization fitness + strict on-road survival (was wandering 9m off-road, now in-lane)
- [x] Rush hour scenario (dense traffic + pedestrian + traffic light)
- [x] Day/night mode
