/**
 * Wall / door / window prefab helpers (gap-free cutouts).
 */
import * as THREE from 'three';
import { CSG } from './csg.js';

export function wallWithOpenings(options = {}) {
  const {
    width = 4,
    height = 3,
    thickness = 0.25,
    openings = [],
    wallMaterial = null,
    cutterOvershoot = 0.05,
    materialIndex = 0
  } = options;

  let wall = CSG.cube({
    center: [0, 0, 0],
    radius: [width * 0.5, height * 0.5, thickness * 0.5],
    materialIndex
  });

  const halfT = thickness * 0.5 + cutterOvershoot;

  for (const op of openings) {
    const ox = op.x ?? 0;
    const oy = op.y ?? 0;
    const ow = op.w ?? 1;
    const oh = op.h ?? 2;
    const cutter = CSG.cube({
      center: [ox, oy, op.z ?? 0],
      radius: [ow * 0.5, oh * 0.5, halfT],
      materialIndex: op.materialIndex ?? materialIndex
    });
    wall = wall.subtract(cutter);
  }

  const mat = wallMaterial || new THREE.MeshStandardMaterial({
    color: 0xc4b7a6,
    roughness: 0.85,
    metalness: 0.05,
    side: THREE.DoubleSide
  });

  return {
    mesh: wall.toMesh(mat),
    csg: wall,
    openings
  };
}

export function doorFrame(options = {}) {
  const {
    openingW = 1.0,
    openingH = 2.1,
    depth = 0.3,
    frameThickness = 0.08,
    sill = 0.04,
    material = null,
    materialIndex = 0
  } = options;

  const outer = CSG.cube({
    center: [0, 0, 0],
    radius: [openingW * 0.5, openingH * 0.5, depth * 0.5],
    materialIndex
  });
  const innerW = Math.max(0.05, openingW - frameThickness * 2);
  const innerH = Math.max(0.05, openingH - frameThickness - sill);
  const innerY = (sill - frameThickness) * 0.5;
  const inner = CSG.cube({
    center: [0, innerY, 0],
    radius: [innerW * 0.5, innerH * 0.5, depth * 0.5 + 0.02],
    materialIndex
  });
  const frame = outer.subtract(inner);
  const mat = material || new THREE.MeshStandardMaterial({
    color: 0x5c4033,
    roughness: 0.7,
    metalness: 0.05,
    side: THREE.DoubleSide
  });
  return { mesh: frame.toMesh(mat), csg: frame };
}

export function wallWithDoor(options = {}) {
  const {
    width = 4,
    height = 3,
    thickness = 0.25,
    doorW = 1.0,
    doorH = 2.1,
    doorX = 0,
    doorY = null,
    frameThickness = 0.08,
    merge = false,
    wallMaterial = null,
    frameMaterial = null
  } = options;

  const dy = doorY != null ? doorY : (-height * 0.5 + doorH * 0.5);
  const wall = wallWithOpenings({
    width, height, thickness,
    openings: [{ x: doorX, y: dy, w: doorW, h: doorH }],
    wallMaterial
  });

  const frame = doorFrame({
    openingW: doorW,
    openingH: doorH,
    depth: thickness + 0.04,
    frameThickness,
    material: frameMaterial
  });
  frame.mesh.position.set(doorX, dy, 0);

  if (merge) {
    frame.mesh.updateWorldMatrix(true, false);
    const frameCSG = CSG.fromMesh(frame.mesh);
    const merged = wall.csg.union(frameCSG);
    return {
      mesh: merged.toMesh(wallMaterial || frameMaterial),
      csg: merged,
      wall,
      frame
    };
  }

  const group = new THREE.Group();
  group.name = 'wallWithDoor';
  group.add(wall.mesh);
  group.add(frame.mesh);
  return { group, wall, frame };
}
