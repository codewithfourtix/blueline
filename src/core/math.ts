// Small math helpers shared across the sim core.

export const TWO_PI = Math.PI * 2;

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Wrap an angle to (-pi, pi]. */
export function wrapAngle(a: number): number {
  let x = a % TWO_PI;
  if (x <= -Math.PI) x += TWO_PI;
  else if (x > Math.PI) x -= TWO_PI;
  return x;
}

/**
 * Signed shortest difference (a - b) on a circular axis of circumference `len`.
 * Result is in (-len/2, len/2]. Used for station (arc-length) math on a closed loop.
 */
export function wrapDiff(a: number, b: number, len: number): number {
  let d = (a - b) % len;
  if (d < -len / 2) d += len;
  else if (d > len / 2) d -= len;
  return d;
}

/** Positive modulo. */
export function mod(a: number, n: number): number {
  return ((a % n) + n) % n;
}

/** Exponential smoothing factor that is stable across variable frame rates. */
export function smoothTowards(current: number, target: number, rate: number, dt: number): number {
  const t = 1 - Math.exp(-rate * dt);
  return current + (target - current) * t;
}

export function mps2kph(v: number): number {
  return v * 3.6;
}

export function kph2mps(v: number): number {
  return v / 3.6;
}
