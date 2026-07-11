// Scorecard — a live driving-quality panel (bottom-right). It reads the running
// Metrics each frame and shows an overall 0–100 score plus Safety / Comfort /
// Efficiency bars, so you can directly feel the difference between the classical
// stack and the learned drivers. Resets whenever the driver changes.

import { Simulation } from "../sim/Simulation.ts";
import { mps2kph } from "../core/math.ts";
import { benchmarkDrivers, DriverSpec, BenchResult } from "../learn/Benchmark.ts";

function scoreColor(v: number): string {
  if (v >= 80) return "#4ade80";
  if (v >= 60) return "#5fe6ad";
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
        <button class="bl" id="sc-bench" style="width:100%;margin-top:11px">Compare drivers ▸</button>
      </div>
      <div class="bench-modal" id="bench-modal" style="display:none">
        <div class="bench-card panel">
          <div class="bench-head"><span>DRIVER BENCHMARK</span><button id="bench-close">✕</button></div>
          <div class="bench-sub" id="bench-sub">identical seeded course · same metrics</div>
          <div id="bench-body"></div>
        </div>
      </div>
      `,
    );
    document.getElementById("sc-bench")!.addEventListener("click", () => this.runBenchmark());
    document.getElementById("bench-close")!.addEventListener("click", () => {
      document.getElementById("bench-modal")!.style.display = "none";
    });
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

  private async runBenchmark(): Promise<void> {
    const btn = document.getElementById("sc-bench") as HTMLButtonElement;
    if (btn.disabled) return;
    btn.disabled = true;
    btn.textContent = "Benchmarking…";

    const specs: DriverSpec[] = [{ name: "Classical", kind: "classical" }];
    if (this.sim.imitation.trained) {
      specs.push({ name: "Neural Net", kind: "imitation", weights: this.sim.imitation.net.toJSON() });
    }
    if (this.sim.evolvedChampion) {
      specs.push({ name: "Evolved", kind: "evolved", weights: this.sim.evolvedChampion.toJSON() });
    }

    const wasPaused = this.sim.paused;
    this.sim.paused = true; // freeze the live sim so the benchmark owns the RNG
    let results: BenchResult[] = [];
    try {
      results = await benchmarkDrivers(specs, (name) => {
        btn.textContent = `Benchmarking ${name}…`;
      });
    } finally {
      this.sim.paused = wasPaused;
    }
    this.showResults(results);
    btn.disabled = false;
    btn.textContent = "Compare drivers ▸";
  }

  private showResults(results: BenchResult[]): void {
    const color = (v: number) => scoreColor(v);
    const bar = (label: string, v: number) =>
      `<div class="score-row"><span class="score-k">${label}</span><div class="score-track"><div class="score-fill" style="width:${v}%;background:${color(v)}"></div></div><span class="score-v">${Math.round(v)}</span></div>`;
    const best = Math.max(...results.map((r) => r.scores.overall));
    const cards = results
      .map(
        (r) => `
      <div class="bench-driver${r.scores.overall === best ? " win" : ""}">
        <div class="bench-driver-head">
          <span class="bench-name">${r.name}${r.scores.overall === best ? " 👑" : ""}</span>
          <span class="bench-overall" style="color:${color(r.scores.overall)}">${Math.round(r.scores.overall)}</span>
        </div>
        ${bar("Safety", r.scores.safety)}
        ${bar("Comfort", r.scores.comfort)}
        ${bar("Efficiency", r.scores.efficiency)}
        <div class="bench-foot">${r.collisions} collisions · ${Math.round(mps2kph(r.meanSpeed))} km/h · ${r.distanceKm.toFixed(1)} km</div>
      </div>`,
      )
      .join("");
    document.getElementById("bench-body")!.innerHTML = cards;
    document.getElementById("bench-modal")!.style.display = "flex";
  }
}
