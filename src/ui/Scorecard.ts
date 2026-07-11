// Scorecard — a live driving-quality panel (bottom-right). It reads the running
// Metrics each frame and shows an overall 0–100 score plus Safety / Comfort /
// Efficiency bars, so you can directly feel the difference between the classical
// stack and the learned drivers. Resets whenever the driver changes.

import { Simulation } from "../sim/Simulation.ts";
import { mps2kph } from "../core/math.ts";

function scoreColor(v: number): string {
  if (v >= 80) return "#4ade80";
  if (v >= 60) return "#5fb0ff";
  if (v >= 40) return "#ffc861";
  return "#ff5a5a";
}

export class Scorecard {
  private el: Record<string, HTMLElement> = {};

  constructor(root: HTMLElement, private sim: Simulation) {
    root.insertAdjacentHTML(
      "beforeend",
      `
      <div class="scorecard panel">
        <h4>DRIVE SCORE</h4>
        <div class="score-top">
          <div class="score-num" id="sc-overall">–</div>
          <div class="score-of">/ 100</div>
        </div>
        <div class="score-bars">
          ${["safety", "comfort", "efficiency"]
            .map(
              (k) => `
            <div class="score-row">
              <span class="score-k">${k[0].toUpperCase() + k.slice(1)}</span>
              <div class="score-track"><div class="score-fill" id="sc-${k}"></div></div>
              <span class="score-v" id="sc-${k}v">–</span>
            </div>`,
            )
            .join("")}
        </div>
        <div class="score-foot">
          <span id="sc-coll">0 collisions</span>
          <span id="sc-speed">0 km/h avg</span>
        </div>
      </div>
      `,
    );
    for (const id of ["overall", "safety", "comfort", "efficiency", "safetyv", "comfortv", "efficiencyv", "coll", "speed"]) {
      this.el[id] = document.getElementById(`sc-${id}`)!;
    }
  }

  update(): void {
    const s = this.sim.metrics.scores();
    this.el.overall.textContent = Math.round(s.overall).toString();
    this.el.overall.style.color = scoreColor(s.overall);
    for (const k of ["safety", "comfort", "efficiency"] as const) {
      const v = s[k];
      this.el[k].style.width = `${v}%`;
      this.el[k].style.background = scoreColor(v);
      this.el[`${k}v`].textContent = Math.round(v).toString();
    }
    const m = this.sim.metrics;
    this.el.coll.textContent = `${m.collisions} collision${m.collisions === 1 ? "" : "s"}`;
    this.el.coll.style.color = m.collisions > 0 ? "#ff5a5a" : "var(--bl-text-dim)";
    this.el.speed.textContent = `${Math.round(mps2kph(m.meanSpeed))} km/h avg`;
  }
}
