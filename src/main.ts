// Blueline — entry point. Wires the headless Simulation to the Three.js views
// and the DOM HUD, and drives everything from a fixed-timestep game loop so the
// physics/planner are deterministic regardless of the display refresh rate.

import "./ui/styles.css";
import { Simulation } from "./sim/Simulation.ts";
import { Scene } from "./render/Scene.ts";
import { RoadView } from "./render/RoadView.ts";
import { CarFleet } from "./render/CarFleet.ts";
import { PathRibbon } from "./render/PathRibbon.ts";
import { CandidatesView } from "./render/CandidatesView.ts";
import { TracksView } from "./render/TracksView.ts";
import { OccupancyView } from "./render/OccupancyView.ts";
import { SensorView } from "./render/SensorView.ts";
import { HUD } from "./ui/HUD.ts";
import { ControlPanel } from "./ui/ControlPanel.ts";

function boot(): void {
  const canvas = document.getElementById("scene") as HTMLCanvasElement;
  const uiRoot = document.getElementById("ui") as HTMLElement;
  const loading = document.getElementById("loading");

  const sim = new Simulation();

  const scene = new Scene(canvas);
  const road = new RoadView(sim.road);
  const fleet = new CarFleet(sim);
  const ribbon = new PathRibbon();
  const candidates = new CandidatesView();
  const tracksView = new TracksView();
  const occupancyView = new OccupancyView(sim.occupancy);
  const sensorView = new SensorView(sim.sensor.config.range);

  scene.add(road.group);
  scene.add(sensorView.object);
  scene.add(occupancyView.object);
  scene.add(fleet.group);
  scene.add(candidates.lines);
  scene.add(ribbon.mesh);
  scene.add(tracksView.object);

  const hud = new HUD(uiRoot);
  // eslint-disable-next-line no-new
  new ControlPanel(uiRoot, sim, scene, candidates, {
    occupancy: occupancyView.object,
    tracks: tracksView.object,
    sensor: sensorView.object,
  });

  // ---- fixed-timestep loop ----------------------------------------------
  const fixedDt = sim.config.fixedDt;
  let last = performance.now();
  let acc = 0;
  let firstFrame = true;

  function frame(now: number): void {
    requestAnimationFrame(frame);

    let delta = (now - last) / 1000;
    last = now;
    if (delta > 0.1) delta = 0.1; // avoid spiral-of-death after a tab stall
    acc += delta;

    let steps = 0;
    while (acc >= fixedDt && steps < 6) {
      sim.step(fixedDt);
      acc -= fixedDt;
      steps++;
    }

    // ---- sync views ----
    fleet.update();
    ribbon.update(sim.plan, sim.planner.config.desiredSpeed);
    candidates.update(sim.candidates, sim.plan);
    tracksView.update(sim.tracks);
    occupancyView.update(sim.occupancy);
    sensorView.update(sim.ego.x, sim.ego.y, sim.sensor.config.range);
    scene.updateCamera(sim.ego.x, sim.ego.y, sim.ego.yaw, delta);
    hud.update(sim.telemetry, sim.road.numLanes);
    scene.render();

    if (firstFrame && loading) {
      firstFrame = false;
      loading.classList.add("hidden");
      setTimeout(() => loading.remove(), 700);
    }
  }

  requestAnimationFrame(frame);
}

boot();
