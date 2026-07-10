// IDM — the Intelligent Driver Model (Treiber, Hennecke & Helbing, 2000).
//
// A car-following model that produces realistic longitudinal behaviour: it
// accelerates toward a desired speed on open road, and smoothly brakes to keep
// a safe, speed-dependent gap to the vehicle ahead. It's the de-facto standard
// for microscopic traffic simulation, and it's what gives Blueline's ambient
// traffic its natural "flow".
//
//   desired gap  s*(v, Δv) = s0 + max(0, v·T + v·Δv / (2·√(a·b)))
//   acceleration a_IDM      = a · [ 1 − (v/v0)^δ − (s*/s)² ]

export interface IDMParams {
  v0: number; // desired speed (m/s)
  T: number; // safe time headway (s)
  a: number; // max acceleration (m/s²)
  b: number; // comfortable deceleration (m/s²)
  s0: number; // minimum bumper-to-bumper gap (m)
  delta: number; // acceleration exponent
}

export const DEFAULT_IDM: IDMParams = {
  v0: 22,
  T: 1.5,
  a: 1.2,
  b: 1.8,
  s0: 2.5,
  delta: 4,
};

/**
 * @param v      current speed
 * @param gap    bumper-to-bumper distance to the lead vehicle (m). Use a large
 *               value (e.g. 1000) when there is no lead.
 * @param dv     approach rate = v - vLead (positive means closing in)
 */
export function idmAcceleration(v: number, gap: number, dv: number, p: IDMParams): number {
  const g = Math.max(gap, 0.1);
  const sStar = p.s0 + Math.max(0, v * p.T + (v * dv) / (2 * Math.sqrt(p.a * p.b)));
  const freeRoad = 1 - Math.pow(v / p.v0, p.delta);
  const interaction = (sStar / g) ** 2;
  const accel = p.a * (freeRoad - interaction);
  // Clamp braking to something physically sane so ambient cars don't teleport.
  return Math.max(accel, -8);
}
