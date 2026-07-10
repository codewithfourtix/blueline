// ControlPanel — the interactive dashboard (bottom-left). Lets the viewer drive
// the demo: change the ego's target speed, add or remove traffic, pause/reset,
// switch camera, and toggle the planner's candidate-path visualisation.

import { Simulation } from "../sim/Simulation.ts";
import { Scene } from "../render/Scene.ts";
import { CandidatesView } from "../render/CandidatesView.ts";
import { mps2kph, kph2mps } from "../core/math.ts";

export class ControlPanel {
  constructor(
    root: HTMLElement,
    private sim: Simulation,
    private scene: Scene,
    private candidates: CandidatesView,
  ) {
    root.insertAdjacentHTML(
      "beforeend",
      `
      <div class="controls panel">
        <h4>CONTROLS</h4>

        <div class="ctl">
          <div class="ctl-label"><span>Target speed</span><span class="val" id="c-speed-val"></span></div>
          <input type="range" id="c-speed" min="20" max="140" step="1" />
        </div>

        <div class="ctl">
          <div class="ctl-label"><span>Traffic density</span><span class="val" id="c-traffic-val"></span></div>
          <input type="range" id="c-traffic" min="0" max="40" step="1" />
        </div>

        <div class="toggle-row">
          <span>Show planner candidates</span>
          <div class="switch on" id="c-cand"><div class="knob"></div></div>
        </div>

        <div class="btn-row">
          <button class="bl" id="c-pause">Pause</button>
          <button class="bl" id="c-reset">Reset</button>
        </div>

        <div class="btn-row">
          <button class="bl active" id="c-cam-chase">Chase</button>
          <button class="bl" id="c-cam-top">Top-down</button>
        </div>
      </div>
      `,
    );

    this.wireSpeed();
    this.wireTraffic();
    this.wireCandidates();
    this.wirePlayReset();
    this.wireCamera();
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
    slider.value = this.sim.config.trafficCount.toString();
    val.textContent = `${slider.value} cars`;
    slider.addEventListener("change", () => {
      val.textContent = `${slider.value} cars`;
      this.sim.setTrafficCount(parseInt(slider.value, 10));
    });
    slider.addEventListener("input", () => {
      val.textContent = `${slider.value} cars`;
    });
  }

  private wireCandidates(): void {
    const sw = document.getElementById("c-cand")!;
    sw.addEventListener("click", () => {
      const on = sw.classList.toggle("on");
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
    reset.addEventListener("click", () => {
      this.sim.reset();
    });
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
