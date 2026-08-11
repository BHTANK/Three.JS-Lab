/**
 * Brush + Evaluator (three-bvh-csg-shaped API).
 */
import * as THREE from 'three';
import {
  CSG, ADDITION, SUBTRACTION, REVERSE_SUBTRACTION, INTERSECTION, DIFFERENCE
} from './csg.js';

export class Brush extends THREE.Mesh {
  constructor(geometry = new THREE.BufferGeometry(), material) {
    super(
      geometry,
      material || new THREE.MeshStandardMaterial({ color: 0xcccccc, side: THREE.DoubleSide })
    );
    this.isBrush = true;
    this.type = 'Brush';
  }

  /** Refresh matrixWorld before evaluate (required). */
  prepare() {
    this.updateMatrixWorld(true);
    return this;
  }

  toCSG(opts = {}) {
    this.prepare();
    return CSG.fromMesh(this, opts);
  }
}

// ─── Evaluator ──────────────────────────────────────────────────────────────
export class Evaluator {
  constructor() {
    /** Honour geometry groups / multi-material (default true). */
    this.useGroups = true;
  }

  /**
   * @param {Brush|THREE.Mesh|CSG} a
   * @param {Brush|THREE.Mesh|CSG} b
   * @param {string} operation  ADDITION | SUBTRACTION | …
   * @param {Brush|THREE.Mesh|null} target  optional reuse
   * @returns {Brush}
   */
  evaluate(a, b, operation, target = null) {
    const opts = { useGroups: this.useGroups, asCSG: true };
    const result = CSG._run(operation, a, b, opts);
    const geo = result.toGeometry({ useGroups: this.useGroups });

    if (target) {
      if (target.geometry && target.geometry !== geo) target.geometry.dispose?.();
      target.geometry = geo;
      return target;
    }

    // Prefer material from A when it's a mesh
    let mat = null;
    if (a && a.material) mat = a.material;
    return new Brush(geo, mat);
  }

  /**
   * Evaluate a chain: start with brushes[0], then fold ops[i] with brushes[i+1].
   * ops.length === brushes.length - 1
   */
  evaluateChain(brushes, operations) {
    if (!brushes.length) throw new Error('Evaluator.evaluateChain: no brushes');
    if (operations.length !== brushes.length - 1) {
      throw new Error('Evaluator.evaluateChain: ops length must be brushes.length - 1');
    }
    let acc = brushes[0];
    for (let i = 0; i < operations.length; i++) {
      acc = this.evaluate(acc, brushes[i + 1], operations[i]);
    }
    return acc;
  }
}
