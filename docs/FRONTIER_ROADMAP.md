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
- [ ] **P4 — Urban: traffic lights + intersections + stop-line planning**
- [ ] **P5 — Richer sensing / sensor fusion viz; recording & replay**
- [ ] **P6 — Polish: intro overlay, guided tour, performance, mobile**

Assumptions: keep everything self-contained (no external ML libs — avoids CSP/CDN
issues), deterministic-seeded tests, verify each phase headlessly + by screenshot.
