// ControlPanel — the interactive dashboard (bottom-left). Lets the viewer drive
// the demo: pick a scenario, change the ego's target speed, add/remove traffic,
// pause/reset, switch camera, and toggle every perception/planner overlay.

import * as THREE from "three";
import { Simulation } from "../sim/Simulation.ts";
import { Scene } from "../render/Scene.ts";
import { CandidatesView } from "../render/CandidatesView.ts";
import { ScenarioName } from "../traffic/TrafficManager.ts";
import { mps2kph, kph2mps } from "../core/math.ts";

export interface OverlayObjects {
  occupancy: THREE.Object3D;
  tracks: THREE.Object3D;
  sensor: THREE.Object3D;
  buildings: THREE.Object3D;
}

const SCENARIOS: { id: ScenarioName; label: string }[] = [
  { id: "highway", label: "Highway" },
  { id: "trucks", label: "Trucks" },
  { id: "stalled", label: "Stalled" },
  { id: "cutin", label: "Cut-in" },
  { id: "dense", label: "Dense" },
  { id: "crossing", label: "Crossing" },
  { id: "occluded", label: "Occluded ped" },
  { id: "jaywalker", label: "Jaywalker" },
  { id: "lights", label: "🚦 Lights" },
];

export class ControlPanel {
  constructor(
    root: HTMLElement,
    private sim: Simulation,
    private scene: Scene,
    private candidates: CandidatesView,
    private overlays: OverlayObjects,
  ) {
    const scenarioBtns = SCENARIOS.map(
      (s) => `<button class="bl scn${s.id === sim.scenario ? " active" : ""}" data-scn="${s.id}">${s.label}</button>`,
    ).join("");

    root.insertAdjacentHTML(
      "beforeend",
      `
      <div class="controls panel">
        <h4>SCENARIO</h4>
        <div class="btn-row wrap">${scenarioBtns}</div>

        <h4>CONTROLS</h4>
        <div class="ctl">
          <div class="ctl-label"><span>Target speed</span><span class="val" id="c-speed-val"></span></div>
          <input type="range" id="c-speed" min="20" max="140" step="1" />
        </div>
        <div class="ctl">
          <div class="ctl-label"><span>Traffic density</span><span class="val" id="c-traffic-val"></span></div>
          <input type="range" id="c-traffic" min="0" max="40" step="1" />
        </div>

        <div class="toggle-row"><span>City buildings</span><div class="switch on" id="c-build"><div class="knob"></div></div></div>
        <div class="toggle-row"><span>Perception (Kalman)</span><div class="switch on" id="c-percept"><div class="knob"></div></div></div>
        <div class="toggle-row"><span>Sensor range</span><div class="switch on" id="c-sensor"><div class="knob"></div></div></div>
        <div class="toggle-row"><span>Track boxes</span><div class="switch on" id="c-tracks"><div class="knob"></div></div></div>
        <div class="toggle-row"><span>Occupancy grid</span><div class="switch on" id="c-occ"><div class="knob"></div></div></div>
        <div class="toggle-row"><span>Planner candidates</span><div class="switch on" id="c-cand"><div class="knob"></div></div></div>

        <div class="btn-row">
          <button class="bl" id="c-pause">Pause</button>
          <button class="bl" id="c-reset">Reset</button>
        </div>
        <div class="btn-row">
          <button class="bl active" id="c-cam-chase">Chase</button>
          <button class="bl" id="c-cam-top">Top-down</button>
        </div>

        <div class="ctl-label" style="margin-top:2px">Weather</div>
        <div class="seg" id="c-weather">
          <button class="seg-btn active" data-w="clear">Clear</button>
          <button class="seg-btn" data-w="rain">Rain</button>
          <button class="seg-btn" data-w="fog">Fog</button>
        </div>
      </div>
      `,
    );

    this.wireScenarios();
    this.wireSpeed();
    this.wireTraffic();
    this.wireToggles();
    this.wirePlayReset();
    this.wireCamera();
    this.wireWeather();
  }

