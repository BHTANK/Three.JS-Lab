export type Quat = [number, number, number, number];
export type Vec3 = [number, number, number];

export declare const Quat: {
  EPS: number;
  create(w?: number, x?: number, y?: number, z?: number): Quat;
  identity(): Quat;
  copy(q: Quat): Quat;
  set(out: Quat, w: number, x: number, y: number, z: number): Quat;
  mul(a: Quat, b: Quat, out?: Quat): Quat;
  compose(first: Quat, second: Quat, out?: Quat): Quat;
  conjugate(q: Quat, out?: Quat): Quat;
  dot(a: Quat, b: Quat): number;
  length(q: Quat): number;
  normalize(q: Quat, out?: Quat): Quat;
  inverse(q: Quat, out?: Quat): Quat;
  rotateVec(q: Quat, v: Vec3, out?: Vec3): Vec3;
  expPure(v: Vec3, out?: Quat): Quat;
  logPure(q: Quat, out?: Vec3): Vec3;
  Exp(phi: Vec3, out?: Quat): Quat;
  Log(q: Quat, out?: Vec3): Vec3;
  fromAxisAngle(axis: Vec3, angle: number, out?: Quat): Quat;
  fromYawPitch(yaw: number, pitch: number, out?: Quat): Quat;
  fromTo(from: Vec3, to: Vec3, out?: Quat): Quat;
  lookRotation(dir: Vec3, up?: Vec3, out?: Quat): Quat;
  slerp(a: Quat, b: Quat, t: number, out?: Quat): Quat;
  nlerp(a: Quat, b: Quat, t: number, out?: Quat): Quat;
  toMat3(q: Quat, out?: Float32Array | number[]): Float32Array | number[];
  toThree(q: Quat, threeQuat: { set(x: number, y: number, z: number, w: number): unknown }): unknown;
  fromThree(threeQuat: { w: number; x: number; y: number; z: number }, out?: Quat): Quat;
  eq(a: Quat, b: Quat, eps?: number): boolean;
  fmt(q: Quat, digits?: number): string;
};

export interface RigidBody {
  pos: Vec3;
  vel: Vec3;
  acc: Vec3;
  q: Quat;
  omega: Vec3;
  mass: number;
  invMass: number;
  radius: number;
  onGround: boolean;
  bounce: number;
  friction: number;
  sleeping: boolean;
  sleepTimer: number;
  isStatic: boolean;
}

export function stepBodyRate(q: Quat, omegaLocal: Vec3, dt: number, out?: Quat): Quat;
export function stepWorldRate(q: Quat, omegaWorld: Vec3, dt: number, out?: Quat): Quat;
export function stepRigid(body: RigidBody, dt: number, gravity?: Vec3): RigidBody;
export function accumulate(state: { acc?: number }, dt: number, stepFn: (h: number) => void, h?: number, maxSteps?: number): number;
export function makeBody(pos?: Vec3): RigidBody;

export class Input {
  constructor(target?: EventTarget);
  lookX: number;
  lookY: number;
  locked: boolean;
  fire: boolean;
  down(code: string): boolean;
  axis(): [number, number];
  consumeLook(sensitivity?: number): [number, number];
  pollGamepad(): void;
  dispose(): void;
}

export class QuatCamera {
  constructor(threeCamera: unknown);
  q: Quat;
  pos: Vec3;
  mode: string;
  chase(targetPos: Vec3, targetQ: Quat, yaw: number, pitch: number): void;
  firstPerson(targetPos: Vec3, yaw: number, pitch: number, eye?: number): void;
  orbit(targetPos: Vec3, yaw: number, pitch: number, radius?: number): void;
  fly(pos: Vec3, yaw: number, pitch: number): void;
}
export function yawFromQuat(q: Quat): number;

export class SpatialHash {
  constructor(cellSize?: number);
  insert(entity: { pos: Vec3; radius?: number }): void;
  query(pos: Vec3, radius: number, out?: unknown[]): unknown[];
  clear(): void;
}
export function collideGround(body: RigidBody, getHeight: (x: number, z: number) => number, dt: number): void;
export function sphereContact(a: RigidBody, b: RigidBody, n: Vec3): number;
export function resolveSpheres(a: RigidBody, b: RigidBody, opt?: { slop?: number; baums?: number }): number;
export class PhysicsWorld {
  bodies: RigidBody[];
  add(body: RigidBody): RigidBody;
  step(dt: number): void;
}

export class Character {
  constructor(pos?: Vec3);
  body: RigidBody;
  mode: string;
  health: number;
  tick(input: Input, dt: number, getHeight: (x: number, z: number) => number, yaw: number): void;
}
export class Vehicle {
  constructor(pos?: Vec3);
  body: RigidBody;
  speed: number;
  tick(input: Input, dt: number, getHeight: (x: number, z: number) => number): void;
}

export class VoxelWorld {
  group: unknown;
  ensureAround(x: number, z: number): void;
  heightAt(x: number, z: number): number;
  getBlock(x: number, y: number, z: number): number;
  setBlock(x: number, y: number, z: number, id: number): void;
}
export class WorldStreamer {
  constructor(chunkSize?: number);
  tick(px: number, pz: number): void;
}

export class Combat {
  projectiles: Projectile[];
  tryFire(origin: Vec3, q: Quat, eye?: number): Projectile | { kind: string; origin: Vec3; dir: Vec3 } | null;
  tick(dt: number, targets: Array<{ pos: Vec3; radius?: number; health: number; dead?: boolean }>): void;
}
export class Projectile {
  pos: Vec3;
  q: Quat;
  alive: boolean;
  tick(dt: number): void;
}
export function makeDummy(pos: Vec3, health?: number): { pos: Vec3; health: number; dead: boolean; radius: number };
export function rayFromQuat(origin: Vec3, q: Quat, out?: { origin: Vec3; dir: Vec3 }): { origin: Vec3; dir: Vec3 };
export function rayVsSphere(origin: Vec3, dir: Vec3, center: Vec3, radius: number): { t: number; point: Vec3 } | null;
export class EventBus {
  on(event: string, cb: (data: unknown) => void): () => void;
  emit(event: string, data?: unknown): void;
}

export class QuatEngine {
  constructor(canvas: HTMLCanvasElement, options?: { mode?: string; hud?: HTMLElement });
  mode: string;
  player: Character;
  car: Vehicle;
  setMode(mode: string): void;
  tick(): void;
  start(): void;
  stop(): void;
}
export const MODES: string[];
export const AIR: number;
export const GRASS: number;
export const DIRT: number;
export const STONE: number;
export const WOOD: number;
