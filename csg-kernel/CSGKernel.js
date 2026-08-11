/**
 * CSGKernel — proper BSP Constructive Solid Geometry for three.js
 * Modular entry. Single-file: CSGKernel.mono.js
 * MIT — algorithm © Evan Wallace; bridge © BHTANK / Three.JS-Lab
 */
export {
  ADDITION, SUBTRACTION, REVERSE_SUBTRACTION, INTERSECTION, DIFFERENCE, OPS,
  setEpsilon, getEpsilon, CSG
} from './src/csg.js';
export { Brush, Evaluator } from './src/brush.js';
export { wallWithOpenings, doorFrame, wallWithDoor } from './src/prefabs.js';
export { CSG as default } from './src/csg.js';
