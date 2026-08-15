/**
 * Arcade-to-sim chassis. Heading is a quaternion.
 * Enough for Forza-style feel (steer, accel, lateral grip, air) without a full Pacejka stack.
 * Swap the tire model later; do not swap the orientation carrier.
 */

import * as Q from './quat.js';
import { makeBody, stepBodyRate } from './integrate.js';
import { collideGround } from './physics.js';

const _fwd = [0, 0, 0];
const _right = [0, 0, 0];

export class Vehicle {
  constructor(pos = [0, 1, 0]) {
    this.body = makeBody(pos);
    this.body.radius = 0.7;
    this.body.mass = 1400;
    this.body.invMass = 1 / 1400;
    this.steer = 0;
    this.steerMax = 0.55;
    this.engine = 34;
    this.brake = 48;
    this.grip = 18;
    this.drag = 0.38;
    this.speed = 0;
  }

  tick(input, dt, getHeight) {
    const [ax, az] = input.axis();
    const throttle = az;
    const steerIn = ax;
    this.steer += (steerIn * this.steerMax - this.steer) * Math.min(1, dt * 8);

    const braking = input.down('Space') || input.down('KeyS') && az < -0.2;
    this.speed += throttle * this.engine * dt;
    if (braking) this.speed -= Math.sign(this.speed || 1) * this.brake * dt;
    this.speed *= Math.pow(this.drag, dt);
    this.speed = Math.max(-18, Math.min(58, this.speed));

    this.body.omega[0] = 0;
    this.body.omega[1] = this.steer * this.speed * 0.18;
    this.body.omega[2] = 0;
    stepBodyRate(this.body.q, this.body.omega, dt, this.body.q);

    Q.rotateVec(this.body.q, [0, 0, -1], _fwd);
    Q.rotateVec(this.body.q, [1, 0, 0], _right);

    // Keep velocity mostly along heading; kill lateral slip (arcade grip).
    const vx = this.body.vel[0];
    const vz = this.body.vel[2];
    const lat = vx * _right[0] + vz * _right[2];
    const k = 1 - Math.min(1, this.grip * dt);
    this.body.vel[0] = _fwd[0] * this.speed + _right[0] * lat * k;
    this.body.vel[2] = _fwd[2] * this.speed + _right[2] * lat * k;
    this.body.vel[1] += -9.81 * dt;
    this.body.pos[0] += this.body.vel[0] * dt;
    this.body.pos[1] += this.body.vel[1] * dt;
    this.body.pos[2] += this.body.vel[2] * dt;
    collideGround(this.body, getHeight, dt);
  }
}
