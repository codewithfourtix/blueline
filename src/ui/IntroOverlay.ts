// IntroOverlay — a welcome card shown on load that explains what Blueline is and
// points at the headline features, so a first-time viewer knows what they're
// looking at. Dismissible; reopen via the "?" button by the brand.

export class IntroOverlay {
  constructor(root: HTMLElement) {
    root.insertAdjacentHTML(
      "beforeend",
      `
      <button class="intro-help" id="intro-help" title="About Blueline">?</button>
      <div class="intro" id="intro">
        <div class="intro-card panel">
          <div class="intro-title">🔵 BLUELINE</div>
          <div class="intro-tag">A self-driving car in your browser — a real autonomous-vehicle stack, and neural drivers you train live.</div>
          <div class="intro-grid">
            <div class="intro-item"><span class="intro-em">🧠</span><b>Classical stack</b><br>Perception (Kalman tracking) → prediction → behaviour → Frenet planner → Stanley control.</div>
            <div class="intro-item"><span class="intro-em">🎓</span><b>Learn to drive</b><br>Train a neural net by imitation (+DAgger), or evolve one from scratch — then hand it the wheel.</div>
            <div class="intro-item"><span class="intro-em">🚸</span><b>Hard cases</b><br>Pedestrians, occluded crossings, jaywalkers, stalled cars, cut-ins, traffic lights.</div>
            <div class="intro-item"><span class="intro-em">📊</span><b>Score &amp; compare</b><br>Live safety / comfort / efficiency scoring, and a head-to-head driver benchmark.</div>
          </div>
          <div class="intro-hint">Everything runs client-side. Pick a scenario, train a brain, and watch it drive.</div>
          <button class="bl intro-start" id="intro-start">Start driving →</button>
        </div>
      </div>
      `,
    );
    const intro = document.getElementById("intro")!;
    document.getElementById("intro-start")!.addEventListener("click", () => (intro.style.display = "none"));
    document.getElementById("intro-help")!.addEventListener("click", () => (intro.style.display = "flex"));
  }
}
