/**
 * Quaternion-space rays. Direction is the camera/body local −Z rotated by q.
 */

import * as Q from './quat.js';

export function rayFromQuat(origin, q, out = { origin: [0, 0, 0], dir: [0, 0, -1] }) {
  out.origin[0] = origin[0];
  out.origin[1] = origin[1];
  out.origin[2] = origin[2];
  Q.rotateVec(q, [0, 0, -1], out.dir);
  return out;
}

export function rayVsSphere(origin, dir, center, radius) {
  const ox = origin[0] - center[0];
  const oy = origin[1] - center[1];
  const oz = origin[2] - center[2];
  const b = ox * dir[0] + oy * dir[1] + oz * dir[2];
  const c = ox * ox + oy * oy + oz * oz - radius * radius;
  const disc = b * b - c;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  const t0 = -b - s;
  const t1 = -b + s;
  if (t1 < 0) return null;
  const t = t0 >= 0 ? t0 : t1;
  return {
    t,
    point: [origin[0] + dir[0] * t, origin[1] + dir[1] * t, origin[2] + dir[2] * t],
  };
}

export function closestHit(origin, dir, bodies, range = 80) {
  let best = null;
  for (const b of bodies) {
    const hit = rayVsSphere(origin, dir, b.pos, b.radius || 0.5);
    if (!hit || hit.t < 0 || hit.t > range) continue;
    if (!best || hit.t < best.t) best = { ...hit, body: b };
  }
  return best;
}
