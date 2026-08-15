/**
 * Spatial hash + impulse resolve.
 * Hash / sleep / Baumgarte / Coulomb friction ported from this lab's Aether Kernel V2
 * (sphere + AABB, 60 Hz). Orientation stays on the body quaternion — no Euler here.
 */

export class SpatialHash {
  constructor(cellSize = 4) {
    this.cellSize = cellSize;
    this.grid = new Map();
  }
  key(x, y, z) { return x + ',' + y + ',' + z; }
  clear() { this.grid.clear(); }
  _cell(v) { return Math.floor(v / this.cellSize); }
  insert(entity) {
    const p = entity.pos;
    const r = entity.radius || 0.5;
    const x0 = this._cell(p[0] - r), x1 = this._cell(p[0] + r);
    const y0 = this._cell(p[1] - r), y1 = this._cell(p[1] + r);
    const z0 = this._cell(p[2] - r), z1 = this._cell(p[2] + r);
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        for (let z = z0; z <= z1; z++) {
          const k = this.key(x, y, z);
          let cell = this.grid.get(k);
          if (!cell) { cell = []; this.grid.set(k, cell); }
          cell.push(entity);
        }
      }
    }
  }
  query(pos, radius, out = []) {
    out.length = 0;
    const x0 = this._cell(pos[0] - radius), x1 = this._cell(pos[0] + radius);
    const y0 = this._cell(pos[1] - radius), y1 = this._cell(pos[1] + radius);
    const z0 = this._cell(pos[2] - radius), z1 = this._cell(pos[2] + radius);
    const seen = new Set();
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        for (let z = z0; z <= z1; z++) {
          const cell = this.grid.get(this.key(x, y, z));
          if (!cell) continue;
          for (const e of cell) {
            if (seen.has(e)) continue;
            seen.add(e);
            out.push(e);
          }
        }
      }
    }
    return out;
  }
  getCellCount() { return this.grid.size; }
}

export function groundY(pos, getHeight) {
  if (typeof getHeight === 'function') return getHeight(pos[0], pos[2]);
  return 0;
}

export function collideGround(body, getHeight, dt) {
  const gy = groundY(body.pos, getHeight);
  const feet = gy + (body.radius || 0.5);
  if (body.pos[1] <= feet) {
    body.pos[1] = feet;
    if (body.vel[1] < 0) body.vel[1] = 0;
    body.onGround = true;
  } else {
    body.onGround = false;
  }
}

function invMassOf(b) {
  if (b.isStatic) return 0;
  if (b.invMass != null) return b.invMass;
  return b.mass > 0 ? 1 / b.mass : 0;
}

/** Sphere–sphere contact. Writes n (B→A) and returns penetration (>0 = overlap). */
export function sphereContact(a, b, n) {
  const dx = a.pos[0] - b.pos[0];
  const dy = a.pos[1] - b.pos[1];
  const dz = a.pos[2] - b.pos[2];
  const ra = a.radius || 0.5;
  const rb = b.radius || 0.5;
  const d = Math.hypot(dx, dy, dz);
  const pen = ra + rb - d;
  if (d < 1e-8) {
    n[0] = 0; n[1] = 1; n[2] = 0;
    return pen;
  }
  n[0] = dx / d; n[1] = dy / d; n[2] = dz / d;
  return pen;
}

/**
 * Impulse + friction + Baumgarte correction. Numbers match Aether V2 defaults.
 */
