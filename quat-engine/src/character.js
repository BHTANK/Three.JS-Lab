/** Walk / run / jump / fly. Heading is a Hamilton quaternion, not Euler yaw in the integrator. */

import * as Q from './quat.js';
import { makeBody, stepRigid } from './integrate.js';
import { collideGround } from './physics.js';

const _fwd = [0, 0, 0];
const _right = [0, 0, 0];
const _wish = [0, 0, 0];

export class Character {
  constructor(pos = [0, 1, 0]) {
    this.body = makeBody(pos);
    this.body.radius = 0.9;
    this.body.mass = 80;
    this.body.invMass = 1 / 80;
    this.speed = 8;
    this.sprint = 14;
    this.crouchSpeed = 3.2;
    this.jumpSpeed = 7;
    this.flySpeed = 16;
    this.mode = 'onFoot'; // onFoot | drive | fly
    this.crouch = false;
    this.health = 100;
  }

  tick(input, dt, getHeight, yaw) {
    if (input.down('KeyC') && !this._cLatch) {
      this.mode = this.mode === 'fly' ? 'onFoot' : 'fly';
      this._cLatch = true;
    }
    if (!input.down('KeyC')) this._cLatch = false;

    this.crouch = input.down('ControlLeft') || input.down('ControlRight') || input.down('KeyZ');
    Q.fromYawPitch(yaw, 0, this.body.q);
    Q.rotateVec(this.body.q, [0, 0, -1], _fwd);
    Q.rotateVec(this.body.q, [1, 0, 0], _right);
    const [ax, az] = input.axis();
    const fast = input.down('ShiftLeft') || input.down('ShiftRight');

    if (this.mode === 'fly') {
      const pitch = input.lookY || 0;
      Q.fromYawPitch(yaw, pitch, this.body.q);
      Q.rotateVec(this.body.q, [0, 0, -1], _fwd);
      const sp = this.flySpeed * (fast ? 2 : 1);
      this.body.vel[0] = _fwd[0] * az * sp + _right[0] * ax * sp;
      this.body.vel[1] = _fwd[1] * az * sp + ((input.down('Space') ? 1 : 0) - (this.crouch ? 1 : 0)) * sp;
      this.body.vel[2] = _fwd[2] * az * sp + _right[2] * ax * sp;
      this.body.pos[0] += this.body.vel[0] * dt;
      this.body.pos[1] += this.body.vel[1] * dt;
      this.body.pos[2] += this.body.vel[2] * dt;
      this.body.onGround = false;
      return;
    }

    const sp = this.crouch ? this.crouchSpeed : (fast ? this.sprint : this.speed);
    _wish[0] = _right[0] * ax + _fwd[0] * az;
    _wish[2] = _right[2] * ax + _fwd[2] * az;
    const wlen = Math.hypot(_wish[0], _wish[2]) || 1;
    this.body.vel[0] = (_wish[0] / wlen) * sp * Math.min(1, Math.hypot(ax, az));
    this.body.vel[2] = (_wish[2] / wlen) * sp * Math.min(1, Math.hypot(ax, az));
    if (input.down('Space') && this.body.onGround) {
      this.body.vel[1] = this.jumpSpeed;
      this.body.onGround = false;
    }
    stepRigid(this.body, dt);
    collideGround(this.body, getHeight, dt);
  }
}
