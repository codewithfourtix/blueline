// Tiny dense linear-system solvers used by the polynomial trajectory generators.
// Kept dependency-free so the whole sim core stays testable in isolation.

/** Solve a 2x2 system A x = b via Cramer's rule. Returns [x0, x1]. */
export function solve2(A: number[][], b: number[]): [number, number] {
  const det = A[0][0] * A[1][1] - A[0][1] * A[1][0];
  if (Math.abs(det) < 1e-12) return [0, 0];
  const x0 = (b[0] * A[1][1] - A[0][1] * b[1]) / det;
  const x1 = (A[0][0] * b[1] - b[0] * A[1][0]) / det;
  return [x0, x1];
}

/** Solve a 3x3 system A x = b via Gaussian elimination with partial pivoting. */
export function solve3(A: number[][], b: number[]): [number, number, number] {
  // Work on an augmented copy so we don't clobber the caller's arrays.
  const m = [
    [A[0][0], A[0][1], A[0][2], b[0]],
    [A[1][0], A[1][1], A[1][2], b[1]],
    [A[2][0], A[2][1], A[2][2], b[2]],
  ];

  for (let col = 0; col < 3; col++) {
    // Partial pivot: find the largest magnitude in this column at/below the diagonal.
    let pivot = col;
    for (let r = col + 1; r < 3; r++) {
      if (Math.abs(m[r][col]) > Math.abs(m[pivot][col])) pivot = r;
    }
    if (Math.abs(m[pivot][col]) < 1e-12) continue; // singular-ish; leave as-is
    if (pivot !== col) {
      const tmp = m[col];
      m[col] = m[pivot];
      m[pivot] = tmp;
    }
    // Eliminate below.
    for (let r = col + 1; r < 3; r++) {
      const f = m[r][col] / m[col][col];
      for (let c = col; c < 4; c++) m[r][c] -= f * m[col][c];
    }
  }

  // Back-substitution.
  const x = [0, 0, 0];
  for (let r = 2; r >= 0; r--) {
    let sum = m[r][3];
    for (let c = r + 1; c < 3; c++) sum -= m[r][c] * x[c];
    x[r] = Math.abs(m[r][r]) < 1e-12 ? 0 : sum / m[r][r];
  }
  return [x[0], x[1], x[2]];
}
