// LearningPanel — the "Neural Driver" control (top-centre). Offers TWO ways to
// get a neural policy: (1) TRAIN by imitation + DAgger from the classical expert,
// (2) EVOLVE from scratch with a genetic algorithm (no teacher). Both show live
// progress; when ready you can hand the wheel to either learned driver and watch
// it drive, toggling back to the classical stack anytime.

import { Simulation, ControlMode } from "../sim/Simulation.ts";
import { trainDriver } from "../learn/Trainer.ts";
import { evolveDriver } from "../learn/Evolution.ts";
import { MLP } from "../learn/NN.ts";
import { decodeAction } from "../learn/features.ts";

export class LearningPanel {
  private busy = false;
  private champion: MLP | null = null;

  constructor(root: HTMLElement, private sim: Simulation) {
    root.insertAdjacentHTML(
      "beforeend",
      `
      <div class="neural panel">
        <div class="neural-head">
          <span class="neural-title">🧠 NEURAL DRIVER</span>
          <span class="neural-sub" id="nn-sub">learn a policy, then hand it the wheel</span>
        </div>
        <div class="btn-row">
          <button class="bl" id="nn-train">Train (imitation)</button>
          <button class="bl" id="nn-evolve">Evolve (no teacher)</button>
        </div>
        <div class="neural-prog" id="nn-prog" style="display:none">
          <div class="neural-bar"><div class="neural-fill" id="nn-fill"></div></div>
          <div class="neural-stat"><span id="nn-phase">…</span><span id="nn-metric"></span></div>
        </div>
        <div class="neural-drive" id="nn-drive">
          <span class="neural-drive-label">Driver</span>
          <div class="seg">
            <button class="seg-btn active" id="nn-classical">Classical</button>
            <button class="seg-btn disabled" id="nn-ai">Neural Net</button>
            <button class="seg-btn disabled" id="nn-evo">Evolved</button>
          </div>
        </div>
      </div>
      `,
    );

    (document.getElementById("nn-train") as HTMLButtonElement).addEventListener("click", () => this.runTrain());
    (document.getElementById("nn-evolve") as HTMLButtonElement).addEventListener("click", () => this.runEvolve());
    document.getElementById("nn-classical")!.addEventListener("click", () => this.setMode("classical"));
    document.getElementById("nn-ai")!.addEventListener("click", () => this.setMode("learned"));
    document.getElementById("nn-evo")!.addEventListener("click", () => this.setMode("external"));
  }

  private setMode(mode: ControlMode): void {
    if (mode === "learned" && !this.sim.imitation.trained) return;
    if (mode === "external") {
      if (!this.champion) return;
      const champ = this.champion;
      this.sim.externalPolicy = (f) => decodeAction(champ.predict(f));
    }
    this.sim.setControlMode(mode);
    document.getElementById("nn-classical")!.classList.toggle("active", mode === "classical");
    document.getElementById("nn-ai")!.classList.toggle("active", mode === "learned");
    document.getElementById("nn-evo")!.classList.toggle("active", mode === "external");
  }

  private startBusy(label: string): void {
    this.busy = true;
    (document.getElementById("nn-train") as HTMLButtonElement).disabled = true;
    (document.getElementById("nn-evolve") as HTMLButtonElement).disabled = true;
    document.getElementById("nn-prog")!.style.display = "block";
    document.getElementById("nn-phase")!.textContent = label;
    document.getElementById("nn-fill")!.style.width = "0%";
  }

  private endBusy(): void {
    this.busy = false;
    (document.getElementById("nn-train") as HTMLButtonElement).disabled = false;
    (document.getElementById("nn-evolve") as HTMLButtonElement).disabled = false;
  }

  private async runTrain(): Promise<void> {
    if (this.busy) return;
    this.startBusy("Collecting demonstrations…");
    const fill = document.getElementById("nn-fill")!;
    const phase = document.getElementById("nn-phase")!;
    const metric = document.getElementById("nn-metric")!;
    const weights = await trainDriver((p) => {
      fill.style.width = `${Math.round(p.frac * 100)}%`;
      phase.textContent = p.phase;
      metric.textContent = `loss ${p.loss.toFixed(4)} · ${p.samples.toLocaleString()} samples`;
    });
    this.sim.imitation.loadState(weights);
    document.getElementById("nn-ai")!.classList.remove("disabled");
    document.getElementById("nn-sub")!.textContent = "imitation net trained ✓";
    this.setMode("learned");
    this.endBusy();
  }

  private async runEvolve(): Promise<void> {
    if (this.busy) return;
    this.startBusy("Evolving generation 1…");
    const fill = document.getElementById("nn-fill")!;
    const phase = document.getElementById("nn-phase")!;
    const metric = document.getElementById("nn-metric")!;
    const state = await evolveDriver((p) => {
      fill.style.width = `${Math.round(p.frac * 100)}%`;
      phase.textContent = `Evolving — generation ${p.generation}/${p.totalGen}`;
      metric.textContent = `best fitness ${p.bestFitness.toFixed(0)} · avg ${p.avgFitness.toFixed(0)}`;
    });
    this.champion = MLP.fromJSON(state);
    this.sim.evolvedChampion = this.champion; // expose to the benchmark
    document.getElementById("nn-evo")!.classList.remove("disabled");
    document.getElementById("nn-sub")!.textContent = "evolved from scratch ✓ (no teacher)";
    this.setMode("external");
    this.endBusy();
  }
}
