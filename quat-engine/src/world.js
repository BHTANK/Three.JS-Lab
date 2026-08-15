/**
 * Open-world streaming hooks (GTA-class).
 * Chunks are abstract: city tiles, voxel chunks, or race sectors.
 */

export class WorldStreamer {
  constructor(chunkSize = 64) {
    this.chunkSize = chunkSize;
    this.loaded = new Map();
    this.buildChunk = null; // (cx, cz) => { object3d, dispose? }
    this.group = null;
    this.radius = 2;
  }

  cell(v) {
    return Math.floor(v / this.chunkSize);
  }

  tick(px, pz) {
    if (!this.buildChunk || !this.group) return;
    const ccx = this.cell(px);
    const ccz = this.cell(pz);
    const keep = new Set();
    for (let dx = -this.radius; dx <= this.radius; dx++) {
      for (let dz = -this.radius; dz <= this.radius; dz++) {
        const k = (ccx + dx) + ',' + (ccz + dz);
        keep.add(k);
        if (this.loaded.has(k)) continue;
        const built = this.buildChunk(ccx + dx, ccz + dz);
        if (built && built.object3d) {
          this.group.add(built.object3d);
          this.loaded.set(k, built);
        }
      }
    }
    for (const [k, built] of this.loaded) {
      if (keep.has(k)) continue;
      if (built.object3d.parent) built.object3d.parent.remove(built.object3d);
      if (typeof built.dispose === 'function') built.dispose();
      this.loaded.delete(k);
    }
  }
}
