import type {
  BufferGeometry,
  Material,
  Matrix4,
  Mesh,
  Group
} from 'three';

/** CSG operation constants (three-bvh-csg compatible names). */
export const ADDITION: 'addition';
export const SUBTRACTION: 'subtraction';
export const REVERSE_SUBTRACTION: 'reverse_subtraction';
export const INTERSECTION: 'intersection';
export const DIFFERENCE: 'difference';

export const OPS: Readonly<{
  ADDITION: typeof ADDITION;
  SUBTRACTION: typeof SUBTRACTION;
  REVERSE_SUBTRACTION: typeof REVERSE_SUBTRACTION;
  INTERSECTION: typeof INTERSECTION;
  DIFFERENCE: typeof DIFFERENCE;
}>;

export type CSGOperation =
  | typeof ADDITION
  | typeof SUBTRACTION
  | typeof REVERSE_SUBTRACTION
  | typeof INTERSECTION
  | typeof DIFFERENCE;

export function setEpsilon(v: number): void;
export function getEpsilon(): number;

export interface CSGOptions {
  asGeometry?: boolean;
  asCSG?: boolean;
  material?: Material | Material[];
  matrixA?: Matrix4 | null;
  matrixB?: Matrix4 | null;
  useGroups?: boolean;
  materialIndex?: number;
}

export interface GeometryOpts {
  useGroups?: boolean;
  materialIndex?: number;
}

export type CSGInput = CSG | Mesh | Brush | BufferGeometry;

export class CSG {
  polygons: unknown[];

  static fromPolygons(polygons: unknown[]): CSG;
  clone(): CSG;
  toPolygons(): unknown[];
  polygonCount(): number;
  triangleCount(): number;

  union(csg: CSG): CSG;
  subtract(csg: CSG): CSG;
  reverseSubtract(csg: CSG): CSG;
  intersect(csg: CSG): CSG;
  difference(csg: CSG): CSG;
  inverse(): CSG;

  static fromGeometry(geometry: BufferGeometry, matrix?: Matrix4 | null, opts?: GeometryOpts): CSG;
  static fromMesh(mesh: Mesh, opts?: GeometryOpts): CSG;

  toGeometry(opts?: GeometryOpts): BufferGeometry;
  toMesh(material?: Material | Material[] | null, opts?: GeometryOpts): Mesh;

  static union(a: CSGInput, b: CSGInput, opts?: CSGOptions): Mesh | BufferGeometry | CSG;
  static subtract(a: CSGInput, b: CSGInput, opts?: CSGOptions): Mesh | BufferGeometry | CSG;
  static reverseSubtract(a: CSGInput, b: CSGInput, opts?: CSGOptions): Mesh | BufferGeometry | CSG;
  static intersect(a: CSGInput, b: CSGInput, opts?: CSGOptions): Mesh | BufferGeometry | CSG;
  static difference(a: CSGInput, b: CSGInput, opts?: CSGOptions): Mesh | BufferGeometry | CSG;

  static unionAll(items: CSGInput[], opts?: CSGOptions): Mesh | BufferGeometry | CSG;
  static subtractAll(base: CSGInput, cutters: CSGInput[], opts?: CSGOptions): Mesh | BufferGeometry | CSG;

  static cube(opts?: {
    center?: [number, number, number];
    radius?: number | [number, number, number];
    materialIndex?: number;
  }): CSG;

  static sphere(opts?: {
    center?: [number, number, number];
    radius?: number;
    slices?: number;
    stacks?: number;
    materialIndex?: number;
  }): CSG;

  static cylinder(opts?: {
    start?: [number, number, number];
    end?: [number, number, number];
    radius?: number;
    slices?: number;
    materialIndex?: number;
  }): CSG;

  static boxFromBounds(
    min: [number, number, number],
    max: [number, number, number],
    materialIndex?: number
  ): CSG;
}

/** Mesh-compatible CSG operand (mirrors three-bvh-csg Brush shape). */
export class Brush extends Mesh {
  readonly isBrush: true;
  constructor(geometry?: BufferGeometry, material?: Material | Material[]);
  prepare(): this;
  toCSG(opts?: GeometryOpts): CSG;
}

export class Evaluator {
  useGroups: boolean;
  evaluate(
    a: CSGInput,
    b: CSGInput,
    operation: CSGOperation,
    target?: Brush | Mesh | null
  ): Brush;
  evaluateChain(brushes: CSGInput[], operations: CSGOperation[]): Brush;
}

export interface OpeningSpec {
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  z?: number;
  materialIndex?: number;
}

export function wallWithOpenings(options?: {
  width?: number;
  height?: number;
  thickness?: number;
  openings?: OpeningSpec[];
  wallMaterial?: Material | null;
  cutterOvershoot?: number;
  materialIndex?: number;
}): { mesh: Mesh; csg: CSG; openings: OpeningSpec[] };

export function doorFrame(options?: {
  openingW?: number;
  openingH?: number;
  depth?: number;
  frameThickness?: number;
  sill?: number;
  material?: Material | null;
  materialIndex?: number;
}): { mesh: Mesh; csg: CSG };

export function wallWithDoor(options?: {
  width?: number;
  height?: number;
  thickness?: number;
  doorW?: number;
  doorH?: number;
  doorX?: number;
  doorY?: number | null;
  frameThickness?: number;
  merge?: boolean;
  wallMaterial?: Material | null;
  frameMaterial?: Material | null;
}): {
  group?: Group;
  mesh?: Mesh;
  csg?: CSG;
  wall: ReturnType<typeof wallWithOpenings>;
  frame: ReturnType<typeof doorFrame>;
};

export default CSG;
