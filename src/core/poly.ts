// Quintic & quartic polynomials — the mathematical backbone of Frenet-frame
// trajectory generation (Werling, Ziegler et al. "Optimal Trajectory Generation
// for Dynamic Street Scenarios in a Frenet Frame", ICRA 2010).
//
//   - Lateral motion d(t): a QUINTIC, because we constrain position, velocity
//     AND acceleration at both the start and the end (6 boundary conditions).
//   - Longitudinal motion s(t) for velocity-keeping: a QUARTIC, because the end
//     position is left free — we only pin the terminal velocity & acceleration.

import { solve2, solve3 } from "./linalg.ts";

export class QuinticPolynomial {
  private a0: number;
  private a1: number;
  private a2: number;
  private a3: number;
  private a4: number;
  private a5: number;

  constructor(
    xs: number, vs: number, as: number, // start pos / vel / acc
    xe: number, ve: number, ae: number, // end   pos / vel / acc
    T: number,
  ) {
    this.a0 = xs;
    this.a1 = vs;
    this.a2 = as / 2;

    const T2 = T * T;
    const T3 = T2 * T;
    const T4 = T3 * T;
    const T5 = T4 * T;

    const A = [
      [T3, T4, T5],
      [3 * T2, 4 * T3, 5 * T4],
      [6 * T, 12 * T2, 20 * T3],
    ];
    const b = [
      xe - (this.a0 + this.a1 * T + this.a2 * T2),
      ve - (this.a1 + 2 * this.a2 * T),
      ae - 2 * this.a2,
    ];
    const [a3, a4, a5] = solve3(A, b);
    this.a3 = a3;
    this.a4 = a4;
    this.a5 = a5;
  }

  pos(t: number): number {
    const t2 = t * t, t3 = t2 * t, t4 = t3 * t, t5 = t4 * t;
    return this.a0 + this.a1 * t + this.a2 * t2 + this.a3 * t3 + this.a4 * t4 + this.a5 * t5;
  }
  vel(t: number): number {
    const t2 = t * t, t3 = t2 * t, t4 = t3 * t;
    return this.a1 + 2 * this.a2 * t + 3 * this.a3 * t2 + 4 * this.a4 * t3 + 5 * this.a5 * t4;
  }
  acc(t: number): number {
    const t2 = t * t, t3 = t2 * t;
    return 2 * this.a2 + 6 * this.a3 * t + 12 * this.a4 * t2 + 20 * this.a5 * t3;
  }
  jerk(t: number): number {
    const t2 = t * t;
    return 6 * this.a3 + 24 * this.a4 * t + 60 * this.a5 * t2;
  }
}

export class QuarticPolynomial {
  private a0: number;
  private a1: number;
  private a2: number;
  private a3: number;
  private a4: number;

  constructor(
    xs: number, vs: number, as: number, // start pos / vel / acc
    ve: number, ae: number,             // end   vel / acc (position free)
    T: number,
  ) {
    this.a0 = xs;
    this.a1 = vs;
    this.a2 = as / 2;

    const T2 = T * T;
    const T3 = T2 * T;

    const A = [
      [3 * T2, 4 * T3],
      [6 * T, 12 * T2],
    ];
    const b = [ve - (this.a1 + 2 * this.a2 * T), ae - 2 * this.a2];
    const [a3, a4] = solve2(A, b);
    this.a3 = a3;
    this.a4 = a4;
  }

  pos(t: number): number {
    const t2 = t * t, t3 = t2 * t, t4 = t3 * t;
    return this.a0 + this.a1 * t + this.a2 * t2 + this.a3 * t3 + this.a4 * t4;
  }
  vel(t: number): number {
    const t2 = t * t, t3 = t2 * t;
    return this.a1 + 2 * this.a2 * t + 3 * this.a3 * t2 + 4 * this.a4 * t3;
  }
  acc(t: number): number {
    const t2 = t * t;
    return 2 * this.a2 + 6 * this.a3 * t + 12 * this.a4 * t2;
  }
  jerk(t: number): number {
    return 6 * this.a3 + 24 * this.a4 * t;
  }
}
