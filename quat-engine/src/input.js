/**
 * Keyboard + pointer lock + gamepad.
 * Look is two scalars consumed by quat cameras — never an Euler object.
 * Key polling lives on `window` (Aether InputManager). Pointer-lock click
 * lives on the canvas (mrdoob PointerLockControls pattern, minus the Euler).
 */

export class Input {
  constructor(target = window) {
    this.keys = Object.create(null);
    this.lookX = 0;
    this.lookY = 0;
    this._mx = 0;
    this._my = 0;
    this.locked = false;
    this.fire = false;
    this._padSteer = 0;
    this._padThrottle = 0;
    this._onKey = (e) => {
      this.keys[e.code] = e.type === 'keydown';
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
    };
    this._onMove = (e) => {
      if (!this.locked && e.buttons === 0) return;
      this._mx += e.movementX || 0;
      this._my += e.movementY || 0;
    };
    this._onDown = (e) => {
      if (e.button === 0) this.fire = true;
    };
    this._onUp = (e) => {
      if (e.button === 0) this.fire = false;
    };
    this._onClick = () => {
      if (target.requestPointerLock) target.requestPointerLock();
    };
    this._onLock = () => {
      this.locked = document.pointerLockElement === target;
    };
    this._onBlur = () => {
      this.keys = Object.create(null);
    };
    window.addEventListener('keydown', this._onKey);
    window.addEventListener('keyup', this._onKey);
    window.addEventListener('blur', this._onBlur);
    if (target && target.addEventListener) {
      target.addEventListener('mousemove', this._onMove);
      target.addEventListener('mousedown', this._onDown);
      target.addEventListener('mouseup', this._onUp);
      target.addEventListener('click', this._onClick);
    }
    document.addEventListener('pointerlockchange', this._onLock);
    this._target = target;
  }

  down(code) {
    return !!this.keys[code];
  }

  axis() {
    this.pollGamepad();
    const x = (this.down('KeyD') || this.down('ArrowRight') ? 1 : 0)
            - (this.down('KeyA') || this.down('ArrowLeft') ? 1 : 0)
            + this._padSteer;
    const z = (this.down('KeyW') || this.down('ArrowUp') ? 1 : 0)
            - (this.down('KeyS') || this.down('ArrowDown') ? 1 : 0)
            + this._padThrottle;
    return [Math.max(-1, Math.min(1, x)), Math.max(-1, Math.min(1, z))];
  }

  consumeLook(sensitivity = 0.0022) {
    this.pollGamepad();
    this.lookX -= this._mx * sensitivity;
    this.lookY -= this._my * sensitivity;
    this.lookY = Math.max(-1.2, Math.min(1.2, this.lookY));
    this._mx = 0;
    this._my = 0;
    return [this.lookX, this.lookY];
  }

  /** Standard gamepad: left stick move, right stick look, RT/A fire. */
  pollGamepad() {
    this._padSteer = 0;
    this._padThrottle = 0;
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return;
    const pads = navigator.getGamepads();
    const p = pads && (pads[0] || pads[1]);
    if (!p) return;
    const dead = (v) => Math.abs(v) < 0.18 ? 0 : v;
    this._padSteer = dead(p.axes[0] || 0);
    this._padThrottle = -dead(p.axes[1] || 0);
    this.lookX -= dead(p.axes[2] || 0) * 0.04;
    this.lookY -= dead(p.axes[3] || 0) * 0.03;
    if (p.buttons[7]?.pressed || p.buttons[0]?.pressed) this.fire = true;
  }

  dispose() {
    window.removeEventListener('keydown', this._onKey);
    window.removeEventListener('keyup', this._onKey);
    window.removeEventListener('blur', this._onBlur);
    if (this._target && this._target.removeEventListener) {
      this._target.removeEventListener('mousemove', this._onMove);
      this._target.removeEventListener('mousedown', this._onDown);
      this._target.removeEventListener('mouseup', this._onUp);
      this._target.removeEventListener('click', this._onClick);
    }
    document.removeEventListener('pointerlockchange', this._onLock);
  }
}
