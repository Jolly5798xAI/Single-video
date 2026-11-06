import TL from '../timeline/timeline.json';
import {Key, ramp, samplePath, Vec3, window01} from '../animations/math';
import {add, blend, COVER_HEAD, gaitPhase, gaitPose, LAUGH, LOOK_UP, PHONE_R, SIT_BENCH, STAND} from '../animations/pose';
import {Expr, Look} from '../characters/Blocky';
import {ActorState, blinkAt} from './hero';

const T = TL.T;

type Act = 'phone' | 'laugh' | 'cover' | 'lookup' | 'sit' | 'around';
export interface NpcDef {
  id: string;
  look: Look;
  keys: Key[];
  acts: {a: Act; t0: number; t1: number}[];
  show: [number, number];
  group: 'street' | 'shelter' | 'mom';
  calm?: Expr;
}

/** Build keys from [t, x, z, yaw?]; yaw follows the walking direction unless given. */
function path(y: number, pts: (number | undefined)[][]): Key[] {
  const keys: Key[] = [];
  let prevYaw = (pts[0][3] as number | undefined) ?? 0;
  for (let i = 0; i < pts.length; i++) {
    const [t, x, z, yw] = pts[i] as number[];
    let yaw = prevYaw;
    if (yw !== undefined) yaw = yw;
    else if (i > 0) {
      const [, px, pz] = pts[i - 1] as number[];
      if (Math.hypot(x - px, z - pz) > 0.05) yaw = Math.atan2(x - px, z - pz);
    } else if (pts.length > 1) {
      const [, nx, nz] = pts[1] as number[];
      if (Math.hypot(nx - x, nz - z) > 0.05) yaw = Math.atan2(nx - x, nz - z);
    }
    while (yaw - prevYaw > Math.PI) yaw -= Math.PI * 2;
    while (yaw - prevYaw < -Math.PI) yaw += Math.PI * 2;
    prevYaw = yaw;
    keys.push({t, p: [x, y, z], yaw, e: 'lin'});
  }
  // the first segment takes the initial direction
  if (keys.length > 1) keys[0].yaw = keys[1].yaw;
  return keys;
}

const L = (shirt: string, pants: string, hair: string, hairStyle: Look['hairStyle'], extra: Partial<Look> = {}): Look => ({
  shirt, pants, hair, hairStyle, shoes: '#2b2b2b', skin: '#eec09a', ...extra,
});

