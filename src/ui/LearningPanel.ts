// LearningPanel — the "Neural Driver" control (top-centre). Trains the
// from-scratch neural network live (with a progress bar + loss readout) on a
// hidden simulation, then lets the viewer hand the wheel to the network and
// watch a learned policy drive — toggling back to the classical stack anytime.

import { Simulation } from "../sim/Simulation.ts";
import { trainDriver } from "../learn/Trainer.ts";

export class LearningPanel {
  private training = false;

  constructor(root: HTMLElement, private sim: Simulation) {
    root.insertAdjacentHTML(
      "beforeend",
      `
      <div class="neural panel">
        <div class="neural-head">
          <span class="neural-title">🧠 NEURAL DRIVER</span>
          <span class="neural-sub" id="nn-sub">from-scratch net · imitation + DAgger</span>
        </div>
        <div class="neural-body">
          <button class="bl neural-train" id="nn-train">Train neural net</button>
          <div class="neural-prog" id="nn-prog" style="display:none">
            <div class="neural-bar"><div class="neural-fill" id="nn-fill"></div></div>
            <div class="neural-stat"><span id="nn-phase">…</span><span id="nn-loss"></span></div>
          </div>
          <div class="neural-drive" id="nn-drive" style="display:none">
            <span class="neural-drive-label">Driver</span>
            <div class="seg">
              <button class="seg-btn active" id="nn-classical">Classical</button>
              <button class="seg-btn" id="nn-ai">Neural Net</button>
            </div>
          </div>
        </div>
      </div>
      `,
    );

    const trainBtn = document.getElementById("nn-train") as HTMLButtonElement;
    trainBtn.addEventListener("click", () => this.train());
    document.getElementById("nn-classical")!.addEventListener("click", () => this.setMode("classical"));
    document.getElementById("nn-ai")!.addEventListener("click", () => this.setMode("learned"));
  }

  private setMode(mode: "classical" | "learned"): void {
    if (mode === "learned" && !this.sim.imitation.trained) return;
    this.sim.setControlMode(mode);
    document.getElementById("nn-classical")!.classList.toggle("active", mode === "classical");
    document.getElementById("nn-ai")!.classList.toggle("active", mode === "learned");
  }

  private async train(): Promise<void> {
    if (this.training) return;
    this.training = true;
    const btn = document.getElementById("nn-train") as HTMLButtonElement;
    const prog = document.getElementById("nn-prog")!;
    const fill = document.getElementById("nn-fill")!;
    const phase = document.getElementById("nn-phase")!;
    const lossEl = document.getElementById("nn-loss")!;
    btn.disabled = true;
    btn.textContent = "Training…";
    prog.style.display = "block";

    const weights = await trainDriver((p) => {
      fill.style.width = `${Math.round(p.frac * 100)}%`;
      phase.textContent = p.phase;
      lossEl.textContent = `loss ${p.loss.toFixed(4)} · ${p.samples.toLocaleString()} samples`;
    });

    this.sim.imitation.loadState(weights);
    btn.textContent = "Re-train";
    btn.disabled = false;
    document.getElementById("nn-sub")!.textContent = "trained ✓ — hand it the wheel";
    document.getElementById("nn-drive")!.style.display = "flex";
    this.setMode("learned");
    this.training = false;
  }
}
