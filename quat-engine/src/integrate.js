/**
 * Solà body-rate integration.
 *   q ← normalize( q ⊗ Exp(ω_local · dt) )
 * Body rate is ALWAYS right-multiplied. World rate would left-multiply.
 */

import * as Q from './quat.js';

const _d = [0, 0, 0, 0];
const _phi = [0, 0, 0];

export function stepBodyRate(q, omegaLocal, dt, out = q) {
  _phi[0] = omegaLocal[0] * dt;
  _phi[1] = omegaLocal[1] * dt;
  _phi[2] = omegaLocal[2] * dt;
  Q.Exp(_phi, _d);
  Q.mul(q, _d, out);
  return Q.normalize(out, out);
}

/** World-rate (left multiply). Prefer body rate unless the rate is already in world axes. */
export function stepWorldRate(q, omegaWorld, dt, out = q) {
  _phi[0] = omegaWorld[0] * dt;
  _phi[1] = omegaWorld[1] * dt;
  _phi[2] = omegaWorld[2] * dt;
  Q.Exp(_phi, _d);
  Q.mul(_d, q, out);
  return Q.normalize(out, out);
}

/** Semi-implicit Euler on a rigid body with quat orientation. */
export function stepRigid(body, dt, gravity = [0, -9.81, 0]) {
  body.vel[0] += (body.acc[0] + gravity[0]) * dt;
  body.vel[1] += (body.acc[1] + gravity[1]) * dt;
  body.vel[2] += (body.acc[2] + gravity[2]) * dt;
  body.pos[0] += body.vel[0] * dt;
  body.pos[1] += body.vel[1] * dt;
  body.pos[2] += body.vel[2] * dt;
  stepBodyRate(body.q, body.omega, dt, body.q);
  body.acc[0] = body.acc[1] = body.acc[2] = 0;
  return body;
}

/**
 * Fixed-step accumulator. Call with a variable frame dt; `fn(h)` runs 0..N times.
 * Pattern from the lab Aether Kernel (60 Hz, capped catch-up).
 */
export function accumulate(state, dt, stepFn, h = 1 / 60, maxSteps = 8) {
  state.acc = (state.acc || 0) + dt;
  let n = 0;
  while (state.acc >= h && n < maxSteps) {
    stepFn(h);
    state.acc -= h;
    n++;
  }
  if (n === maxSteps) state.acc = 0;
  return state.acc / h;
}

export function makeBody(pos = [0, 0, 0]) {
  return {
    pos: pos.slice(),
    vel: [0, 0, 0],
    acc: [0, 0, 0],
    q: Q.identity(),
    omega: [0, 0, 0],
    mass: 1,
    invMass: 1,
    radius: 0.5,
    onGround: false,
    bounce: 0.05,
    friction: 0.45,
    sleeping: false,
    sleepTimer: 0,
    isStatic: false,
  };
}