const Y = 0.15;
export const NPCS: NpcDef[] = [
  // laughs at the alarm, then runs
  {id: 'laugher', group: 'street', look: L('#3f7d3a', '#30333a', '#6b4b2a', 'cap', {hat: '#222b3a'}), show: [0, 55],
    keys: path(Y, [[0, 6.2, -40.0], [20.9, 6.2, -14.0], [26.4, 6.2, -14.0, 0], [26.9, 6.2, -15.0], [43, 6.2, -79]]),
    acts: [{a: 'laugh', t0: T.someoneLaughs - 0.1, t1: 24.0}]},
  // woman in red who starts running across the road
  {id: 'runnerW', group: 'street', look: L('#c0392b', '#2f3542', '#2d1e14', 'long', {skin: '#f1c6a6'}), show: [0, 55],
    keys: path(Y, [[0, 8.4, -30.0], [16, 8.4, -17.2], [T.someoneRuns + 0.25, 8.4, -17.2, 0.2], [26.6, -7.0, -26.0], [43, -7.0, -95]]),
    acts: [{a: 'phone', t0: 12.0, t1: T.someoneRuns}]},
  // man in an ushanka with a moustache – reads the phone, then runs
  {id: 'ushanka', group: 'street', look: L('#2f5aa8', '#202227', '#3a2a1c', 'ushanka', {mustache: true, hat: '#5b4636'}), show: [0, 55],
    keys: path(Y, [[0, 8.5, 12.0], [10.8, 8.5, -0.2], [27.6, 8.5, -0.2, Math.PI], [28.2, 8.4, -2.0], [43, 8.4, -68]]),
    acts: [{a: 'phone', t0: 11.0, t1: 27.4}]},
  // grandmother – looks at the sky, then hurries into a building
  {id: 'granny', group: 'street', look: L('#7d4f9a', '#3b3b45', '#d9d9d9', 'bun', {skin: '#ecc3a3'}), show: [0, 55],
    keys: path(Y, [[0, -7.0, -30.0], [20.9, -7.0, -11.2], [25.0, -7.0, -11.2, 0], [28.0, -9.9, -14.5]]),
    acts: [{a: 'lookup', t0: 21.2, t1: 24.8}]},
  // guy with a backpack walking ahead of the hero
  {id: 'backpack', group: 'street', look: L('#e1b12c', '#3d3d46', '#2a1d14', 'short', {bag: '#2f3640'}), show: [0, 55],
    keys: path(Y, [[0, 8.2, -3.0], [20.9, 8.2, -30.0], [24.0, 8.2, -30.0, Math.PI], [24.6, 8.2, -32.0], [43, 8.2, -110]]),
    acts: [{a: 'phone', t0: 21.0, t1: 24.0}]},
  // couple on the left sidewalk
  {id: 'coupleA', group: 'street', look: L('#2d3436', '#636e72', '#4b3621', 'short'), show: [0, 55],
    keys: path(Y, [[0, -6.6, 5.0], [20.9, -6.6, -20.0], [25.0, -6.6, -20.0, Math.PI], [25.6, -6.6, -22.0], [43, -6.6, -88]]),
    acts: [{a: 'around', t0: 21, t1: 25}]},
  {id: 'coupleB', group: 'street', look: L('#e17055', '#2d3436', '#8e5b3a', 'long'), show: [0, 55],
    keys: path(Y, [[0, -7.4, 5.4], [20.9, -7.4, -19.6], [25.0, -7.4, -19.6, Math.PI], [25.7, -7.4, -21.6], [43, -7.4, -86]]),
    acts: [{a: 'phone', t0: 21, t1: 25}]},
  // runners along the hero's route
  {id: 'r1', group: 'street', look: L('#0984e3', '#2d3436', '#1e1e1e', 'short'), show: [0, 55],
    keys: path(Y, [[0, 8.9, -45.0], [24.5, 8.9, -20.5], [25.0, 8.9, -20.5, Math.PI], [25.6, 8.6, -22.5], [43, 8.9, -72]]),
    acts: [{a: 'cover', t0: 30, t1: 43}]},
  {id: 'r2', group: 'street', look: L('#6c5ce7', '#2d3436', '#e0c070', 'long', {skin: '#f3cfb0'}), show: [0, 55],
    keys: path(Y, [[0, 9.0, -52.0, -Math.PI / 2], [30.0, 9.0, -52.0, -Math.PI / 2], [30.6, 8.0, -54.0], [43, 7.6, -100]]),
    acts: [{a: 'phone', t0: 12, t1: 30}, {a: 'cover', t0: 30.6, t1: 43}]},
  {id: 'r3', group: 'street', look: L('#00b894', '#2d3436', '#2a1d14', 'cap', {hat: '#b33939'}), show: [0, 55],
    keys: path(Y, [[0, -7.0, -58.0, 1.5], [32.5, -7.0, -58.0, 1.5], [36.0, 6.0, -64.0], [43, 6.0, -92]]),
    acts: []},
  {id: 'r4', group: 'street', look: L('#d63031', '#2d3436', '#3a2a1c', 'short', {mustache: true}), show: [0, 55],
    keys: path(Y, [[0, -6.8, -100.0, 0], [30.0, -6.8, -100.0, 0], [43, -6.8, -50]]),
    acts: [{a: 'cover', t0: 30, t1: 43}]},
  {id: 'r5', group: 'street', look: L('#fdcb6e', '#2d3436', '#1e1e1e', 'short'), show: [0, 55],
    keys: path(Y, [[0, 6.0, -112.0, 0], [32.0, 6.0, -112.0, 0], [43, 6.0, -68]]),
    acts: []},
  {id: 'r6door', group: 'street', look: L('#636e72', '#2d3436', '#4b3621', 'short', {bag: '#a0522d'}), show: [0, 43.5],
    keys: path(Y, [[0, 7.6, -66.0, 0], [35.6, 7.6, -66.0, 0], [36.2, 7.6, -68.0], [41.0, 9.0, -85.6], [41.6, 11.5, -86.4]]),
    acts: []},
  {id: 'frozen', group: 'street', look: L('#b2bec3', '#2d3436', '#7f8c8d', 'bald', {mustache: true}), show: [0, 55],
    keys: path(Y, [[0, 8.6, -74.0, -2.2], [60, 8.6, -74.0, -2.2]]),
    acts: [{a: 'lookup', t0: 15, t1: 60}]},
  {id: 'r8', group: 'street', look: L('#e84393', '#2d3436', '#2a1d14', 'bun'), show: [0, 55],
    keys: path(Y, [[0, 9.0, -14.0, 0], [8, 9.0, -2.0], [30.0, 9.0, -2.0, Math.PI], [30.8, 8.8, -5.0], [43, 8.8, -58.0]]),
    acts: [{a: 'phone', t0: 9, t1: 29.8}]},
  {id: 'r9', group: 'street', look: L('#74b9ff', '#2d3436', '#1e1e1e', 'cap', {hat: '#2d3436'}), show: [0, 55],
    keys: path(Y, [[0, 3.4, -5.0, Math.PI], [30.6, 3.4, -5.0, Math.PI], [31.2, 3.4, -7.0], [43, 3.4, -55]]),
    acts: [{a: 'cover', t0: 32, t1: 43}]},
  // shelter people
  {id: 's1', group: 'shelter', look: L('#a29bfe', '#2d3436', '#dcdde1', 'bun', {skin: '#ecc3a3'}), show: [44, 80],
    keys: path(-3.5, [[0, -3.85, -27.3, Math.PI / 2], [100, -3.85, -27.3, Math.PI / 2]]), acts: [{a: 'sit', t0: 0, t1: 100}]},
  {id: 's2', group: 'shelter', look: L('#55efc4', '#2d3436', '#2a1d14', 'short'), show: [44, 80],
    keys: path(-3.5, [[0, -3.85, -29.6, Math.PI / 2], [100, -3.85, -29.6, Math.PI / 2]]), acts: [{a: 'sit', t0: 0, t1: 100}]},
  {id: 's3', group: 'shelter', look: L('#fab1a0', '#2d3436', '#4b3621', 'long'), show: [44, 80],
    keys: path(-3.5, [[0, -3.85, -33.4, Math.PI / 2], [100, -3.85, -33.4, Math.PI / 2]]), acts: [{a: 'sit', t0: 0, t1: 100}]},
  // crowd around mom
  {id: 'm1', group: 'mom', look: L('#0984e3', '#2d3436', '#1e1e1e', 'short'), show: [73, 78],
    keys: path(Y, [[73, -6.1, -129.0], [77.6, -6.1, -150.0]]), acts: [{a: 'cover', t0: 73, t1: 78}]},
  {id: 'm2', group: 'mom', look: L('#fdcb6e', '#2d3436', '#2a1d14', 'cap', {hat: '#c0392b'}), show: [73, 78],
    keys: path(Y, [[73, -3.4, -127.0], [77.6, -3.4, -150.0]]), acts: []},
  {id: 'm3', group: 'mom', look: L('#00b894', '#2d3436', '#3a2a1c', 'long'), show: [73, 78],
    keys: path(Y, [[73, 7.0, -143.0], [74.6, 7.0, -143.0], [77.6, -6.0, -146.5]]), acts: []},
  {id: 'm4', group: 'mom', look: L('#636e72', '#2d3436', '#dcdde1', 'bald', {mustache: true}), show: [73, 78],
    keys: path(Y, [[73, -8.0, -148.0], [74.8, -8.0, -154.0], [75.8, -10.6, -158.0]]), acts: []},
  {id: 'm5', group: 'mom', look: L('#e84393', '#2d3436', '#2a1d14', 'bun'), show: [73, 78],
    keys: path(Y, [[73, -7.8, -124.0], [77.6, -7.8, -147.0]]), acts: [{a: 'cover', t0: 73, t1: 78}]},
];

