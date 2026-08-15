# Credits

QuatEngine sits on work already in this lab and on public three.js sources.

## Convention lock

- Hamilton algebra + Solà body-rate (`q̇ = ½ q ⊗ ω_local`): [Joan Solà, *Quaternion kinematics for the error-state Kalman filter*, arXiv:1711.02508](https://arxiv.org/abs/1711.02508)
- Nuvola Quaternion Engine Room (same lock: `[w,x,y,z]`, local→global, no Euler in the integrator)

## This lab

- **Aether Kernel V2** — spatial hash, sleep/wake, Baumgarte slop, Coulomb friction, EventBus, window-level input polling
- **CSGKernel** — BSP mesh booleans for interiors / wall+door prefabs
- **GTA.html / GTA2.html / GTA3.html / NPAGrok.html** — open-world city / drive lab surfaces this kernel is meant to host

## three.js (mrdoob and contributors)

- [three.js](https://github.com/mrdoob/three.js) — `WebGLRenderer`, `Clock`, `PerspectiveCamera`, geometries, lights
- [PointerLockControls](https://github.com/mrdoob/three.js/blob/dev/examples/jsm/controls/PointerLockControls.js) — pointer-lock *API* pattern (click to lock, `movementX/Y`). QuatEngine does **not** copy the Euler `YXZ` path; look is two scalars written into a Hamilton quaternion.

Local helper tree used while writing: `Nuvola AI Assistant/Build and Learn Center/Three.js Helpers/` (vendored r-family `jsm/`).

## Not included

This package does not vendor three.js, Rapier, Cannon, or any AAA title assets. Games are modes on the kernel, not ports of GTA V / Forza / Minecraft / Crimson.
