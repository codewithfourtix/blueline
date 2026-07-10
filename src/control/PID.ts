// A minimal PID controller with anti-windup, used for longitudinal (speed)
// control: it turns a target-speed error into an acceleration command.

import { clamp } from "../core/math.ts";

export class PID {
  private integral = 0;
  private prevError = 0;
  private initialized = false;

  constructor(
    public kp: number,
    public ki: number,
    public kd: number,
    private outMin = -Infinity,
    private outMax = Infinity,
  ) {}

  reset(): void {
    this.integral = 0;
    this.prevError = 0;
    this.initialized = false;
  }

  update(error: number, dt: number): number {
    if (dt <= 0) return 0;

    this.integral += error * dt;
    // Clamp the integral term to prevent windup when saturated.
    const iLimit = 5;
    this.integral = clamp(this.integral, -iLimit, iLimit);

    const derivative = this.initialized ? (error - this.prevError) / dt : 0;
    this.prevError = error;
    this.initialized = true;

    const out = this.kp * error + this.ki * this.integral + this.kd * derivative;
    return clamp(out, this.outMin, this.outMax);
  }
}
