// Minimap — a cockpit radar (top-left). An ego-centred, heading-up 2-D view of
// the road ahead and everything around: traffic (grey), pedestrians (amber),
// and traffic lights (by colour). Drawn on a plain 2-D canvas each frame.

import { Simulation } from "../sim/Simulation.ts";

const SIZE = 168;
const RANGE = 75; // metres shown from centre to edge

export class Minimap {
  private ctx: CanvasRenderingContext2D;

  constructor(root: HTMLElement, private sim: Simulation) {
    root.insertAdjacentHTML(
      "beforeend",
      `<div class="minimap panel"><div class="mm-label">RADAR</div><canvas id="mm-c" width="${SIZE}" height="${SIZE}"></canvas></div>`,
    );
    this.ctx = (document.getElementById("mm-c") as HTMLCanvasElement).getContext("2d")!;
  }

  update(): void {
    const ctx = this.ctx;
    const c = SIZE / 2;
    const scale = c / RANGE;
    const ego = this.sim.ego;
    const cos = Math.cos(ego.yaw);
    const sin = Math.sin(ego.yaw);

    // Transform a world point to radar pixel coords (ego-centred, heading up).
    const project = (wx: number, wy: number): [number, number] => {
      const dx = wx - ego.x;
      const dy = wy - ego.y;
      const fwd = dx * cos + dy * sin;
      const lat = -dx * sin + dy * cos;
      return [c - lat * scale, c - fwd * scale];
    };

    ctx.clearRect(0, 0, SIZE, SIZE);
    // Backdrop + range rings.
    ctx.fillStyle = "rgba(10,16,26,0.85)";
    ctx.beginPath();
    ctx.arc(c, c, c - 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(90,120,170,0.25)";
    ctx.lineWidth = 1;
    for (const r of [c / 3, (2 * c) / 3, c - 2]) {
      ctx.beginPath();
      ctx.arc(c, c, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Clip to the circle for everything else.
    ctx.save();
    ctx.beginPath();
    ctx.arc(c, c, c - 1, 0, Math.PI * 2);
    ctx.clip();

    // Road centreline (nearby samples).
    const path = this.sim.path;
    ctx.strokeStyle = "rgba(150,170,210,0.5)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    let pen = false;
    for (let i = 0; i < path.count; i += 2) {
      const dx = path.xs[i] - ego.x;
      const dy = path.ys[i] - ego.y;
      if (dx * dx + dy * dy > RANGE * RANGE) {
        pen = false;
        continue;
      }
      const [px, py] = project(path.xs[i], path.ys[i]);
      if (!pen) {
        ctx.moveTo(px, py);
        pen = true;
      } else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Traffic.
    for (const car of this.sim.traffic.cars) {
      const w = path.toCartesian(car.s, car.d);
      const dx = w.x - ego.x;
      const dy = w.y - ego.y;
      if (dx * dx + dy * dy > RANGE * RANGE) continue;
      const [px, py] = project(w.x, w.y);
      ctx.fillStyle = car.kind === "stalled" ? "#ffb020" : "#c4ccd6";
      ctx.fillRect(px - 2, py - 2, 4, 4);
    }

    // Pedestrians.
    for (const p of this.sim.pedestrians.peds) {
      if (p.state === "done") continue;
      const w = path.toCartesian(p.s, p.d);
      const [px, py] = project(w.x, w.y);
      ctx.fillStyle = "#ffcf40";
      ctx.beginPath();
      ctx.arc(px, py, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Traffic lights.
    for (const lt of this.sim.trafficLights) {
      const w = path.toCartesian(lt.s, 0);
      const [px, py] = project(w.x, w.y);
      ctx.fillStyle = lt.state === "red" ? "#ff3b30" : lt.state === "yellow" ? "#ffb020" : "#34c759";
      ctx.beginPath();
      ctx.arc(px, py, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Ego triangle (always centre, pointing up).
    ctx.fillStyle = "#2e8bff";
    ctx.beginPath();
    ctx.moveTo(c, c - 6);
    ctx.lineTo(c - 4.5, c + 5);
    ctx.lineTo(c + 4.5, c + 5);
    ctx.closePath();
    ctx.fill();
  }
}
