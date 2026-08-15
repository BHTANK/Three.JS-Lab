/**
 * Cameras that never call lookAt in the integration path.
 * Orientation is a Hamilton quaternion applied to THREE.Camera at the boundary.
 * Pointer-lock *feel* follows mrdoob PointerLockControls (yaw/pitch scalars),
 * but the stored orientation is always a Hamilton quaternion.
 */

import * as Q from './quat.js';

const _fwd = [0, 0, 0];

export class QuatCamera {
  constructor(threeCamera) {
    this.camera = threeCamera;
    this.q = Q.identity();
    this.pos = [0, 2, 8];
    this.mode = 'chase'; // chase | first | orbit | fly
    this.chaseBack = 7;
    this.chaseUp = 2.4;
    this.orbitRadius = 10;
  }

  /** First / chase look from yaw+pitch (Y-up). */
  setLook(yaw, pitch) {
    Q.fromYawPitch(yaw, pitch, this.q);
  }

  apply() {
    this.camera.position.set(this.pos[0], this.pos[1], this.pos[2]);
    Q.toThree(this.q, this.camera.quaternion);
  }

  chase(targetPos, targetQ, yaw, pitch) {
    this.mode = 'chase';
    this.setLook(yaw, pitch);
    Q.rotateVec(this.q, [0, 0, 1], _fwd);
    this.pos[0] = targetPos[0] + _fwd[0] * this.chaseBack;
    this.pos[1] = targetPos[1] + this.chaseUp + _fwd[1] * this.chaseBack;
    this.pos[2] = targetPos[2] + _fwd[2] * this.chaseBack;
    this.apply();
  }

  firstPerson(targetPos, yaw, pitch, eye = 1.65) {
    this.mode = 'first';
    this.setLook(yaw, pitch);
    this.pos[0] = targetPos[0];
    this.pos[1] = targetPos[1] + eye;
    this.pos[2] = targetPos[2];
    this.apply();
  }

  orbit(targetPos, yaw, pitch, radius) {
    this.mode = 'orbit';
    this.setLook(yaw, pitch);
    const r = radius ?? this.orbitRadius;
    Q.rotateVec(this.q, [0, 0, 1], _fwd);
    this.pos[0] = targetPos[0] + _fwd[0] * r;
    this.pos[1] = targetPos[1] + Math.sin(pitch + 0.35) * r * 0.45 + 2;
    this.pos[2] = targetPos[2] + _fwd[2] * r;
    this.apply();
  }

  fly(pos, yaw, pitch) {
    this.mode = 'fly';
    this.setLook(yaw, pitch);
    this.pos[0] = pos[0];
    this.pos[1] = pos[1];
    this.pos[2] = pos[2];
    this.apply();
  }
}

export function yawFromQuat(q) {
  // heading around Y from Hamilton q
  return Math.atan2(2 * (q[0] * q[2] + q[1] * q[3]), 1 - 2 * (q[2] * q[2] + q[1] * q[1]));
}
