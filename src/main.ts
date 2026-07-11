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
import { BuildingsView } from "./render/BuildingsView.ts";
import { PedestrianView } from "./render/PedestrianView.ts";
import { TrafficLightView } from "./render/TrafficLightView.ts";
import { TrailView } from "./render/TrailView.ts";
import { HUD } from "./ui/HUD.ts";
import { ControlPanel } from "./ui/ControlPanel.ts";
import { LearningPanel } from "./ui/LearningPanel.ts";
import { Scorecard } from "./ui/Scorecard.ts";
import { Minimap } from "./ui/Minimap.ts";
import { IntroOverlay } from "./ui/IntroOverlay.ts";
import { Shortcuts } from "./ui/Shortcuts.ts";

function boot(): void {
  const canvas = document.getElementById("scene") as HTMLCanvasElement;
  const uiRoot = document.getElementById("ui") as HTMLElement;
  const loading = document.getElementById("loading");

  const sim = new Simulation();

  // Allow deep-linking a scenario, e.g. ?scenario=crossing
  const wanted = new URLSearchParams(location.search).get("scenario");
  const known = ["highway", "dense", "trucks", "stalled", "cutin", "crossing", "occluded", "jaywalker", "lights"];
  if (wanted && known.includes(wanted)) sim.setScenario(wanted as never);
  const wx = new URLSearchParams(location.search).get("weather");

  const scene = new Scene(canvas);
  if (new URLSearchParams(location.search).get("cam") === "top") scene.cameraMode = "top";
  if (wx === "rain" || wx === "fog") {
    sim.setWeather(wx);
    scene.setWeather(wx);
  }
  const buildings = new BuildingsView(sim.road);
  const road = new RoadView(sim.road);
  const fleet = new CarFleet(sim);
  const ribbon = new PathRibbon();
  const candidates = new CandidatesView();
  const tracksView = new TracksView();
  const occupancyView = new OccupancyView(sim.occupancy);
  const sensorView = new SensorView(sim.sensor.config.range);
  const pedView = new PedestrianView(sim.path);
  const lightView = new TrafficLightView(sim.path, sim.road.totalWidth / 2);
  const trailView = new TrailView();

  scene.add(buildings.group);
  scene.add(road.group);
  scene.add(lightView.group);
  scene.add(trailView.mesh);
  scene.add(sensorView.object);
  scene.add(occupancyView.object);
  scene.add(fleet.group);
  scene.add(pedView.group);
  scene.add(candidates.lines);
  scene.add(ribbon.mesh);
  scene.add(tracksView.object);

  const hud = new HUD(uiRoot);
  const scorecard = new Scorecard(uiRoot, sim);
  const minimap = new Minimap(uiRoot, sim);
  // eslint-disable-next-line no-new
  new IntroOverlay(uiRoot);
  // eslint-disable-next-line no-new
  new Shortcuts();
  // eslint-disable-next-line no-new
  new LearningPanel(uiRoot, sim);
  // eslint-disable-next-line no-new
  new ControlPanel(uiRoot, sim, scene, candidates, {
    occupancy: occupancyView.object,
    tracks: tracksView.object,
    sensor: sensorView.object,
    buildings: buildings.group,
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
    pedView.update(sim.pedestrians.peds);
    lightView.update(sim.trafficLights);
    if (!sim.paused) trailView.update(sim.ego.x, sim.ego.y);
    ribbon.update(sim.plan, sim.planner.config.desiredSpeed);
    candidates.update(sim.candidates, sim.plan);
    tracksView.update(sim.tracks);
    occupancyView.update(sim.occupancy);
    sensorView.update(sim.ego.x, sim.ego.y, sim.sensor.config.range);
    scene.updateCamera(sim.ego.x, sim.ego.y, sim.ego.yaw, delta);
    scene.updateWeather(delta, sim.ego.x, sim.ego.y);
    hud.update(sim.telemetry, sim.road.numLanes);
    scorecard.update();
    minimap.update();
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
