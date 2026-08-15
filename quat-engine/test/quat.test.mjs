/**
 * Node self-test — Hamilton lock + integration + collision + combat.
 * Run: node test/quat.test.mjs
 */
import * as Q from '../src/quat.js';
import { stepBodyRate, makeBody, accumulate } from '../src/integrate.js';
import { resolveSpheres, sphereContact } from '../src/physics.js';
import { rayFromQuat, rayVsSphere } from '../src/ray.js';
import { Combat, makeDummy } from '../src/combat.js';

let failed = 0;
function check(name, cond, detail = '') {
  if (cond) console.log('PASS', name);
  else {
    failed++;
    console.error('FAIL', name, detail);
  }
}

const i = Q.create(0, 1, 0, 0);
const j = Q.create(0, 0, 1, 0);
const k = Q.mul(i, j);
check('Hamilton i\u2297j = +k', Q.eq(k, Q.create(0, 0, 0, 1)), Q.fmt(k));

const ji = Q.mul(j, i);
check('Hamilton j\u2297i = \u2212k', Q.eq(ji, Q.create(0, 0, 0, -1)), Q.fmt(ji));

const q0 = Q.fromYawPitch(0, 0);
check('yaw0 identity', Q.eq(q0, Q.identity()), Q.fmt(q0));

const qY = Q.fromAxisAngle([0, 1, 0], Math.PI / 2);
const v = Q.rotateVec(qY, [1, 0, 0]);
check('90 Y [1,0,0]->[0,0,-1]', Math.abs(v[0]) < 1e-6 && Math.abs(v[1]) < 1e-6 && Math.abs(v[2] + 1) < 1e-6, v.join(','));

const qb = Q.identity();
stepBodyRate(qb, [0, Math.PI / 2, 0], 1, qb);
const vb = Q.rotateVec(qb, [1, 0, 0]);
check('body-rate 90 Y', Math.abs(vb[0]) < 1e-6 && Math.abs(vb[2] + 1) < 1e-6, vb.join(','));

const a = Q.identity();
const b = Q.fromAxisAngle([0, 1, 0], Math.PI * 0.5);
const s0 = Q.slerp(a, b, 0);
const s1 = Q.slerp(a, b, 1);
check('slerp t=0', Q.eq(s0, a), Q.fmt(s0));
check('slerp t=1', Q.eq(s1, b), Q.fmt(s1));
const neg = Q.create(-b[0], -b[1], -b[2], -b[3]);
const smid = Q.slerp(a, neg, 0.5);
const smid2 = Q.slerp(a, b, 0.5);
check('slerp sign-fix', Q.eq(smid, smid2, 1e-5), Q.fmt(smid));

const phi = [0.3, -0.1, 0.8];
const qe = Q.Exp(phi);
const back = Q.Log(qe);
check('Exp/Log', Math.hypot(back[0] - phi[0], back[1] - phi[1], back[2] - phi[2]) < 1e-6, back.join(','));

const ft = Q.fromTo([0, 0, -1], [0, 1, 0]);
const mapped = Q.rotateVec(ft, [0, 0, -1]);
check('fromTo -Z -> +Y', Math.abs(mapped[0]) < 1e-6 && Math.abs(mapped[1] - 1) < 1e-6 && Math.abs(mapped[2]) < 1e-6, mapped.join(','));

const qPitch = Q.fromAxisAngle([1, 0, 0], 0.4);
const qYaw = Q.fromAxisAngle([0, 1, 0], 0.7);
const composed = Q.compose(qPitch, qYaw);
const manual = Q.mul(qYaw, qPitch);
check('compose', Q.eq(composed, manual), Q.fmt(composed));

const packed = { x: 0, y: 0, z: 0, w: 0, set(x, y, z, w) { this.x = x; this.y = y; this.z = z; this.w = w; } };
Q.toThree(Q.create(0.5, 0.1, 0.2, 0.3), packed);
check('toThree', packed.w === 0.5 && packed.x === 0.1 && packed.y === 0.2 && packed.z === 0.3);

const A = makeBody([0, 0, 0]);
A.radius = 1; A.mass = 1; A.invMass = 1; A.vel = [1, 0, 0];
const B = makeBody([1.2, 0, 0]);
B.radius = 1; B.mass = 1; B.invMass = 1; B.vel = [-1, 0, 0];
const n = [0, 0, 0];
const pen0 = sphereContact(A, B, n);
const dist0 = Math.hypot(A.pos[0] - B.pos[0], A.pos[1] - B.pos[1], A.pos[2] - B.pos[2]);
for (let i = 0; i < 12; i++) resolveSpheres(A, B);
const dist = Math.hypot(A.pos[0] - B.pos[0], A.pos[1] - B.pos[1], A.pos[2] - B.pos[2]);
check('sphere overlap exists', pen0 > 0, String(pen0));
check('sphere resolve separates', dist > dist0 && dist >= 1.95, String(dist));

const hit = rayVsSphere([0, 0, 0], [0, 0, -1], [0, 0, -5], 1);
check('rayVsSphere', hit && Math.abs(hit.t - 4) < 1e-6, hit && String(hit.t));

const ray = rayFromQuat([0, 0, 0], Q.identity());
check('rayFromQuat -Z', Math.abs(ray.dir[0]) < 1e-9 && Math.abs(ray.dir[2] + 1) < 1e-9, ray.dir.join(','));

const combat = new Combat();
combat.rate = 0;
const dummy = makeDummy([0, 1.4, -2], 40);
combat.tryFire([0, 0, 0], Q.identity(), 1.4);
for (let i = 0; i < 20; i++) combat.tick(0.02, [dummy]);
check('projectile hits dummy', dummy.health < 40 || dummy.dead, 'hp=' + dummy.health);

let steps = 0;
const st = { acc: 0 };
accumulate(st, 0.05, () => { steps++; }, 1 / 60, 8);
check('accumulate 0.05s @ 60Hz', steps === 3, String(steps));

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('ALL PASS');
