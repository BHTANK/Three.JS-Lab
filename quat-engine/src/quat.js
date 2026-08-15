/**
 * Hamilton quaternion kernel — scalar-first [w, x, y, z].
 *
 * Convention lock (Nuvola Quaternion Engine Room / Solà arXiv:1711.02508):
 *   algebra     Hamilton, ij = +k, ijk = −1
 *   carrier     q = [w, x, y, z]
 *   frame       local → global,  v_G = q ⊗ v ⊗ q⁻¹
 *   body rate   q̇ = ½ q ⊗ ω_local
 *
 * Three.js stores (x, y, z, w). Convert only at the mesh/camera boundary.
 * Never flip signs inside a product. Never mix Euler in the hot path.
 */

export const EPS = 1e-9;

export function create(w = 1, x = 0, y = 0, z = 0) {
  return [w, x, y, z];
}

export function identity() {
  return [1, 0, 0, 0];
}

export function copy(q) {
  return [q[0], q[1], q[2], q[3]];
}

export function set(out, w, x, y, z) {
  out[0] = w; out[1] = x; out[2] = y; out[3] = z;
  return out;
}

export function cloneInto(out, q) {
  out[0] = q[0]; out[1] = q[1]; out[2] = q[2]; out[3] = q[3];
  return out;
}

/** Hamilton product: (a ⊗ b)_w = aw bw − a·b */
export function mul(a, b, out = [0, 0, 0, 0]) {
  const aw = a[0], ax = a[1], ay = a[2], az = a[3];
  const bw = b[0], bx = b[1], by = b[2], bz = b[3];
  out[0] = aw * bw - ax * bx - ay * by - az * bz;
  out[1] = aw * bx + ax * bw + ay * bz - az * by;
  out[2] = aw * by - ax * bz + ay * bw + az * bx;
  out[3] = aw * bz + ax * by - ay * bx + az * bw;
  return out;
}

/** Apply `first` then `second` (composition on SO(3)). */
export function compose(first, second, out = [0, 0, 0, 0]) {
  return mul(second, first, out);
}

export function conjugate(q, out = [0, 0, 0, 0]) {
  out[0] = q[0];
  out[1] = -q[1];
  out[2] = -q[2];
  out[3] = -q[3];
  return out;
}

export function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
}

export function length(q) {
  return Math.sqrt(dot(q, q));
}

export function normalize(q, out = [0, 0, 0, 0]) {
  const n = length(q);
  if (n < EPS) return set(out, 1, 0, 0, 0);
  const inv = 1 / n;
  out[0] = q[0] * inv;
  out[1] = q[1] * inv;
  out[2] = q[2] * inv;
  out[3] = q[3] * inv;
  return out;
}

export function inverse(q, out = [0, 0, 0, 0]) {
  const n2 = dot(q, q);
  if (n2 < EPS) return set(out, 1, 0, 0, 0);
  const inv = 1 / n2;
  out[0] = q[0] * inv;
  out[1] = -q[1] * inv;
  out[2] = -q[2] * inv;
  out[3] = -q[3] * inv;
  return out;
}

/** Rotate a 3-vector by q (active / local→global). */
export function rotateVec(q, v, out = [0, 0, 0]) {
  const qw = q[0], qx = q[1], qy = q[2], qz = q[3];
  const vx = v[0], vy = v[1], vz = v[2];
  const tx = 2 * (qy * vz - qz * vy);
  const ty = 2 * (qz * vx - qx * vz);
  const tz = 2 * (qx * vy - qy * vx);
  out[0] = vx + qw * tx + qy * tz - qz * ty;
  out[1] = vy + qw * ty + qz * tx - qx * tz;
  out[2] = vz + qw * tz + qx * ty - qy * tx;
  return out;
}

/** Solà lowercase exp on a pure quaternion: exp([0, v]). */
export function expPure(v, out = [0, 0, 0, 0]) {
  const m = Math.hypot(v[0], v[1], v[2]);
  if (m < EPS) return set(out, 1, 0, 0, 0);
  const s = Math.sin(m) / m;
  return set(out, Math.cos(m), v[0] * s, v[1] * s, v[2] * s);
}

/** Inverse of expPure. Returns the 3-vector of a unit quaternion's log. */
export function logPure(q, out = [0, 0, 0]) {
  const vlen = Math.hypot(q[1], q[2], q[3]);
  if (vlen < EPS) {
    out[0] = out[1] = out[2] = 0;
    return out;
  }
  const w = Math.max(-1, Math.min(1, q[0]));
  const s = Math.acos(w) / vlen;
  out[0] = q[1] * s;
  out[1] = q[2] * s;
  out[2] = q[3] * s;
  return out;
}

/** Solà Exp(φ) = exp(φ/2): axis-angle vector φ → unit quaternion. */
export function Exp(phi, out = [0, 0, 0, 0]) {
  return expPure([phi[0] * 0.5, phi[1] * 0.5, phi[2] * 0.5], out);
}

export function Log(q, out = [0, 0, 0]) {
  const v = logPure(q);
  out[0] = v[0] * 2;
  out[1] = v[1] * 2;
  out[2] = v[2] * 2;
  return out;
}

/** Axis-angle (axis unit, angle radians) → quaternion. */
export function fromAxisAngle(axis, angle, out = [0, 0, 0, 0]) {
  const h = angle * 0.5;
  const s = Math.sin(h);
  return set(out, Math.cos(h), axis[0] * s, axis[1] * s, axis[2] * s);
}