export function npcState(n: NpcDef, t: number): ActorState {
  const s = samplePath(n.keys, t);
  let pose = n.acts.some((a) => a.a === 'sit') ? {...STAND} : gaitPose(gaitPhase(n.keys, t), s.speed);
  let phone: ActorState['phone'] = null;
  let gaze: [number, number] = [0, 0];
  let expr: Expr = t < T.threat ? (n.calm ?? 'neutral') : s.speed > 2 ? 'scared' : 'worried';
  for (const a of n.acts) {
    const w = window01(t, a.t0, a.t1, 0.3);
    if (w <= 0) continue;
    if (a.a === 'phone') {
      pose = blend(pose, PHONE_R, w);
      phone = w > 0.5 ? 'hand' : null;
      gaze = [0, -1];
    } else if (a.a === 'laugh') {
      pose = blend(pose, LAUGH, w);
      pose = add(pose, {lean: 0.12 + Math.sin(t * 14) * 0.08, headPitch: -0.3 + Math.sin(t * 14) * 0.08, rootY: Math.abs(Math.sin(t * 14)) * 0.02}, w);
      expr = 'laugh';
    } else if (a.a === 'cover') {
      pose = blend(pose, COVER_HEAD, w * 0.9);
    } else if (a.a === 'lookup') {
      pose = blend(pose, LOOK_UP, w);
      gaze = [0, 1];
      if (t > T.threat) expr = 'scared';
    } else if (a.a === 'sit') {
      pose = blend(pose, SIT_BENCH, 1);
      pose = add(pose, {headPitch: 0.25 + Math.sin(t * 0.7 + n.id.length) * 0.08, rootY: Math.sin(t * 3 + n.id.length) * 0.006});
      expr = n.id === 's2' ? 'scared' : 'worried';
    } else if (a.a === 'around') {
      pose = add(pose, {headYaw: Math.sin((t - a.t0) * 1.6) * 0.6}, w);
    }
  }
  void ramp;
  const yawExtra = 0;
  const p: Vec3 = s.p;
  return {p, yaw: s.yaw + yawExtra, pose, expr, blink: blinkAt(t, n.id.length + n.id.charCodeAt(0)), gaze, phone, phoneJitter: [0, 0, 0]};
}

export const npcVisible = (n: NpcDef, t: number) => t >= n.show[0] && t <= n.show[1];
