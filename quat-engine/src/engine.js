/**
 * QuatEngine — host loop. Games are modes, not forks of the kernel.
 */

import * as THREE from 'three';
import { Input } from './input.js';
import { QuatCamera } from './camera.js';
import { Character } from './character.js';
import { Vehicle } from './vehicle.js';
import { VoxelWorld, WOOD } from './voxel.js';
import { WorldStreamer } from './world.js';
import { Combat, makeDummy } from './combat.js';
import { EventBus } from './events.js';
import { SpatialHash } from './physics.js';
import * as Q from './quat.js';
import { fmt } from './quat.js';

export const MODES = ['city', 'race', 'voxel', 'arena'];

export class QuatEngine {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.clock = new THREE.Clock();
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87a0b8);
    this.scene.fog = new THREE.Fog(0x87a0b8, 40, 220);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.camera3 = new THREE.PerspectiveCamera(70, 1, 0.08, 800);
    this.cam = new QuatCamera(this.camera3);
    this.input = new Input(canvas);
    this.bus = new EventBus();
    this.player = new Character([0, 8, 0]);
    this.car = new Vehicle([6, 2, 8]);
    this.mode = options.mode || 'city';
    this.inCar = false;
    this.camStyle = 'chase';
    this.voxels = new VoxelWorld(2);
    this.streamer = new WorldStreamer(48);
    this.combat = new Combat();
    this.hash = new SpatialHash(4);
    this.dummies = [];
    this._dummyMeshes = [];
    this._shots = [];
    this.hud = options.hud || null;
    this._fps = 0;
    this._fpsT = 0;
    this._frames = 0;
    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);
    this.resize();
    this._buildLights();
    this._buildCity();
    this._buildRace();
    this._buildArena();
    this.scene.add(this.voxels.group);
    this._playerMesh = this._makeCapsule(0x3d7ea6);
    this._carMesh = this._makeCar();
    this.scene.add(this._playerMesh, this._carMesh);
    this._bindKeys();
    this.setMode(this.mode);
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera3.aspect = w / Math.max(1, h);
    this.camera3.updateProjectionMatrix();
  }

  _buildLights() {
    this.scene.add(new THREE.HemisphereLight(0xc8d8ff, 0x3a2a18, 0.7));
    const sun = new THREE.DirectionalLight(0xfff1d0, 1.05);
    sun.position.set(30, 50, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    this.scene.add(sun);
  }

  _makeCapsule(color) {
    const g = new THREE.CapsuleGeometry(0.35, 1.1, 6, 10);
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.55 });
    const mesh = new THREE.Mesh(g, m);
    mesh.castShadow = true;
    return mesh;
  }

  _makeCar() {
    const g = new THREE.BoxGeometry(1.8, 0.6, 3.4);
    const m = new THREE.MeshStandardMaterial({ color: 0xc0392b, metalness: 0.3, roughness: 0.4 });
    const mesh = new THREE.Mesh(g, m);
    mesh.castShadow = true;
    return mesh;
  }

  _buildCity() {
    this.city = new THREE.Group();
    this.city.name = 'city';
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(400, 400),
      new THREE.MeshStandardMaterial({ color: 0x3a3a40, roughness: 0.95 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.city.add(ground);
    const rng = (s) => {
      let x = s | 0;
      return () => {
        x = (x * 1664525 + 1013904223) | 0;
        return (x >>> 0) / 4294967296;
      };
    };
    const r = rng(7);
    for (let i = 0; i < 70; i++) {
      const w = 4 + r() * 8, d = 4 + r() * 8, h = 6 + r() * 28;
      const b = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(0.58, 0.08, 0.25 + r() * 0.2) }),
      );
      let x = (r() - 0.5) * 180, z = (r() - 0.5) * 180;
      if (Math.abs(x) < 8) x += 16;
      if (Math.abs(z) < 8) z += 16;
      b.position.set(x, h / 2, z);
      b.castShadow = true;
      this.city.add(b);
    }
    this.scene.add(this.city);
    this.streamer.group = this.city;
  }

  _buildRace() {
    this.track = new THREE.Group();
    this.track.name = 'track';
    const asphalt = new THREE.Mesh(
      new THREE.RingGeometry(18, 32, 64),
      new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.9 }),
    );
    asphalt.rotation.x = -Math.PI / 2;
    asphalt.receiveShadow = true;
    this.track.add(asphalt);
    const infield = new THREE.Mesh(
      new THREE.CircleGeometry(18, 48),
      new THREE.MeshStandardMaterial({ color: 0x2f6b2f }),
    );
    infield.rotation.x = -Math.PI / 2;
    infield.position.y = 0.01;
    this.track.add(infield);
    this.scene.add(this.track);
  }

  _buildArena() {
    this.arena = new THREE.Group();
    this.arena.name = 'arena';
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(22, 40),
      new THREE.MeshStandardMaterial({ color: 0x4a1c1c, roughness: 0.8 }),
    );
    floor.rotation.x = -Math.PI / 2;
    this.arena.add(floor);
    const wall = new THREE.Mesh(
      new THREE.TorusGeometry(22, 0.6, 8, 40),
      new THREE.MeshStandardMaterial({ color: 0x111111 }),
    );
    wall.rotation.x = Math.PI / 2;
    wall.position.y = 0.6;
    this.arena.add(wall);
    this.scene.add(this.arena);
    const spots = [[6, 1, 4], [-5, 1, 6], [0, 1, -8], [8, 1, -3], [-7, 1, -5]];
    for (const p of spots) {
      const d = makeDummy(p, 40);
      this.dummies.push(d);
      const mesh = this._makeCapsule(0xb03a2e);
      mesh.position.set(p[0], p[1] + 0.2, p[2]);
      this.arena.add(mesh);
      this._dummyMeshes.push(mesh);
    }
  }

  _bindKeys() {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Digit1') this.setMode('city');
      if (e.code === 'Digit2') this.setMode('race');
      if (e.code === 'Digit3') this.setMode('voxel');
      if (e.code === 'Digit4') this.setMode('arena');
      if (e.code === 'KeyV') {
        this.camStyle = this.camStyle === 'first' ? 'chase' : 'first';
      }
      if (e.code === 'KeyF' && this.mode === 'city') this.inCar = !this.inCar;
      if (e.code === 'KeyE' && this.mode === 'voxel') {
        const p = this.player.body.pos;
        this.voxels.setBlock(Math.round(p[0]), Math.floor(p[1]) - 1, Math.round(p[2]), 0);
      }
      if (e.code === 'KeyQ' && this.mode === 'voxel') {
        const p = this.player.body.pos;
        this.voxels.setBlock(Math.round(p[0] + 1), Math.floor(p[1]), Math.round(p[2]), WOOD);
      }
    });
  }

  setMode(mode) {
    this.mode = mode;
    this.city.visible = mode === 'city';
    this.track.visible = mode === 'race';
    this.arena.visible = mode === 'arena';
    this.voxels.group.visible = mode === 'voxel';
    this.scene.background.set(mode === 'voxel' ? 0x7ec8e3 : mode === 'arena' ? 0x1a0a0a : 0x87a0b8);
    this.scene.fog.color.copy(this.scene.background);
    this._carMesh.visible = mode === 'city' || mode === 'race';
    if (mode === 'voxel') {
      this.voxels.ensureAround(this.player.body.pos[0], this.player.body.pos[2]);
      this.player.body.pos[1] = this.voxels.heightAt(this.player.body.pos[0], this.player.body.pos[2]) + 2;
    }
    if (mode === 'race') {
      this.inCar = true;
      this.car.body.pos = [26, 1, 0];
    }
    if (mode === 'city') this.inCar = false;
    if (mode === 'arena') {
      this.inCar = false;
      this.player.body.pos = [0, 2, 0];
      this.player.health = 100;
    }
    this.bus.emit('mode', mode);
  }

  _height(x, z) {
    if (this.mode === 'voxel') return this.voxels.heightAt(x, z) + 0.9;
    if (this.mode === 'race') return 0.7;
    return 0.9;
  }

  tick() {
    const dt = Math.min(0.05, this.clock.getDelta());
    this._frames++;
    this._fpsT += dt;
    if (this._fpsT >= 0.4) {
      this._fps = this._frames / this._fpsT;
      this._frames = 0;
      this._fpsT = 0;
    }
    const [yaw, pitch] = this.input.consumeLook();
    this.player.body.q && (this.input.lookY = pitch);
    if (this.mode === 'voxel') {
      this.voxels.ensureAround(this.player.body.pos[0], this.player.body.pos[2]);
    }
    const driving = this.inCar && (this.mode === 'city' || this.mode === 'race');
    if (driving) {
      this.car.tick(this.input, dt, (x, z) => this._height(x, z));
      this.player.body.pos[0] = this.car.body.pos[0];
      this.player.body.pos[1] = this.car.body.pos[1];
      this.player.body.pos[2] = this.car.body.pos[2];
      if (this.camStyle === 'first') this.cam.firstPerson(this.car.body.pos, yaw, pitch, 1.1);
      else this.cam.chase(this.car.body.pos, this.car.body.q, yaw, pitch);
    } else {
      this.player.tick(this.input, dt, (x, z) => this._height(x, z), yaw);
      if (this.player.mode === 'fly') this.cam.fly(this.player.body.pos, yaw, this.input.lookY);
      else if (this.mode === 'arena') this.cam.orbit(this.player.body.pos, yaw, pitch, 9);
      else if (this.camStyle === 'first') this.cam.firstPerson(this.player.body.pos, yaw, pitch);
      else this.cam.chase(this.player.body.pos, this.player.body.q, yaw, pitch);
    }

    if (this.mode === 'arena' && this.input.fire) {
      const shot = this.combat.tryFire(this.player.body.pos, this.cam.q, 1.4);
      if (shot) this.bus.emit('fire', shot);
    }
    this.combat.tick(dt, this.dummies);
    this._syncShots();
    this._syncMeshes();
    this.renderer.render(this.scene, this.camera3);
    if (this.hud) this._writeHud(dt);
  }

  _syncShots() {
    while (this._shots.length < this.combat.projectiles.length) {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xffee88 }),
      );
      this.scene.add(m);
      this._shots.push(m);
    }
    for (let i = 0; i < this._shots.length; i++) {
      const p = this.combat.projectiles[i];
      const m = this._shots[i];
      if (!p) {
        m.visible = false;
        continue;
      }
      m.visible = true;
      m.position.set(p.pos[0], p.pos[1], p.pos[2]);
    }
    for (let i = 0; i < this.dummies.length; i++) {
      const d = this.dummies[i];
      const m = this._dummyMeshes[i];
      m.visible = !d.dead;
      if (!d.dead) m.position.set(d.pos[0], d.pos[1] + 0.2, d.pos[2]);
    }
  }

  _syncMeshes() {
    const p = this.player.body;
    this._playerMesh.position.set(p.pos[0], p.pos[1] + 0.2, p.pos[2]);
    Q.toThree(p.q, this._playerMesh.quaternion);
    this._playerMesh.visible = !(this.inCar && (this.mode === 'city' || this.mode === 'race'));
    const c = this.car.body;
    this._carMesh.position.set(c.pos[0], c.pos[1], c.pos[2]);
    Q.toThree(c.q, this._carMesh.quaternion);
  }

  _writeHud(dt) {
    const q = this.inCar ? this.car.body.q : this.player.body.q;
    const p = this.player.body.pos;
    const alive = this.dummies.filter((d) => !d.dead).length;
    this.hud.textContent =
      `mode ${this.mode}   q ${fmt(q)}   pos ${p[0].toFixed(1)},${p[1].toFixed(1)},${p[2].toFixed(1)}` +
      `   dt ${(dt * 1000).toFixed(1)}ms   ${this._fps.toFixed(0)} fps` +
      (this.mode === 'arena' ? `   dummies ${alive}/${this.dummies.length}` : '') +
      (this.player.mode === 'fly' ? '   FLY' : '');
  }

  start() {
    const loop = () => {
      this.tick();
      this._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);
  }

  stop() {
    cancelAnimationFrame(this._raf);
    this.input.dispose();
    window.removeEventListener('resize', this._onResize);
  }
}