/** Yaw (Y-up) then pitch — character / vehicle heading. */
export function fromYawPitch(yaw, pitch, out = [0, 0, 0, 0]) {
  const hy = yaw * 0.5, hp = pitch * 0.5;
  const cy = Math.cos(hy), sy = Math.sin(hy);
  const cp = Math.cos(hp), sp = Math.sin(hp);
  // q_yaw(Y) ⊗ q_pitch(X) — Three.js camera looks down local −Z
  return set(out, cy * cp, cy * sp, sy * cp, -sy * sp);
}

/** Shortest rotation taking unit vector `from` onto `to`. */
export function fromTo(from, to, out = [0, 0, 0, 0]) {
  const fx = from[0], fy = from[1], fz = from[2];
  const tx = to[0], ty = to[1], tz = to[2];
  const d = fx * tx + fy * ty + fz * tz;
  if (d < -0.999999) {
    let ax = 0, ay = 1, az = 0;
    if (Math.abs(fx) < 0.9) {
      ax = fy * 0 - fz * 1;
      ay = fz * 0 - fx * 0;
      az = fx * 1 - fy * 0;
    } else {
      ax = fy * 0 - fz * 0;
      ay = fz * 1 - fx * 0;
      az = fx * 0 - fy * 1;
    }
    const n = Math.hypot(ax, ay, az) || 1;
    return fromAxisAngle([ax / n, ay / n, az / n], Math.PI, out);
  }
  out[0] = 1 + d;
  out[1] = fy * tz - fz * ty;
  out[2] = fz * tx - fx * tz;
  out[3] = fx * ty - fy * tx;
  return normalize(out, out);
}

/** Look down local −Z toward `dir` (world), with `up` as the world up hint. */
export function lookRotation(dir, up = [0, 1, 0], out = [0, 0, 0, 0]) {
  const n = Math.hypot(dir[0], dir[1], dir[2]);
  if (n < EPS) return set(out, 1, 0, 0, 0);
  const fx = dir[0] / n, fy = dir[1] / n, fz = dir[2] / n;
  return fromTo([0, 0, -1], [fx, fy, fz], out);
}

/** Shortest-arc slerp. Flips sign so dot ≥ 0 (double cover). */
export function slerp(a, b, t, out = [0, 0, 0, 0]) {
  let d = dot(a, b);
  let bw = b[0], bx = b[1], by = b[2], bz = b[3];
  if (d < 0) {
    d = -d;
    bw = -bw; bx = -bx; by = -by; bz = -bz;
  }
  if (d > 0.9995) {
    out[0] = a[0] + t * (bw - a[0]);
    out[1] = a[1] + t * (bx - a[1]);
    out[2] = a[2] + t * (by - a[2]);
    out[3] = a[3] + t * (bz - a[3]);
    return normalize(out, out);
  }
  const th = Math.acos(Math.min(1, d));
  const s = Math.sin(th);
  const w0 = Math.sin((1 - t) * th) / s;
  const w1 = Math.sin(t * th) / s;
  return set(out, w0 * a[0] + w1 * bw, w0 * a[1] + w1 * bx, w0 * a[2] + w1 * by, w0 * a[3] + w1 * bz);
}

export function nlerp(a, b, t, out = [0, 0, 0, 0]) {
  let s = 1;
  if (dot(a, b) < 0) s = -1;
  out[0] = a[0] + t * (s * b[0] - a[0]);
  out[1] = a[1] + t * (s * b[1] - a[1]);
  out[2] = a[2] + t * (s * b[2] - a[2]);
  out[3] = a[3] + t * (s * b[3] - a[3]);
  return normalize(out, out);
}

/** Column-major 3×3 rotation. Use this once, then transform many verts as a matrix. */
export function toMat3(q, out = new Float32Array(9)) {
  const w = q[0], x = q[1], y = q[2], z = q[3];
  const xx = x * x, yy = y * y, zz = z * z;
  const xy = x * y, xz = x * z, yz = y * z;
  const wx = w * x, wy = w * y, wz = w * z;
  out[0] = 1 - 2 * (yy + zz);
  out[1] = 2 * (xy + wz);
  out[2] = 2 * (xz - wy);
  out[3] = 2 * (xy - wz);
  out[4] = 1 - 2 * (xx + zz);
  out[5] = 2 * (yz + wx);
  out[6] = 2 * (xz + wy);
  out[7] = 2 * (yz - wx);
  out[8] = 1 - 2 * (xx + yy);
  return out;
}

/**
 * Write into a THREE.Quaternion (x,y,z,w) from Hamilton [w,x,y,z].
 * This is the only legal Three.js boundary.
 */
export function toThree(q, threeQuat) {
  threeQuat.set(q[1], q[2], q[3], q[0]);
  return threeQuat;
}

export function fromThree(threeQuat, out = [0, 0, 0, 0]) {
  return set(out, threeQuat.w, threeQuat.x, threeQuat.y, threeQuat.z);
}

export function eq(a, b, eps = 1e-6) {
  const d = Math.abs(dot(a, b));
  return Math.abs(d - 1) < eps || (
    Math.abs(a[0] - b[0]) < eps &&
    Math.abs(a[1] - b[1]) < eps &&
    Math.abs(a[2] - b[2]) < eps &&
    Math.abs(a[3] - b[3]) < eps
  );
}

export function fmt(q, digits = 4) {
  const f = (n) => n.toFixed(digits);
  return `[${f(q[0])}, ${f(q[1])}, ${f(q[2])}, ${f(q[3])}]`;
}
