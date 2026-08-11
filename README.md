# Three.JS-Lab

A laboratory to make games, machines, apps, and more inside a web browser.

Public repo: [github.com/BHTANK/Three.JS-Lab](https://github.com/BHTANK/Three.JS-Lab)

---

## CSGKernel

Proper **BSP Constructive Solid Geometry** for three.js — the mesh boolean layer web prop kits actually need.

| Path | What |
|------|------|
| [`csg-kernel/CSGKernel.js`](./csg-kernel/CSGKernel.js) | Kernel + Brush/Evaluator + wall/door helpers |
| [`csg-kernel/CSGKernel.d.ts`](./csg-kernel/CSGKernel.d.ts) | TypeScript types |
| [`csg-kernel/demo.html`](./csg-kernel/demo.html) | Union / subtract / intersect playground |
| [`csg-kernel/wall-prefab.html`](./csg-kernel/wall-prefab.html) | Gap-free wall + door + windows |
| [`csg-kernel/README.md`](./csg-kernel/README.md) | Full API |

```js
import { CSG, wallWithDoor, Brush, Evaluator, SUBTRACTION } from './csg-kernel/CSGKernel.js';

scene.add(CSG.subtract(boxMesh, sphereMesh));

const { group } = wallWithDoor({ width: 5, height: 3, doorW: 1.05, doorH: 2.15 });
scene.add(group);
```

**Why:** stacking wall/window/frame meshes → z-fighting and door gaps. Convex plane-brushes can’t cut freeform openings. This kernel does real mesh booleans with world matrices and multi-material groups.

---

## NPAGrok.html

GTA-style Three.js city (r149). Solid asphalt overpass bridges, A-10, GPU static pack, 144 FPS target.

**Note:** The full local build embeds a ~361 MB offline NANO (GGUF) model and is **374 MB**, over GitHub’s 100 MB file limit. This repo copy omits the embedded model chunks so it can live on GitHub. The game is playable; the optional NANO AI brain will report “model blocks missing” until you paste the `b64model` scripts back from your local full file.

## Aether Kernel

Hardened client-side physics kernel demos (`Aether Kernel.html`, `Aether Kernel V2.html`) — spatial hash, sleep, substeps.

## GTA series

Earlier city / driving lab builds: `GTA.html`, `GTA2.html`, `GTA3.html`.