  private wireWeather(): void {
    const btns = Array.from(document.querySelectorAll<HTMLButtonElement>("#c-weather .seg-btn"));
    for (const b of btns) {
      b.addEventListener("click", () => {
        btns.forEach((x) => x.classList.remove("active"));
        b.classList.add("active");
        const w = b.dataset.w as "clear" | "rain" | "fog";
        this.sim.setWeather(w);
        this.scene.setWeather(w);
      });
    }
  }

  private wireScenarios(): void {
    const btns = Array.from(document.querySelectorAll<HTMLButtonElement>(".scn"));
    for (const b of btns) {
      b.addEventListener("click", () => {
        btns.forEach((x) => x.classList.remove("active"));
        b.classList.add("active");
        this.sim.setScenario(b.dataset.scn as ScenarioName);
        // Keep the traffic slider in sync with the scenario's car count.
        const slider = document.getElementById("c-traffic") as HTMLInputElement;
        const val = document.getElementById("c-traffic-val")!;
        slider.value = this.sim.traffic.count.toString();
        val.textContent = `${slider.value} cars`;
      });
    }
  }

  private wireSpeed(): void {
    const slider = document.getElementById("c-speed") as HTMLInputElement;
    const val = document.getElementById("c-speed-val")!;
    slider.value = Math.round(mps2kph(this.sim.config.egoDesiredSpeed)).toString();
    val.textContent = `${slider.value} km/h`;
    slider.addEventListener("input", () => {
      val.textContent = `${slider.value} km/h`;
      this.sim.setDesiredSpeed(kph2mps(parseFloat(slider.value)));
    });
  }

  private wireTraffic(): void {
    const slider = document.getElementById("c-traffic") as HTMLInputElement;
    const val = document.getElementById("c-traffic-val")!;
    slider.value = this.sim.traffic.count.toString();
    val.textContent = `${slider.value} cars`;
    slider.addEventListener("input", () => {
      val.textContent = `${slider.value} cars`;
    });
    slider.addEventListener("change", () => {
      this.sim.setTrafficCount(parseInt(slider.value, 10));
    });
  }

  private toggle(id: string, initial: boolean, onChange: (on: boolean) => void): void {
    const el = document.getElementById(id)!;
    el.classList.toggle("on", initial);
    el.addEventListener("click", () => onChange(el.classList.toggle("on")));
  }

  private wireToggles(): void {
    this.toggle("c-build", true, (on) => (this.overlays.buildings.visible = on));
    this.toggle("c-percept", true, (on) => (this.sim.usePerception = on));
    this.toggle("c-sensor", true, (on) => (this.overlays.sensor.visible = on));
    this.toggle("c-tracks", true, (on) => (this.overlays.tracks.visible = on));
    this.toggle("c-occ", true, (on) => (this.overlays.occupancy.visible = on));
    this.toggle("c-cand", true, (on) => {
      this.candidates.setVisible(on);
      this.sim.showCandidates = on;
    });
  }

  private wirePlayReset(): void {
    const pause = document.getElementById("c-pause") as HTMLButtonElement;
    const reset = document.getElementById("c-reset") as HTMLButtonElement;
    pause.addEventListener("click", () => {
      this.sim.paused = !this.sim.paused;
      pause.textContent = this.sim.paused ? "Play" : "Pause";
      pause.classList.toggle("active", this.sim.paused);
    });
    reset.addEventListener("click", () => this.sim.reset());
  }

  private wireCamera(): void {
    const chase = document.getElementById("c-cam-chase") as HTMLButtonElement;
    const top = document.getElementById("c-cam-top") as HTMLButtonElement;
    const set = (mode: "chase" | "top") => {
      this.scene.cameraMode = mode;
      chase.classList.toggle("active", mode === "chase");
      top.classList.toggle("active", mode === "top");
    };
    chase.addEventListener("click", () => set("chase"));
    top.addEventListener("click", () => set("top"));
  }
}
