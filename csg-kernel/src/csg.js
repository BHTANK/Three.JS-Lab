/**
 * CSG solid + three.js BufferGeometry bridge.
 */
import * as THREE from 'three';
import {
  EPS, setEpsilon, getEpsilon,
  V3, Vertex, Plane, Polygon, Node, sharedIndex
} from './bsp.js';

export { setEpsilon, getEpsilon, EPS };

export const ADDITION = 'addition';
export const SUBTRACTION = 'subtraction';
export const REVERSE_SUBTRACTION = 'reverse_subtraction';
export const INTERSECTION = 'intersection';
export const DIFFERENCE = 'difference';

export const OPS = Object.freeze({
  ADDITION, SUBTRACTION, REVERSE_SUBTRACTION, INTERSECTION, DIFFERENCE
});

export class CSG {
  constructor() {
    this.polygons = [];
  }

  static fromPolygons(polygons) {
    const c = new CSG();
    c.polygons = polygons;
    return c;
  }

  clone() {
    const c = new CSG();
    c.polygons = this.polygons.map(p => p.clone());
    return c;
  }

  toPolygons() { return this.polygons; }

  polygonCount() { return this.polygons.length; }

  triangleCount() {
    let n = 0;
    for (let i = 0; i < this.polygons.length; i++) {
      n += Math.max(0, this.polygons[i].vertices.length - 2);
    }
    return n;
  }

  /** A ∪ B */
  union(csg) {
    const a = new Node(this.clone().polygons);
    const b = new Node(csg.clone().polygons);
    a.clipTo(b);
    b.clipTo(a);
    b.invert();
    b.clipTo(a);
    b.invert();
    a.build(b.allPolygons());
    return CSG.fromPolygons(a.allPolygons());
  }

  /** A \ B */
  subtract(csg) {
    const a = new Node(this.clone().polygons);
    const b = new Node(csg.clone().polygons);
    a.invert();
    a.clipTo(b);
    b.clipTo(a);
    b.invert();
    b.clipTo(a);
    b.invert();
    a.build(b.allPolygons());
    a.invert();
    return CSG.fromPolygons(a.allPolygons());
  }

  /** B \ A */
  reverseSubtract(csg) {
    return csg.subtract(this);
  }

  /** A ∩ B */
  intersect(csg) {
    const a = new Node(this.clone().polygons);
    const b = new Node(csg.clone().polygons);
    a.invert();
    b.clipTo(a);
    b.invert();
    a.clipTo(b);
    b.clipTo(a);
    a.build(b.allPolygons());
    a.invert();
    return CSG.fromPolygons(a.allPolygons());
  }

  /** A ⊕ B = (A\B) ∪ (B\A) */
  difference(csg) {
    return this.subtract(csg).union(csg.subtract(this));
  }

  inverse() {
    const c = this.clone();
    for (let i = 0; i < c.polygons.length; i++) c.polygons[i].flip();
    return c;
  }

  // ── three.js bridges ────────────────────────────────────────────────────

