// TrafficLight — a signalised stop-line at a station on the loop. It cycles
// green → yellow → red on a fixed timer; the ego must stop at the line on red
// (and on yellow if it can still stop comfortably) and proceed on green. This is
// the core of urban driving: obeying signals with stop-line planning.

export type LightState = "green" | "yellow" | "red";

export class TrafficLight {
  readonly s: number; // station of the stop line
  private greenT: number;
  private yellowT: number;
  private redT: number;
  private timer: number;

  constructor(s: number, opts: Partial<{ green: number; yellow: number; red: number; offset: number }> = {}) {
    this.s = s;
    this.greenT = opts.green ?? 9;
    this.yellowT = opts.yellow ?? 2;
    this.redT = opts.red ?? 7;
    this.timer = opts.offset ?? 0;
  }

  update(dt: number): void {
    this.timer = (this.timer + dt) % (this.greenT + this.yellowT + this.redT);
  }

  get state(): LightState {
    if (this.timer < this.greenT) return "green";
    if (this.timer < this.greenT + this.yellowT) return "yellow";
    return "red";
  }

  /** Seconds remaining in the current phase (for a countdown display). */
  get remaining(): number {
    const cycle = this.greenT + this.yellowT + this.redT;
    if (this.timer < this.greenT) return this.greenT - this.timer;
    if (this.timer < this.greenT + this.yellowT) return this.greenT + this.yellowT - this.timer;
    return cycle - this.timer;
  }
}
