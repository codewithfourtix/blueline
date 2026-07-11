// HUD — the always-on overlay: brand mark, the big Tesla-style speed readout
// with the "SELF-DRIVING" pill, and a live telemetry panel exposing what the
// autonomy stack is doing (target speed, lane, planner cost & timing, etc.).

import { Telemetry } from "../sim/Simulation.ts";
import { mps2kph } from "../core/math.ts";

export class HUD {
  private speedNum: HTMLElement;
  private pill: HTMLElement;
  private pillText: HTMLElement;
  private rows: Record<string, HTMLElement> = {};

  constructor(root: HTMLElement) {
    root.insertAdjacentHTML(
      "beforeend",
      `
      <div class="brand">
        <div class="brand-dot"></div>
        <div>
          <div class="brand-name">BLUELINE</div>
          <div class="brand-sub">AUTONOMOUS DRIVING SIMULATOR</div>
        </div>
      </div>

      <div class="speedo">
        <div class="speed-num" id="hud-speed">0</div>
        <div class="speed-unit">KM / H</div>
        <div class="autopill" id="hud-pill">
          <span class="pulse"></span><span id="hud-pill-text">SELF-DRIVING</span>
        </div>
      </div>

      <div class="telemetry panel">
        <h4>AUTONOMY TELEMETRY</h4>
        <div class="trow"><span class="k">Driver</span><span class="v blue" id="t-driver">–</span></div>
        <div class="trow"><span class="k">Behaviour</span><span class="v blue" id="t-behav">–</span></div>
        <div class="trow"><span class="k">Target speed</span><span class="v blue" id="t-target">–</span></div>
        <div class="trow"><span class="k">Lane</span><span class="v" id="t-lane">–</span></div>
        <div class="trow"><span class="k">Tracked objects</span><span class="v" id="t-tracks">–</span></div>
        <div class="trow"><span class="k">Pedestrians</span><span class="v" id="t-peds">–</span></div>
        <div class="trow"><span class="k">Sensor range</span><span class="v" id="t-sensor">–</span></div>
        <div class="trow"><span class="k">Acceleration</span><span class="v" id="t-accel">–</span></div>
        <div class="trow"><span class="k">Steering</span><span class="v" id="t-steer">–</span></div>
        <div class="trow"><span class="k">Candidates</span><span class="v" id="t-cand">–</span></div>
        <div class="trow"><span class="k">Plan cost</span><span class="v" id="t-cost">–</span></div>
        <div class="trow"><span class="k">Plan time</span><span class="v" id="t-ms">–</span></div>
        <div class="trow"><span class="k">Distance</span><span class="v" id="t-dist">–</span></div>
      </div>

      <div class="hint">Blueline drives itself — adjust traffic &amp; target speed, or toggle the planner's candidate paths.</div>
      `,
    );

    this.speedNum = document.getElementById("hud-speed")!;
    this.pill = document.getElementById("hud-pill")!;
    this.pillText = document.getElementById("hud-pill-text")!;
    this.rows = {
      driver: document.getElementById("t-driver")!,
      behav: document.getElementById("t-behav")!,
      tracks: document.getElementById("t-tracks")!,
      peds: document.getElementById("t-peds")!,
      sensor: document.getElementById("t-sensor")!,
      target: document.getElementById("t-target")!,
      lane: document.getElementById("t-lane")!,
      accel: document.getElementById("t-accel")!,
      steer: document.getElementById("t-steer")!,
      cand: document.getElementById("t-cand")!,
      cost: document.getElementById("t-cost")!,
      ms: document.getElementById("t-ms")!,
      dist: document.getElementById("t-dist")!,
    };
  }

  update(t: Telemetry, laneCount: number): void {
    this.speedNum.textContent = Math.round(mps2kph(t.speed)).toString();

    const label: Record<string, string> = {
      CRUISE: "SELF-DRIVING",
      FOLLOW: "FOLLOWING",
      OVERTAKE: "OVERTAKING",
      EMERGENCY: "EMERGENCY STOP",
      YIELD: "YIELDING — PEDESTRIAN",
    };
    const emergency = t.behaviorState === "EMERGENCY";
    const yielding = t.behaviorState === "YIELD";
    this.pill.classList.toggle("alert", emergency);
    this.pill.classList.toggle("warn", yielding);
    this.pillText.textContent = label[t.behaviorState] ?? "SELF-DRIVING";

    this.rows.driver.textContent =
      t.controlMode === "learned" ? "NEURAL NET 🧠" : t.controlMode === "external" ? "EVOLVED 🧬" : "Classical";
    this.rows.behav.textContent = t.behaviorState;
    this.rows.behav.classList.toggle("blue", !emergency && !yielding);
    this.rows.tracks.textContent = `${t.trackedCount}${t.usePerception ? "" : " (GT)"}`;
    this.rows.peds.textContent = `${t.pedCount}`;
    this.rows.sensor.textContent = `${Math.round(t.sensorRange)} m`;
    this.rows.target.textContent = `${Math.round(mps2kph(t.targetSpeed))} km/h`;
    this.rows.lane.textContent = `${t.lane + 1} / ${laneCount}`;
    this.rows.accel.textContent = `${t.accel >= 0 ? "+" : ""}${t.accel.toFixed(1)} m/s²`;
    this.rows.steer.textContent = `${((t.steer * 180) / Math.PI).toFixed(1)}°`;
    this.rows.cand.textContent = `${t.candidateCount}`;
    this.rows.cost.textContent = t.planCost >= 1e5 ? "⚠ high" : t.planCost.toFixed(1);
    this.rows.ms.textContent = `${t.planMs.toFixed(1)} ms`;
    this.rows.dist.textContent = `${(t.distanceTravelled / 1000).toFixed(2)} km`;
  }
}
