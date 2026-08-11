# CSGKernel

**A proper BSP Constructive Solid Geometry kernel for [three.js](https://threejs.org/).**

Built so procedural web asset kits don’t have to stack coplanar boxes and pray.

| | |
|---|---|
| Ops | `union` · `subtract` · `reverseSubtract` · `intersect` · `difference` (XOR) |
| API | `CSG.*` helpers · **`Brush` + `Evaluator`** (three-bvh-csg shape) · prefab helpers |
| Input | `Mesh` · `Brush` · `BufferGeometry` · native CSG solids |
| Output | `Mesh` · `BufferGeometry` · multi-material **groups** |
| Geometry | Modern **BufferGeometry** only |
| Transforms | Full **world matrix** (nested groups OK) |
| Prefabs | `wallWithOpenings` · `doorFrame` · `wallWithDoor` |
| Module | ES module, three ≥ 0.150 (demos on r160) |

---

## Why this exists

[@alightinastorm](https://x.com/alightinastorm) (and every vibe-coded three.js prop kit) hits the same wall:

1. **Stacking** wall + window + frame → **z-fighting** and **gaps** (“codex math ain’t mathing”).
2. **Plane / convex brush kernels** (e.g. `@ggez/geometry-kernel` AABB brushes) cannot cut arbitrary door/window openings into freeform mesh props.
3. **three-bvh-csg** is fast but documented as experimental; results may not be two-manifold; missing triangles on coplanar cases.
4. **Manifold** is great CAD — he already noted “manifold won't work / no fillet” for his pipeline.
5. Older three CSG ports still assume legacy `Geometry` or drop transforms.

This kernel optimizes for **correct boolean solids on BufferGeometry** with **world matrices**, **multi-material groups**, and **wall/door helpers that don’t leave gaps**.

> Not a replacement for `@ggez/geometry-kernel` (bevel, sculpt, editable mesh, convex brushes).  
> It’s the **missing 3D mesh boolean layer** that kernel doesn’t ship.

---

## Install

Copy `csg-kernel/` into your repo, or depend on the lab path:

```bash
# from a monorepo / lab clone
import { CSG, Brush, Evaluator, wallWithDoor } from './csg-kernel/CSGKernel.js';
```

Peer: `three >= 0.150`.

---

## Quick start

```js
import * as THREE from 'three';
import { CSG, SUBTRACTION, Brush, Evaluator, wallWithDoor } from './CSGKernel.js';

// 1) One-liners
const box = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2));
const ball = new THREE.Mesh(new THREE.SphereGeometry(1.25, 24, 16));
ball.position.set(0.6, 0.4, 0.2);
scene.add(CSG.subtract(box, ball));

// 2) Brush + Evaluator (familiar if you used three-bvh-csg)
const evalr = new Evaluator();
const a = new Brush(new THREE.BoxGeometry(2, 2, 2));
const b = new Brush(new THREE.SphereGeometry(1.2, 24, 16));
b.position.y = 0.4;
a.prepare(); b.prepare();
const result = evalr.evaluate(a, b, SUBTRACTION);
scene.add(result);

// 3) Wall + door WITHOUT gaps / z-fight
const { group } = wallWithDoor({
  width: 5, height: 3, thickness: 0.28,
  doorW: 1.05, doorH: 2.15
});
scene.add(group);
```

---

## API

### Operations

| Constant | Meaning |
|----------|---------|
| `ADDITION` | A ∪ B |
| `SUBTRACTION` | A \\ B |
| `REVERSE_SUBTRACTION` | B \\ A |
| `INTERSECTION` | A ∩ B |
| `DIFFERENCE` | A ⊕ B |

```js
CSG.union(a, b, opts?)
CSG.subtract(a, b, opts?)
CSG.reverseSubtract(a, b, opts?)
CSG.intersect(a, b, opts?)
CSG.difference(a, b, opts?)
CSG.unionAll([a, b, c, …], opts?)
CSG.subtractAll(base, [c0, c1, …], opts?)  // multi-window walls
```

**Options:** `asGeometry`, `asCSG`, `material`, `matrixA` / `matrixB`, `useGroups`.

### Brush / Evaluator

```js
const evaluator = new Evaluator();
evaluator.useGroups = true; // multi-material geometry.groups
const out = evaluator.evaluate(brushA, brushB, SUBTRACTION);
const chain = evaluator.evaluateChain(
  [wall, win1, win2, door],
  [SUBTRACTION, SUBTRACTION, SUBTRACTION]
);
```

### Prefab helpers (the door/frame gap fix)

```js
// Cut N openings; cutter overshoots thickness so faces don’t z-fight
wallWithOpenings({
  width: 6, height: 3, thickness: 0.25,
  openings: [
    { x: -1.5, y: 0.2, w: 1.2, h: 1.2 }, // window
    { x: 0.8, y: -0.4, w: 1.0, h: 2.1 }  // door
  ]
});

// Frame sized to the opening (no floating gap)
doorFrame({ openingW: 1.0, openingH: 2.1, depth: 0.3, frameThickness: 0.08 });

// Wall + fitted frame group (or merge: true → one solid)
wallWithDoor({ width: 5, height: 3, doorW: 1.05, doorH: 2.15, merge: false });
```

### Primitives

```js
CSG.cube({ center, radius, materialIndex })
CSG.sphere({ center, radius, slices, stacks, materialIndex })
CSG.cylinder({ start, end, radius, slices, materialIndex })
CSG.boxFromBounds(min, max, materialIndex)
```

### Solid-level

```js
const A = CSG.fromMesh(meshA);
const B = CSG.fromGeometry(geoB, matrixWorld);
const C = A.subtract(B);
C.toMesh(material);
C.toGeometry({ useGroups: true });
```

---

## Demos

| File | What |
|------|------|
| [`demo.html`](./demo.html) | Classic union / subtract / intersect playground |
| [`wall-prefab.html`](./wall-prefab.html) | Wall + door + multi-window prefab (gap-free) |

```bash
# from repo root (ES modules need HTTP)
npx --yes serve .
# → /csg-kernel/demo.html
# → /csg-kernel/wall-prefab.html
```

---

## How it works

BSP trees + polygon clipping (Evan Wallace [csg.js](https://github.com/evanw/csg.js), MIT).

```
union:     clip A↔B, drop coplanar dupes from B, merge
subtract:  invert A, union-style clip, invert result
intersect: dual invert + clip
```

Coplanar spanning cases use the classic split rules — the reason stacked “fake booleans” z-fight and real kernels must cut through thickness with a slight overshoot (`cutterOvershoot` on walls).

---

## When *not* to use pure BSP

| Situation | Prefer |
|-----------|--------|
| Huge meshes (10k+ tris / operand) every frame | `three-bvh-csg` (speed) or cache results |
| CAD-grade manifold guarantees + fillets | Manifold / OpenCASCADE (heavier) |
| Convex AABB brush edit / bevel / sculpt | `@ggez/geometry-kernel` (already good at that) |
| Open / non-manifold inputs | Fix topology first — booleans need closed solids |

This package is the **correct, clear, three.js-native boolean kernel** for procedural props and prefabs.

---

## Fits the friend’s stack

| His package | Role | CSGKernel role |
|-------------|------|----------------|
| `@ggez/geometry-kernel` | Convex brushes, editable mesh, bevel, extrude | **3D mesh CSG** on the result |
| `@three-roads/*` | Road graphs + mesher | Cut curbs / tunnels if needed |
| `three-fenestra` | Interior-mapping window shader | Use after `wallWithOpenings` for glass panes |
| Procedural prop kit (scifi-kit style) | Codex-generated meshes | Union parts · subtract cavities · no z-fight |
| GGEZ / Web Hammer editors | “bad kernel” history | Drop-in Evaluator + Brush API |

---

## License

MIT. BSP algorithm © 2011 Evan Wallace. three.js bridge, Brush/Evaluator, prefab helpers © BHTANK / Three.JS-Lab.
