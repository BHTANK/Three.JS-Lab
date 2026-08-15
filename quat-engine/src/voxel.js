/**
 * Minecraft-style chunk meshing. Blocks are a dense Uint8 grid.
 * Faces query the world so chunk borders occlude correctly.
 */

import * as THREE from 'three';

export const AIR = 0;
export const GRASS = 1;
export const DIRT = 2;
export const STONE = 3;
export const WOOD = 4;

const COLORS = {
  [GRASS]: 0x4a8f3a,
  [DIRT]: 0x6b4423,
  [STONE]: 0x7a7a7a,
  [WOOD]: 0x8b5a2b,
};

export class Chunk {
  constructor(cx, cz, size = 16, height = 24) {
    this.cx = cx;
    this.cz = cz;
    this.size = size;
    this.height = height;
    this.data = new Uint8Array(size * height * size);
    this.mesh = null;
    this.dirty = true;
  }

  idx(x, y, z) {
    return y * this.size * this.size + z * this.size + x;
  }

  get(x, y, z) {
    if (x < 0 || z < 0 || y < 0 || x >= this.size || z >= this.size || y >= this.height) return AIR;
    return this.data[this.idx(x, y, z)];
  }

  set(x, y, z, id) {
    if (x < 0 || z < 0 || y < 0 || x >= this.size || z >= this.size || y >= this.height) return;
    this.data[this.idx(x, y, z)] = id;
    this.dirty = true;
  }

  fillHills(seed = 1) {
    const s = this.size;
    for (let x = 0; x < s; x++) {
      for (let z = 0; z < s; z++) {
        const wx = this.cx * s + x;
        const wz = this.cz * s + z;
        const h = 6 + Math.floor(3 * Math.sin(wx * 0.21 + seed) + 2 * Math.cos(wz * 0.17));
        for (let y = 0; y <= h && y < this.height; y++) {
          let id = STONE;
          if (y === h) id = GRASS;
          else if (y > h - 3) id = DIRT;
          this.set(x, y, z, id);
        }
      }
    }
    this.dirty = true;
  }

  surfaceY(lx, lz) {
    for (let y = this.height - 1; y >= 0; y--) {
      if (this.get(lx, y, lz) !== AIR) return y + 1;
    }
    return 0;
  }

  buildMesh(worldGet) {
    const pos = [];
    const nrm = [];
    const col = [];
    const faces = [
      { d: [1, 0, 0], n: [1, 0, 0], u: [0, 1, 0], v: [0, 0, 1] },
      { d: [-1, 0, 0], n: [-1, 0, 0], u: [0, 1, 0], v: [0, 0, -1] },
      { d: [0, 1, 0], n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, 1] },
      { d: [0, -1, 0], n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, -1] },
      { d: [0, 0, 1], n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] },
      { d: [0, 0, -1], n: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0] },
    ];
    const s = this.size;
    const getter = worldGet || ((wx, wy, wz) => {
      const lx = wx - this.cx * s;
      const lz = wz - this.cz * s;
      return this.get(lx, wy, lz);
    });
    for (let x = 0; x < s; x++) {
      for (let y = 0; y < this.height; y++) {
        for (let z = 0; z < s; z++) {
          const id = this.get(x, y, z);
          if (id === AIR) continue;
          const hex = COLORS[id] || 0xffffff;
          const r = ((hex >> 16) & 255) / 255;
          const g = ((hex >> 8) & 255) / 255;
          const b = (hex & 255) / 255;
          const wx = this.cx * s + x;
          const wz = this.cz * s + z;
          for (const f of faces) {
            if (getter(wx + f.d[0], y + f.d[1], wz + f.d[2]) !== AIR) continue;
            const px = x + 0.5 + f.n[0] * 0.5;
            const py = y + 0.5 + f.n[1] * 0.5;
            const pz = z + 0.5 + f.n[2] * 0.5;
            const corners = [
              [-0.5, -0.5], [0.5, -0.5], [0.5, 0.5],
              [-0.5, -0.5], [0.5, 0.5], [-0.5, 0.5],
            ];
            for (const [uu, vv] of corners) {
              pos.push(
                px + f.u[0] * uu + f.v[0] * vv,
                py + f.u[1] * uu + f.v[1] * vv,
                pz + f.u[2] * uu + f.v[2] * vv,
              );
              nrm.push(f.n[0], f.n[1], f.n[2]);
              col.push(r, g, b);
            }
          }
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    if (this.mesh) {
      this.mesh.geometry.dispose();
      this.mesh.geometry = geo;
    } else {
      this.mesh = new THREE.Mesh(geo, mat);
    }
    this.mesh.position.set(this.cx * s, 0, this.cz * s);
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = true;
    this.dirty = false;
    return this.mesh;
  }
}

export class VoxelWorld {
  constructor(radius = 2) {
    this.chunks = new Map();
    this.radius = radius;
    this.group = new THREE.Group();
    this.group.name = 'voxel-world';
    this.chunkSize = 16;
  }
  key(cx, cz) { return cx + ',' + cz; }
  getBlock(wx, wy, wz) {
    const cs = this.chunkSize;
    const cx = Math.floor(wx / cs);
    const cz = Math.floor(wz / cs);
    const ch = this.chunks.get(this.key(cx, cz));
    if (!ch) return AIR;
    const lx = ((wx % cs) + cs) % cs;
    const lz = ((wz % cs) + cs) % cs;
    return ch.get(Math.floor(lx), Math.floor(wy), Math.floor(lz));
  }
  ensureAround(wx, wz) {
    const cs = this.chunkSize;
    const ccx = Math.floor(wx / cs);
    const ccz = Math.floor(wz / cs);
    const getter = (x, y, z) => this.getBlock(x, y, z);
    for (let dx = -this.radius; dx <= this.radius; dx++) {
      for (let dz = -this.radius; dz <= this.radius; dz++) {
        const k = this.key(ccx + dx, ccz + dz);
        if (this.chunks.has(k)) continue;
        const ch = new Chunk(ccx + dx, ccz + dz);
        ch.fillHills(1);
        this.chunks.set(k, ch);
        this.group.add(ch.buildMesh(getter));
      }
    }
  }
  heightAt(wx, wz) {
    const cs = this.chunkSize;
    const cx = Math.floor(wx / cs);
    const cz = Math.floor(wz / cs);
    const ch = this.chunks.get(this.key(cx, cz));
    if (!ch) return 8;
    const lx = ((wx % cs) + cs) % cs;
    const lz = ((wz % cs) + cs) % cs;
    return ch.surfaceY(Math.floor(lx), Math.floor(lz));
  }
  setBlock(wx, wy, wz, id) {
    const cs = this.chunkSize;
    const cx = Math.floor(wx / cs);
    const cz = Math.floor(wz / cs);
    const ch = this.chunks.get(this.key(cx, cz));
    if (!ch) return;
    const lx = ((wx % cs) + cs) % cs;
    const lz = ((wz % cs) + cs) % cs;
    ch.set(Math.floor(lx), Math.floor(wy), Math.floor(lz), id);
    const getter = (x, y, z) => this.getBlock(x, y, z);
    ch.buildMesh(getter);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = this.chunks.get(this.key(cx + dx, cz + dz));
      if (n) n.buildMesh(getter);
    }
  }
}