  /**
   * Build CSG from BufferGeometry.
   * @param {THREE.BufferGeometry} geometry
   * @param {THREE.Matrix4|null} matrix  world transform
   * @param {object} [opts]
   * @param {boolean} [opts.useGroups=true] honour geometry.groups → shared mat index
   * @param {number} [opts.materialIndex=0] default shared index when no groups
   */
  static fromGeometry(geometry, matrix = null, opts = {}) {
    const useGroups = opts.useGroups !== false;
    const defaultMat = opts.materialIndex || 0;

    let geom = geometry;
    let disposeTmp = false;
    if (geometry.index) {
      geom = geometry.toNonIndexed();
      disposeTmp = true;
    }

    const pos = geom.attributes.position;
    if (!pos) throw new Error('CSG.fromGeometry: no position attribute');
    if (!geom.attributes.normal) geom.computeVertexNormals();
    const normals = geom.attributes.normal;
    const uv = geom.attributes.uv;

    const m = matrix ? matrix.clone() : null;
    const normalMatrix = m ? new THREE.Matrix3().getNormalMatrix(m) : null;
    const tmpV = new THREE.Vector3();
    const tmpN = new THREE.Vector3();

    // Build per-triangle material index from groups
    const triCount = pos.count / 3;
    const matOfTri = new Int32Array(triCount);
    matOfTri.fill(defaultMat);
    if (useGroups && geom.groups && geom.groups.length) {
      for (const g of geom.groups) {
        const startTri = Math.floor(g.start / 3);
        const endTri = Math.floor((g.start + g.count) / 3);
        const mi = g.materialIndex ?? 0;
        for (let t = startTri; t < endTri && t < triCount; t++) matOfTri[t] = mi;
      }
    }

    const polygons = [];
    for (let t = 0; t < triCount; t++) {
      const verts = [];
      for (let k = 0; k < 3; k++) {
        const i = t * 3 + k;
        tmpV.fromBufferAttribute(pos, i);
        if (m) tmpV.applyMatrix4(m);
        tmpN.fromBufferAttribute(normals, i);
        if (normalMatrix) tmpN.applyMatrix3(normalMatrix).normalize();
        const uvCoord = uv ? { u: uv.getX(i), v: uv.getY(i) } : null;
        verts.push(new Vertex(
          new V3(tmpV.x, tmpV.y, tmpV.z),
          new V3(tmpN.x, tmpN.y, tmpN.z),
          uvCoord
        ));
      }
      const e1 = verts[1].pos.minus(verts[0].pos);
      const e2 = verts[2].pos.minus(verts[0].pos);
      if (e1.cross(e2).length() < 1e-12) continue;
      polygons.push(new Polygon(verts, matOfTri[t]));
    }

    if (disposeTmp && geom !== geometry) geom.dispose?.();
    return CSG.fromPolygons(polygons);
  }

  static fromMesh(mesh, opts = {}) {
    mesh.updateWorldMatrix(true, false);
    return CSG.fromGeometry(mesh.geometry, mesh.matrixWorld, opts);
  }

