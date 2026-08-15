# QuatEngine

Hamilton-quaternion game kernel for [three.js](https://threejs.org/) (mrdoob).

This is **not** GTA V, Forza, Minecraft, or Crimson shipped as one binary. Those games are different products. This kernel is the **orientation and loop layer** those genres sit on: walk, drive, fly-camera, voxel chunks, arena combat, open-world streaming, and a physics hash — all with **one** quaternion convention.

Public repo: [github.com/BHTANK/Three.JS-Lab](https://github.com/BHTANK/Three.JS-Lab)

## Convention lock

Copied from the Nuvola Quaternion Engine Room (Solà, arXiv:1711.02508):

| Axis | Lock |
|------|------|
| Algebra | Hamilton `ij = +k` |
| Storage | `q = [w, x, y, z]` |
| Frame | local → global, `v_G = q ⊗ v ⊗ q⁻¹` |
| Body rate | `q̇ = ½ q ⊗ ω_local` (rate on the **right**) |
| Three.js | convert only at the mesh/camera wall — Three stores `(x,y,z,w)` |

Do not integrate Euler angles. Do not `lookAt` in the tick. `Quat.toThree(q, mesh.quaternion)` is the only legal write into Three.

## What each genre uses

| Genre (examples) | Kernel pieces |
|------------------|----------------|
| Open-world crime (GTA lab already in this repo) | `Character` + `Vehicle` + `WorldStreamer` + existing `GTA.html` / `NPAGrok.html` |
| Racing (Forza-class *feel*) | `Vehicle` (steer / grip / quat heading) + race mode in the lab demo |
| Voxel sandbox (Minecraft-class) | `VoxelWorld` / `Chunk` mesher with cross-chunk faces |
| Arena / twin-stick (Crimson-class) | `Combat` projectiles + orbit camera + dummy targets + `SpatialHash` |
| Buildings / interiors | existing [`csg-kernel`](../csg-kernel) booleans |

Swap tire models, netcode, or a better greedy mesher later. Do not swap the quaternion carrier.

## Layout

```
quat-engine/
  QuatEngine.js          public barrel
  QuatEngine.d.ts
  src/quat.js            Hamilton algebra
  src/integrate.js       Solà body-rate + fixed-step accumulator
  src/physics.js         Aether-style hash / impulse / sleep
  src/input.js           window keys + pointer lock + gamepad
  src/camera.js          chase / first / orbit / fly (no lookAt)
  src/character.js       walk / sprint / crouch / fly
  src/vehicle.js         chassis + lateral grip
  src/voxel.js           chunk mesher
  src/world.js           open-world streamer
  src/combat.js          hitscan + projectile
  src/ray.js             quat-space rays
  src/events.js          EventBus
  src/engine.js          host loop + 4 demo modes
  demos/lab.html
  test/quat.test.mjs
```

## On disk / upstream

- Local Three r-family builds: Nuvola `Build and Learn Center/Three.js Helpers/` (mrdoob `examples/jsm` loaders and utils).
- Lab already vendors patterns from Aether Kernel (spatial hash, impulses) and CSGKernel (BSP booleans).
- Three.js itself: [github.com/mrdoob/three.js](https://github.com/mrdoob/three.js) — `Quaternion`, `Clock`, `WebGLRenderer`. This kernel does not fork Three; it sits on top.

## Demo

Open [`demos/lab.html`](./demos/lab.html) on a local static server (modules).

```
1 city   — walk / F enter car
2 race   — ring + chassis + grip
3 voxel  — chunks, Q place wood, E mine
4 arena  — orbit camera, click to fire
C fly    — noclip
V first / chase camera
click canvas for pointer lock · WASD · mouse · gamepad
```

```bash
npx --yes serve quat-engine
# then open /demos/lab.html
```

## Tests

```bash
cd quat-engine && npm test
```

Proves Hamilton `i⊗j = +k`, yaw-0 identity, 90° Y map, body-rate integration, slerp sign-fix, Exp/Log, sphere resolve, ray, projectile hit.

## Use

```js
import { QuatEngine } from '../QuatEngine.js';
const engine = new QuatEngine(canvas, { hud: document.getElementById('hud') });
engine.start();
```

```js
import { Quat } from '../QuatEngine.js';
const q = Quat.fromYawPitch(0.4, -0.1);
Quat.toThree(q, camera.quaternion);
```
