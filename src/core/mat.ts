// Minimal dense matrix helpers (row-major number[][]) for the Kalman filter.
// Sizes here are tiny (≤4×4) so clarity beats cleverness.

export type Mat = number[][];
export type Vec = number[];

export function zeros(r: number, c: number): Mat {
  return Array.from({ length: r }, () => new Array(c).fill(0));
}

export function identity(n: number): Mat {
  const m = zeros(n, n);
  for (let i = 0; i < n; i++) m[i][i] = 1;
  return m;
}

export function mul(a: Mat, b: Mat): Mat {
  const r = a.length;
  const k = b.length;
  const c = b[0].length;
  const out = zeros(r, c);
  for (let i = 0; i < r; i++) {
    for (let j = 0; j < c; j++) {
      let s = 0;
      for (let x = 0; x < k; x++) s += a[i][x] * b[x][j];
      out[i][j] = s;
    }
  }
  return out;
}

export function mulVec(a: Mat, v: Vec): Vec {
  const out = new Array(a.length).fill(0);
  for (let i = 0; i < a.length; i++) {
    let s = 0;
    for (let j = 0; j < v.length; j++) s += a[i][j] * v[j];
    out[i] = s;
  }
  return out;
}

export function transpose(a: Mat): Mat {
  const r = a.length;
  const c = a[0].length;
  const out = zeros(c, r);
  for (let i = 0; i < r; i++) for (let j = 0; j < c; j++) out[j][i] = a[i][j];
  return out;
}

export function add(a: Mat, b: Mat): Mat {
  return a.map((row, i) => row.map((v, j) => v + b[i][j]));
}

export function sub(a: Mat, b: Mat): Mat {
  return a.map((row, i) => row.map((v, j) => v - b[i][j]));
}

/** Inverse of a 2×2 matrix. */
export function inv2(m: Mat): Mat {
  const det = m[0][0] * m[1][1] - m[0][1] * m[1][0];
  const inv = Math.abs(det) < 1e-12 ? 0 : 1 / det;
  return [
    [m[1][1] * inv, -m[0][1] * inv],
    [-m[1][0] * inv, m[0][0] * inv],
  ];
}