  /**
   * Emit BufferGeometry with optional multi-material groups.
   * @param {object} [opts]
   * @param {boolean} [opts.useGroups=true]
   */
  toGeometry(opts = {}) {
    const useGroups = opts.useGroups !== false;
    const polys = this.polygons;

    // Bucket by material index so groups are contiguous
    const buckets = new Map();
    for (let i = 0; i < polys.length; i++) {
      const mi = sharedIndex(polys[i].shared);
      if (!buckets.has(mi)) buckets.set(mi, []);
      buckets.get(mi).push(polys[i]);
    }

    let triCount = 0;
    for (const list of buckets.values()) {
      for (let i = 0; i < list.length; i++) {
        triCount += Math.max(0, list[i].vertices.length - 2);
      }
    }

    const positions = new Float32Array(triCount * 9);
    const normals = new Float32Array(triCount * 9);
    const uvs = new Float32Array(triCount * 6);
    let p = 0, n = 0, u = 0;
    const groups = [];

    const sortedMats = [...buckets.keys()].sort((a, b) => a - b);
    for (const mi of sortedMats) {
      const list = buckets.get(mi);
      const startVertex = p / 3;
      for (let i = 0; i < list.length; i++) {
        const vs = list[i].vertices;
        for (let j = 1; j < vs.length - 1; j++) {
          const tri = [vs[0], vs[j], vs[j + 1]];
          for (let k = 0; k < 3; k++) {
            const v = tri[k];
            positions[p++] = v.pos.x;
            positions[p++] = v.pos.y;
            positions[p++] = v.pos.z;
            normals[n++] = v.normal.x;
            normals[n++] = v.normal.y;
            normals[n++] = v.normal.z;
            if (v.uv) { uvs[u++] = v.uv.u; uvs[u++] = v.uv.v; }
            else { uvs[u++] = 0; uvs[u++] = 0; }
          }
        }
      }
      const count = p / 3 - startVertex;
      if (useGroups && count > 0) {
        groups.push({ start: startVertex, count, materialIndex: mi });
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    if (useGroups) {
      for (const g of groups) geo.addGroup(g.start, g.count, g.materialIndex);
    }
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
    return geo;
  }

  toMesh(material = null, opts = {}) {
    const geo = this.toGeometry(opts);
    let mat = material;
    if (!mat) {
      mat = new THREE.MeshStandardMaterial({
        color: 0x88aaff,
        metalness: 0.15,
        roughness: 0.45,
        side: THREE.DoubleSide
      });
    }
    // Multi-material array if groups need more slots
    if (Array.isArray(mat) === false && geo.groups.length > 1) {
      // single material is fine; all groups share it unless array provided
    }
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  // ── high-level helpers ──────────────────────────────────────────────────

  static _toCSG(input, matrix = null, opts = {}) {
    if (input instanceof CSG) return input;
    if (input && input.isBrush) return CSG.fromMesh(input, opts);
    if (input && input.isMesh) return CSG.fromMesh(input, opts);
    if (input && input.isBufferGeometry) return CSG.fromGeometry(input, matrix, opts);
    throw new Error('CSG: expected Mesh, Brush, BufferGeometry, or CSG solid');
  }

  static _run(op, a, b, opts = {}) {
    const A = CSG._toCSG(a, opts.matrixA, opts);
    const B = CSG._toCSG(b, opts.matrixB, opts);
    let result;
    switch (op) {
      case ADDITION: result = A.union(B); break;
      case SUBTRACTION: result = A.subtract(B); break;
      case REVERSE_SUBTRACTION: result = A.reverseSubtract(B); break;
      case INTERSECTION: result = A.intersect(B); break;
      case DIFFERENCE: result = A.difference(B); break;
      default: throw new Error('CSG: unknown op ' + op);
    }
    if (opts.asCSG) return result;
    if (opts.asGeometry) return result.toGeometry(opts);
    return result.toMesh(opts.material, opts);
  }

  static union(a, b, opts = {}) { return CSG._run(ADDITION, a, b, opts); }
  static subtract(a, b, opts = {}) { return CSG._run(SUBTRACTION, a, b, opts); }
  static reverseSubtract(a, b, opts = {}) { return CSG._run(REVERSE_SUBTRACTION, a, b, opts); }
  static intersect(a, b, opts = {}) { return CSG._run(INTERSECTION, a, b, opts); }
  static difference(a, b, opts = {}) { return CSG._run(DIFFERENCE, a, b, opts); }

  /** Fold many solids: union(a, b, c, …) */
  static unionAll(items, opts = {}) {
    if (!items.length) throw new Error('CSG.unionAll: empty');
    let acc = CSG._toCSG(items[0], null, opts);
    for (let i = 1; i < items.length; i++) {
      acc = acc.union(CSG._toCSG(items[i], null, opts));
    }
    if (opts.asCSG) return acc;
    if (opts.asGeometry) return acc.toGeometry(opts);
    return acc.toMesh(opts.material, opts);
  }

  /** Fold: base − c0 − c1 − … (for multi-window walls etc.) */
  static subtractAll(base, cutters, opts = {}) {
    let acc = CSG._toCSG(base, null, opts);
    for (let i = 0; i < cutters.length; i++) {
      acc = acc.subtract(CSG._toCSG(cutters[i], null, opts));
    }
    if (opts.asCSG) return acc;
    if (opts.asGeometry) return acc.toGeometry(opts);
    return acc.toMesh(opts.material, opts);
  }

  // ── native primitives ───────────────────────────────────────────────────

  static cube({ center = [0, 0, 0], radius = [1, 1, 1], materialIndex = 0 } = {}) {
    const c = new V3(center[0], center[1], center[2]);
    const r = Array.isArray(radius) ? radius : [radius, radius, radius];
    const faces = [
      [[0, 4, 6, 2], [-1, 0, 0]],
      [[1, 3, 7, 5], [+1, 0, 0]],
      [[0, 1, 5, 4], [0, -1, 0]],
      [[2, 6, 7, 3], [0, +1, 0]],
      [[0, 2, 3, 1], [0, 0, -1]],
      [[4, 5, 7, 6], [0, 0, +1]]
    ];
    return CSG.fromPolygons(faces.map(info => new Polygon(info[0].map(i => {
      const pos = new V3(
        c.x + r[0] * (2 * !!(i & 1) - 1),
        c.y + r[1] * (2 * !!(i & 2) - 1),
        c.z + r[2] * (2 * !!(i & 4) - 1)
      );
      return new Vertex(pos, new V3(info[1][0], info[1][1], info[1][2]));
    }), materialIndex)));
  }

  static sphere({ center = [0, 0, 0], radius = 1, slices = 16, stacks = 8, materialIndex = 0 } = {}) {
    const c = new V3(center[0], center[1], center[2]);
    const polygons = [];
    function vertex(theta, phi, out) {
      theta *= Math.PI * 2;
      phi *= Math.PI;
      const dir = new V3(
        Math.cos(theta) * Math.sin(phi),
        Math.cos(phi),
        Math.sin(theta) * Math.sin(phi)
      );
      out.push(new Vertex(c.plus(dir.times(radius)), dir));
    }
    for (let i = 0; i < slices; i++) {
      for (let j = 0; j < stacks; j++) {
        const verts = [];
        vertex(i / slices, j / stacks, verts);
        if (j > 0) vertex((i + 1) / slices, j / stacks, verts);
        if (j < stacks - 1) vertex((i + 1) / slices, (j + 1) / stacks, verts);
        vertex(i / slices, (j + 1) / stacks, verts);
        polygons.push(new Polygon(verts, materialIndex));
      }
    }
    return CSG.fromPolygons(polygons);
  }

  static cylinder({
    start = [0, -1, 0], end = [0, 1, 0], radius = 1, slices = 16, materialIndex = 0
  } = {}) {
    const s = new V3(start[0], start[1], start[2]);
    const e = new V3(end[0], end[1], end[2]);
    const ray = e.minus(s);
    const axisZ = ray.unit();
    const isY = Math.abs(axisZ.y) > 0.5;
    const axisX = new V3(isY ? 1 : 0, isY ? 0 : 1, 0).cross(axisZ).unit();
    const axisY = axisX.cross(axisZ).unit();
    const startV = new Vertex(s, axisZ.negated());
    const endV = new Vertex(e, axisZ.clone());
    const polygons = [];
    function point(stack, slice, normalBlend) {
      const angle = slice * Math.PI * 2;
      const out = axisX.times(Math.cos(angle)).plus(axisY.times(Math.sin(angle)));
      const pos = s.plus(ray.times(stack)).plus(out.times(radius));
      const normal = out.times(1 - Math.abs(normalBlend)).plus(axisZ.times(normalBlend));
      return new Vertex(pos, normal.unit());
    }
    for (let i = 0; i < slices; i++) {
      const t0 = i / slices, t1 = (i + 1) / slices;
      polygons.push(new Polygon([startV, point(0, t0, -1), point(0, t1, -1)], materialIndex));
      polygons.push(new Polygon([point(0, t1, 0), point(0, t0, 0), point(1, t0, 0), point(1, t1, 0)], materialIndex));
      polygons.push(new Polygon([endV, point(1, t1, 1), point(1, t0, 1)], materialIndex));
    }
    return CSG.fromPolygons(polygons);
  }

  /**
   * Axis-aligned box from min/max corners (handy for door/window cutters).
   * Oversize slightly on the wall-normal axis so cut faces don't z-fight.
   */
  static boxFromBounds(min, max, materialIndex = 0) {
    const cx = (min[0] + max[0]) * 0.5;
    const cy = (min[1] + max[1]) * 0.5;
    const cz = (min[2] + max[2]) * 0.5;
    const rx = Math.abs(max[0] - min[0]) * 0.5;
    const ry = Math.abs(max[1] - min[1]) * 0.5;
    const rz = Math.abs(max[2] - min[2]) * 0.5;
    return CSG.cube({ center: [cx, cy, cz], radius: [rx, ry, rz], materialIndex });
  }
}

// ─── Brush (Mesh-compatible operand, three-bvh-csg shape) ───────────────────
