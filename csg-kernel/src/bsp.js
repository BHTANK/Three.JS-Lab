/**
 * Internal BSP primitives for CSGKernel (no three.js dependency).
 */
// ─── epsilon (tunable) ──────────────────────────────────────────────────────
export let EPS = 1e-5;
export function setEpsilon(v) { EPS = Math.max(1e-10, v); }
export function getEpsilon() { return EPS; }

// ─── Vector3 (kernel-local) ─────────────────────────────────────────────────
export class V3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x; this.y = y; this.z = z;
  }
  clone() { return new V3(this.x, this.y, this.z); }
  negated() { return new V3(-this.x, -this.y, -this.z); }
  plus(a) { return new V3(this.x + a.x, this.y + a.y, this.z + a.z); }
  minus(a) { return new V3(this.x - a.x, this.y - a.y, this.z - a.z); }
  times(s) { return new V3(this.x * s, this.y * s, this.z * s); }
  dividedBy(s) { return new V3(this.x / s, this.y / s, this.z / s); }
  dot(a) { return this.x * a.x + this.y * a.y + this.z * a.z; }
  lerp(a, t) { return this.plus(a.minus(this).times(t)); }
  length() { return Math.sqrt(this.dot(this)); }
  unit() {
    const L = this.length();
    return L > 0 ? this.dividedBy(L) : new V3(0, 1, 0);
  }
  cross(a) {
    return new V3(
      this.y * a.z - this.z * a.y,
      this.z * a.x - this.x * a.z,
      this.x * a.y - this.y * a.x
    );
  }
}

// ─── Vertex ─────────────────────────────────────────────────────────────────
export class Vertex {
  constructor(pos, normal, uv = null) {
    this.pos = pos;
    this.normal = normal;
    this.uv = uv;
  }
  clone() {
    return new Vertex(
      this.pos.clone(),
      this.normal.clone(),
      this.uv ? { u: this.uv.u, v: this.uv.v } : null
    );
  }
  flip() { this.normal = this.normal.negated(); }
  interpolate(other, t) {
    const uv = (this.uv && other.uv)
      ? { u: this.uv.u + (other.uv.u - this.uv.u) * t, v: this.uv.v + (other.uv.v - this.uv.v) * t }
      : (this.uv ? { u: this.uv.u, v: this.uv.v } : null);
    return new Vertex(
      this.pos.lerp(other.pos, t),
      this.normal.lerp(other.normal, t).unit(),
      uv
    );
  }
}

// ─── Plane ──────────────────────────────────────────────────────────────────
export class Plane {
  constructor(normal, w) {
    this.normal = normal;
    this.w = w;
  }
  clone() { return new Plane(this.normal.clone(), this.w); }
  flip() {
    this.normal = this.normal.negated();
    this.w = -this.w;
  }
  static fromPoints(a, b, c) {
    const n = b.minus(a).cross(c.minus(a)).unit();
    return new Plane(n, n.dot(a));
  }

  splitPolygon(polygon, coplanarFront, coplanarBack, front, back) {
    const COPLANAR = 0, FRONT = 1, BACK = 2, SPANNING = 3;
    let polygonType = 0;
    const types = [];
    const verts = polygon.vertices;

    for (let i = 0; i < verts.length; i++) {
      const t = this.normal.dot(verts[i].pos) - this.w;
      const type = (t < -EPS) ? BACK : (t > EPS) ? FRONT : COPLANAR;
      polygonType |= type;
      types.push(type);
    }

    switch (polygonType) {
      case COPLANAR:
        (this.normal.dot(polygon.plane.normal) > 0 ? coplanarFront : coplanarBack).push(polygon);
        break;
      case FRONT:
        front.push(polygon);
        break;
      case BACK:
        back.push(polygon);
        break;
      case SPANNING: {
        const f = [], b = [];
        for (let i = 0; i < verts.length; i++) {
          const j = (i + 1) % verts.length;
          const ti = types[i], tj = types[j];
          const vi = verts[i], vj = verts[j];
          if (ti !== BACK) f.push(vi);
          if (ti !== FRONT) b.push(ti !== BACK ? vi.clone() : vi);
          if ((ti | tj) === SPANNING) {
            const denom = this.normal.dot(vj.pos.minus(vi.pos));
            const t = Math.abs(denom) > 1e-12
              ? (this.w - this.normal.dot(vi.pos)) / denom
              : 0.5;
            const v = vi.interpolate(vj, t);
            f.push(v);
            b.push(v.clone());
          }
        }
        if (f.length >= 3) front.push(new Polygon(f, polygon.shared));
        if (b.length >= 3) back.push(new Polygon(b, polygon.shared));
        break;
      }
    }
  }
}

// ─── Polygon ────────────────────────────────────────────────────────────────
export class Polygon {
  constructor(vertices, shared = 0) {
    this.vertices = vertices;
    this.shared = shared;
    this.plane = Plane.fromPoints(vertices[0].pos, vertices[1].pos, vertices[2].pos);
  }
  clone() {
    return new Polygon(this.vertices.map(v => v.clone()), this.shared);
  }
  flip() {
    this.vertices.reverse();
    for (let i = 0; i < this.vertices.length; i++) this.vertices[i].flip();
    this.plane.flip();
  }
}

// ─── BSP Node ───────────────────────────────────────────────────────────────
export class Node {
  constructor(polygons) {
    this.plane = null;
    this.front = null;
    this.back = null;
    this.polygons = [];
    if (polygons) this.build(polygons);
  }

  clone() {
    const n = new Node();
    n.plane = this.plane && this.plane.clone();
    n.front = this.front && this.front.clone();
    n.back = this.back && this.back.clone();
    n.polygons = this.polygons.map(p => p.clone());
    return n;
  }

  invert() {
    for (let i = 0; i < this.polygons.length; i++) this.polygons[i].flip();
    if (this.plane) this.plane.flip();
    if (this.front) this.front.invert();
    if (this.back) this.back.invert();
    const tmp = this.front;
    this.front = this.back;
    this.back = tmp;
  }

  clipPolygons(polygons) {
    if (!this.plane) return polygons.slice();
    let front = [], back = [];
    for (let i = 0; i < polygons.length; i++) {
      this.plane.splitPolygon(polygons[i], front, back, front, back);
    }
    if (this.front) front = this.front.clipPolygons(front);
    if (this.back) back = this.back.clipPolygons(back);
    else back = [];
    return front.concat(back);
  }

  clipTo(bsp) {
    this.polygons = bsp.clipPolygons(this.polygons);
    if (this.front) this.front.clipTo(bsp);
    if (this.back) this.back.clipTo(bsp);
  }

  allPolygons() {
    let out = this.polygons.slice();
    if (this.front) out = out.concat(this.front.allPolygons());
    if (this.back) out = out.concat(this.back.allPolygons());
    return out;
  }

  build(polygons) {
    if (!polygons.length) return;
    if (!this.plane) this.plane = polygons[0].plane.clone();
    const front = [], back = [];
    for (let i = 0; i < polygons.length; i++) {
      this.plane.splitPolygon(polygons[i], this.polygons, this.polygons, front, back);
    }
    if (front.length) {
      if (!this.front) this.front = new Node();
      this.front.build(front);
    }
    if (back.length) {
      if (!this.back) this.back = new Node();
      this.back.build(back);
    }
  }
}

export function sharedIndex(shared) {
  if (typeof shared === 'number') return shared;
  if (shared && typeof shared.materialIndex === 'number') return shared.materialIndex;
  return 0;
}
