// Pure math, no DOM/three.js dependency -- lives in public/ (not
// lib/) because it's only ever needed client-side (the server has no
// use for a circle fit; it only ever visualizes whatever the browser
// currently has buffered). public/package.json sets `"type":
// "module"` so this can be both `import`ed by app.js in the browser
// and unit tested directly via `node:test` + dynamic `import()`, with
// no build step either way -- see test/circle-fit.test.js.

/**
 * Least-squares circle fit (Kasa method): finds the circle {cx, cy, r}
 * that best fits a set of 2D points in the algebraic-distance sense.
 * Simple and fast (a single 3x3 linear solve), which is what a
 * "best-fit circle" overlay needs -- not a true geometric
 * (orthogonal-distance) fit, which is iterative and overkill here.
 *
 * Returns null if there are fewer than 3 points, or the points are
 * (near-)collinear and no circle can be meaningfully fit.
 *
 * @param {{x: number, y: number}[]} points
 * @returns {{cx: number, cy: number, r: number} | null}
 */
export function fitCircle(points) {
  const n = points.length;
  if (n < 3) return null;

  // Solve for A, B, C in: x^2 + y^2 = A*x + B*y + C, the linear form
  // of (x-cx)^2 + (y-cy)^2 = r^2 with A = 2*cx, B = 2*cy,
  // C = r^2 - cx^2 - cy^2 -- via the normal equations of ordinary
  // least squares.
  let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, sxz = 0, syz = 0, sz = 0;
  for (const { x, y } of points) {
    const z = x * x + y * y;
    sx += x;
    sy += y;
    sxx += x * x;
    syy += y * y;
    sxy += x * y;
    sxz += x * z;
    syz += y * z;
    sz += z;
  }

  // | sxx sxy sx | |A|   |sxz|
  // | sxy syy sy | |B| = |syz|
  // | sx  sy  n  | |C|   |sz |
  const solution = solve3x3(
    [sxx, sxy, sx],
    [sxy, syy, sy],
    [sx, sy, n],
    [sxz, syz, sz],
  );
  if (!solution) return null;

  const [a, b, c] = solution;
  const cx = a / 2;
  const cy = b / 2;
  const rSquared = c + cx * cx + cy * cy;
  if (!(rSquared > 0)) return null;

  return { cx, cy, r: Math.sqrt(rSquared) };
}

/** Solves a 3x3 linear system via Cramer's rule; null if singular. */
function solve3x3([a11, a12, a13], [a21, a22, a23], [a31, a32, a33], [b1, b2, b3]) {
  const det = determinant3x3(a11, a12, a13, a21, a22, a23, a31, a32, a33);
  if (Math.abs(det) < 1e-9) return null;

  const detA = determinant3x3(b1, a12, a13, b2, a22, a23, b3, a32, a33);
  const detB = determinant3x3(a11, b1, a13, a21, b2, a23, a31, b3, a33);
  const detC = determinant3x3(a11, a12, b1, a21, a22, b2, a31, a32, b3);

  return [detA / det, detB / det, detC / det];
}

function determinant3x3(a11, a12, a13, a21, a22, a23, a31, a32, a33) {
  return (
    a11 * (a22 * a33 - a23 * a32) -
    a12 * (a21 * a33 - a23 * a31) +
    a13 * (a21 * a32 - a22 * a31)
  );
}
