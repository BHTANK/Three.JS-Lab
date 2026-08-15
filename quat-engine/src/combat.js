/**
 * Hitscan + projectile combat (Crimson / arena class).
 * Projectiles carry a Hamilton quaternion; travel is rotateVec(q, [0,0,-1]).
 */

import * as Q from './quat.js';
import { rayFromQuat, closestHit } from './ray.js';

const _ray = { origin: [0, 0, 0], dir: [0, 0, -1] };

export class Projectile {
  constructor(origin, q, speed = 48, life = 2.2) {
    this.pos = origin.slice();
    this.q = Q.copy(q);
    this.speed = speed;
    this.life = life;
    this.alive = true;
    this.radius = 0.12;
    this.damage = 25;
  }
  tick(dt) {
    this.life -= dt;
    if (this.life <= 0) {
      this.alive = false;
      return;
    }
    Q.rotateVec(this.q, [0, 0, -1], _ray.dir);
    this.pos[0] += _ray.dir[0] * this.speed * dt;
    this.pos[1] += _ray.dir[1] * this.speed * dt;
    this.pos[2] += _ray.dir[2] * this.speed * dt;
  }
}

export class Combat {
  constructor() {
    this.projectiles = [];
    this.cooldown = 0;
    this.rate = 0.14;
    this.hitscan = false;
    this.range = 90;
    this.lastHit = null;
  }

  tryFire(origin, q, eye = 1.4) {
    if (this.cooldown > 0) return null;
    this.cooldown = this.rate;
    const o = [origin[0], origin[1] + eye, origin[2]];
    if (this.hitscan) {
      rayFromQuat(o, q, _ray);
      return { kind: 'hitscan', origin: o, dir: _ray.dir.slice() };
    }
    const p = new Projectile(o, q);
    this.projectiles.push(p);
    return p;
  }

  tick(dt, targets) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.lastHit = null;
    for (const p of this.projectiles) {
      if (!p.alive) continue;
      p.tick(dt);
      for (const t of targets) {
        if (t.dead || t.health <= 0) continue;
        const dx = p.pos[0] - t.pos[0];
        const dy = p.pos[1] - t.pos[1];
        const dz = p.pos[2] - t.pos[2];
        const r = (t.radius || 0.6) + p.radius;
        if (dx * dx + dy * dy + dz * dz <= r * r) {
          t.health -= p.damage;
          if (t.health <= 0) t.dead = true;
          p.alive = false;
          this.lastHit = t;
          break;
        }
      }
    }
    this.projectiles = this.projectiles.filter((p) => p.alive);
  }

  hitscanAgainst(origin, q, targets, eye = 1.4) {
    const o = [origin[0], origin[1] + eye, origin[2]];
    rayFromQuat(o, q, _ray);
    return closestHit(o, _ray.dir, targets, this.range);
  }
}

export function makeDummy(pos, health = 40) {
  return {
    pos: pos.slice(),
    vel: [0, 0, 0],
    radius: 0.55,
    health,
    dead: false,
    isStatic: true,
  };
}