export function resolveSpheres(a, b, opt = {}) {
  const n = [0, 0, 0];
  const pen = sphereContact(a, b, n);
  if (pen <= 0) return 0;
  const invA = invMassOf(a), invB = invMassOf(b);
  const invSum = invA + invB;
  if (invSum === 0) return 0;

  const rvx = a.vel[0] - b.vel[0];
  const rvy = a.vel[1] - b.vel[1];
  const rvz = a.vel[2] - b.vel[2];
  const relN = rvx * n[0] + rvy * n[1] + rvz * n[2];

  const bounce = Math.min(a.bounce ?? 0.25, b.bounce ?? 0.25);
  const e = Math.abs(relN) < 0.4 ? bounce * 0.35 : bounce;
  if (relN <= 0.01) {
    const j = -(1 + e) * relN / invSum;
    if (invA > 0) {
      a.vel[0] += n[0] * j * invA;
      a.vel[1] += n[1] * j * invA;
      a.vel[2] += n[2] * j * invA;
    }
    if (invB > 0) {
      b.vel[0] -= n[0] * j * invB;
      b.vel[1] -= n[1] * j * invB;
      b.vel[2] -= n[2] * j * invB;
    }
    const tvx = (a.vel[0] - b.vel[0]) - n[0] * ((a.vel[0] - b.vel[0]) * n[0] + (a.vel[1] - b.vel[1]) * n[1] + (a.vel[2] - b.vel[2]) * n[2]);
    const tvy = (a.vel[1] - b.vel[1]) - n[1] * ((a.vel[0] - b.vel[0]) * n[0] + (a.vel[1] - b.vel[1]) * n[1] + (a.vel[2] - b.vel[2]) * n[2]);
    const tvz = (a.vel[2] - b.vel[2]) - n[2] * ((a.vel[0] - b.vel[0]) * n[0] + (a.vel[1] - b.vel[1]) * n[1] + (a.vel[2] - b.vel[2]) * n[2]);
    const tLen = Math.hypot(tvx, tvy, tvz);
    if (tLen > 1e-5) {
      const tx = tvx / tLen, ty = tvy / tLen, tz = tvz / tLen;
      const mu = Math.sqrt((a.friction ?? 0.45) * (b.friction ?? 0.45));
      let jt = -tLen / invSum;
      const maxF = Math.abs(j) * mu;
      if (jt < -maxF) jt = -maxF;
      if (jt > maxF) jt = maxF;
      if (invA > 0) {
        a.vel[0] += tx * jt * invA;
        a.vel[1] += ty * jt * invA;
        a.vel[2] += tz * jt * invA;
      }
      if (invB > 0) {
        b.vel[0] -= tx * jt * invB;
        b.vel[1] -= ty * jt * invB;
        b.vel[2] -= tz * jt * invB;
      }
    }
  }

  const slop = opt.slop ?? 0.008;
  const baums = opt.baums ?? 0.28;
  if (pen > slop) {
    const corr = (pen - slop) * baums / invSum;
    if (invA > 0) {
      a.pos[0] += n[0] * corr * invA;
      a.pos[1] += n[1] * corr * invA;
      a.pos[2] += n[2] * corr * invA;
    }
    if (invB > 0) {
      b.pos[0] -= n[0] * corr * invB;
      b.pos[1] -= n[1] * corr * invB;
      b.pos[2] -= n[2] * corr * invB;
    }
  }
  if (n[1] > 0.45 && invA > 0) a.onGround = true;
  if (n[1] < -0.45 && invB > 0) b.onGround = true;
  return pen;
}

export class PhysicsWorld {
  constructor() {
    this.bodies = [];
    this.hash = new SpatialHash(2);
    this.gravity = [0, -18, 0];
    this.linearDamp = 0.08;
    this.sleepVel = 0.08;
    this.sleepTime = 0.45;
    this.getHeight = null;
  }
  add(body) {
    if (body.invMass == null) body.invMass = body.mass > 0 && !body.isStatic ? 1 / body.mass : 0;
    this.bodies.push(body);
    return body;
  }
  step(dt) {
    this.hash.clear();
    for (const b of this.bodies) {
      if (!b.isStatic && !b.sleeping) {
        b.vel[0] += this.gravity[0] * dt;
        b.vel[1] += this.gravity[1] * dt;
        b.vel[2] += this.gravity[2] * dt;
        const damp = Math.max(0, 1 - this.linearDamp * dt);
        b.vel[0] *= damp;
        b.vel[2] *= damp;
        b.pos[0] += b.vel[0] * dt;
        b.pos[1] += b.vel[1] * dt;
        b.pos[2] += b.vel[2] * dt;
        const sp2 = b.vel[0] * b.vel[0] + b.vel[1] * b.vel[1] + b.vel[2] * b.vel[2];
        if (sp2 < this.sleepVel * this.sleepVel) {
          b.sleepTimer = (b.sleepTimer || 0) + dt;
          if (b.sleepTimer >= this.sleepTime) {
            b.sleeping = true;
            b.vel[0] = b.vel[1] = b.vel[2] = 0;
            b.sleepTimer = 0;
          }
        } else {
          b.sleepTimer = 0;
        }
      }
      if (this.getHeight) collideGround(b, this.getHeight, dt);
      this.hash.insert(b);
    }
    const nearby = [];
    for (let i = 0; i < this.bodies.length; i++) {
      const a = this.bodies[i];
      this.hash.query(a.pos, (a.radius || 0.5) + 2, nearby);
      for (const b of nearby) {
        if (a === b) continue;
        if ((a._id || 0) > (b._id || 0)) continue;
        if (a.isStatic && b.isStatic) continue;
        if (a.sleeping && b.sleeping) continue;
        resolveSpheres(a, b);
      }
    }
  }
}
