import * as THREE from 'three';
import TL from '../timeline/timeline.json';
import {clamp, easeFn, Ease, lerp, lerp3, noise1, smooth, Vec3} from '../animations/math';
import {headMatrix, phoneMatrix} from '../characters/Blocky';
import {ActorState, heroState, INTERIOR_START, momState} from './hero';

const T = TL.T;

export type SetId = 'city' | 'interior' | 'black';
export interface Cam {
  pos: Vec3;
  look: Vec3;
  fov: number;
  up?: Vec3;
}
export interface Shot {
  id: string;
  t0: number;
  t1: number;
  set: SetId;
  /** what this shot is for (storyboard) */
  note: string;
  cam: (t: number, u: number) => Cam;
  shake?: number;
  /** city without pedestrians */
  empty?: boolean;
  mom?: boolean;
  /** phone close-up: subtitles move lower */
  phone?: boolean;
  hideHero?: boolean;
}

// ---- helpers ------------------------------------------------------------------------------

const rotY = (v: Vec3, yaw: number): Vec3 => {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c];
};
const addV = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

/** local offset in the actor's root frame (+Z = facing direction, +X = actor's left) */
const rel = (a: ActorState, local: Vec3): Vec3 => addV(a.p, rotY(local, a.yaw));

const headPos = (a: ActorState): Vec3 => {
  const m = headMatrix(a.p, a.yaw, a.pose);
  const v = new THREE.Vector3().setFromMatrixPosition(m);
  return [v.x, v.y, v.z];
};
/** offset relative to the head position, oriented by the body yaw (steady close-ups) */
const headRel = (a: ActorState, local: Vec3): Vec3 => addV(headPos(a), rotY(local, a.yaw));

const phoneFrame = (a: ActorState) => {
  const m = phoneMatrix(a.p, a.yaw, a.pose);
  const o = new THREE.Vector3().setFromMatrixPosition(m);
  const x = new THREE.Vector3();
  const y = new THREE.Vector3();
  const z = new THREE.Vector3();
  m.extractBasis(x, y, z);
  const at = (l: Vec3): Vec3 => {
    const v = o.clone().addScaledVector(x, l[0]).addScaledVector(y, l[1]).addScaledVector(z, l[2]);
    return [v.x, v.y, v.z];
  };
  return {center: [o.x, o.y, o.z] as Vec3, at, up: [y.x, y.y, y.z] as Vec3};
};

const kf = (u: number, a: Vec3, b: Vec3, e: Ease = 'inout') => lerp3(a, b, easeFn(e, u));

// smoothed hero look target (avoids jitter from the gait bounce)
// (path positions are already smooth – the gait bounce lives in the pose, not in p)
const heroSmooth = (t: number, yOff = 1.2): Vec3 => {
  void INTERIOR_START;
  const a = heroState(t).p;
  return [a[0], a[1] + yOff, a[2]];
};

// ---- storyboard ----------------------------------------------------------------------------

export const SHOTS: Shot[] = [
  {id: '01_city_open', t0: 0, t1: 3.45, set: 'city', note: 'Crane down over the street, hero walks with phone. Hook title.',
    cam: (t, u) => ({pos: kf(u, [-1.0, 17, 17], [4.3, 2.2, 4.4], 'out'), look: kf(u, [6.0, 1.0, -8], [7.3, 1.5, -3.2], 'out'), fov: lerp(48, 44, u)})},
  {id: '02_walk_front', t0: 3.45, t1: 6.45, set: 'city', note: '"Обычный день" – front tracking, people & cars behind.',
    cam: (t, u) => {
      const h = heroState(t);
      return {pos: rel(h, kf(u, [-0.6, 1.5, 3.1], [-0.35, 1.6, 2.35], 'lin')), look: rel(h, [0, 1.45 + 0.1 * u, 0]), fov: 44};
    }},
  {id: '03_phone_ots', t0: 6.45, t1: 9.85, set: 'city', note: '3/4 front: face lit by the phone; the screen glow turns red.',
    cam: (t, u) => {
      const h = heroState(t);
      const ph = phoneFrame(h);
      const look = lerp3(ph.center, headPos(h), 0.45);
      return {pos: rel(h, kf(u, [-1.25, 1.75, 2.05], [-0.95, 1.7, 1.6])), look, fov: 42};
    }, shake: 0.004},
  {id: '04_phone_alert', phone: true, t0: 9.85, t1: 13.6, set: 'city', note: 'Phone close-up: "УГРОЗА ЯДЕРНОГО УДАРА". Sirens start.',
    cam: (t, u) => {
      const ph = phoneFrame(heroState(t));
      return {pos: ph.at(kf(u, [0.012, -0.02, 0.36], [0.0, -0.02, 0.32])), look: ph.at([0, -0.02, 0]), fov: 55, up: ph.up};
    }, shake: 0.0025},
  {id: '05_face_push', t0: 13.6, t1: 17.05, set: 'city', note: '"У вас осталось 60 секунд" – slow push on the face, timer appears.',
    cam: (t, u) => {
      const h = heroState(t);
      return {pos: headRel(h, kf(u, [0.28, 0.0, 2.35], [0.08, -0.02, 1.55])), look: headRel(h, [0, -0.04, 0]), fov: 40};
    }, shake: 0.006},
  {id: '06a_low_up', t0: 17.05, t1: 18.75, set: 'city', note: '"Первые 10 секунд" – low angle, hero lifts his head.',
    cam: (t, u) => {
      const h = heroState(t);
      return {pos: rel(h, kf(u, [0.95, 0.45, 2.7], [0.8, 0.42, 2.3])), look: rel(h, [0, 1.85, 0]), fov: 55};
    }, shake: 0.006},
  {id: '06b_sky_pov', hideHero: true, t0: 18.75, t1: 20.35, set: 'city', note: '"Вы смотрите на небо" – POV up between buildings, birds, contrail.',
    cam: (t, u) => {
      const h = heroState(t);
      const hp = headPos(h);
      return {pos: addV(hp, [0, 0.05, 0]), look: addV(hp, kf(u, [1.4, 9, -6], [-1.2, 10, -4.5], 'lin')), fov: 72};
    }, shake: 0.012},
  {id: '07_street_react', t0: 20.35, t1: 24.95, set: 'city', note: 'Wide street: people stop, one laughs, one runs across.',
    cam: (t, u) => ({pos: kf(u, [3.9, 1.65, -25.5], [4.1, 1.6, -24.3], 'lin'), look: kf(u, [7.5, 1.2, -9.0], [7.3, 1.2, -9.0], 'lin'), fov: 50}), shake: 0.006},
  {id: '08_realize', t0: 24.95, t1: 29.0, set: 'city', note: '"Это не учебная тревога" – extreme close-up, red siren pulses.',
    cam: (t, u) => {
      const h = heroState(Math.min(t, 28.85));
      return {pos: headRel(h, kf(u, [0.35, 0.02, 2.5], [0.12, 0.0, 1.85])), look: headRel(h, [0, -0.02, 0]), fov: 38};
    }, shake: 0.006},
  {id: '09a_run_rear', t0: 29.0, t1: 30.8, set: 'city', note: '"50 секунд" – hero bolts, rear chase cam.',
    cam: (t, u) => {
      const h = heroState(t);
      const base = {p: heroSmooth(t, 0), yaw: h.yaw} as ActorState;
      return {pos: rel(base, kf(u, [0.75, 1.35, -3.4], [0.55, 1.3, -2.7])), look: rel(base, [0, 1.15, 3.5]), fov: 56};
    }, shake: 0.03},
  {id: '09b_feet', t0: 30.8, t1: 32.45, set: 'city', note: '"Ваше сердце колотится" – close-up of running feet.',
    cam: (t, u) => {
      const h = heroState(t);
      const base = {p: heroSmooth(t, 0), yaw: h.yaw} as ActorState;
      return {pos: rel(base, kf(u, [1.35, 0.32, 0.9], [1.25, 0.36, 0.3], 'lin')), look: rel(base, [0, 0.38, 0.1]), fov: 52};
    }, shake: 0.02},
  {id: '10_run_side', t0: 32.45, t1: 37.7, set: 'city', note: '"Хотите позвонить близким" – side tracking, phone while running.',
    cam: (t, u) => {
      const h = heroState(t);
      const base = {p: heroSmooth(t, 0), yaw: h.yaw} as ActorState;
      return {pos: rel(base, kf(u, [3.2, 1.5, 0.5], [3.0, 1.4, -0.2], 'lin')), look: rel(base, [0, 1.2, 0.15]), fov: 46};
    }, shake: 0.022},
  {id: '11_run_front', t0: 37.7, t1: 41.9, set: 'city', note: '"Вы ищете укрытие. 40 секунд" – front, hero scans around.',
    cam: (t, u) => {
      const h = heroState(t);
      const base = {p: heroSmooth(t, 0), yaw: h.yaw} as ActorState;
      return {pos: rel(base, kf(u, [-0.55, 1.6, 3.7], [-0.4, 1.55, 3.0], 'lin')), look: rel(base, [0, 1.35, 0]), fov: 56};
    }, shake: 0.03},
  {id: '12_see_building', t0: 41.9, t1: 43.25, set: 'city', note: '"Впереди здание" – over the shoulder towards the shelter.',
    cam: (t) => {
      const h = heroState(t);
      const base = {p: heroSmooth(t, 0), yaw: h.yaw} as ActorState;
      return {pos: rel(base, [-0.75, 2.15, -1.9]), look: [9.4, 2.0, -86.6], fov: 54};
    }, shake: 0.03},
  {id: '13_enter_door', t0: 43.25, t1: 44.45, set: 'city', note: '"Вы забегаете внутрь" – hero dives through the shelter door.',
    cam: (t, u) => ({pos: kf(u, [5.9, 1.55, -91.2], [6.4, 1.5, -90.4], 'lin'), look: kf(u, [8.6, 1.4, -86.0], [9.5, 1.4, -86.5], 'lin'), fov: 50}), shake: 0.012},
  {id: '14_corridor', t0: 44.45, t1: 47.95, set: 'interior', note: '"Подальше от окон и наружных стен" – corridor, bright windows.',
    cam: (t, u) => {
      const h = heroState(t);
      const base = {p: heroSmooth(t, 0), yaw: h.yaw} as ActorState;
      return {pos: rel(base, kf(u, [-0.55, 1.6, 3.3], [-0.5, 1.55, 2.8], 'lin')), look: rel(base, [0.1, 1.3, 0]), fov: 60};
    }, shake: 0.025},
  {id: '15_stairs', t0: 47.95, t1: 49.8, set: 'interior', note: '"30 секунд" – high angle down the stairwell.',
    cam: (t, u) => ({pos: kf(u, [-0.7, 2.5, -14.0], [-0.6, 2.3, -14.6], 'lin'), look: heroSmooth(t, 0.9), fov: 58}), shake: 0.008},
  {id: '16_basement', t0: 49.8, t1: 52.3, set: 'interior', note: 'Basement shelter, phone buzzes, hero pulls it out.',
    cam: (t, u) => ({pos: kf(u, [-1.3, -1.95, -32.2], [-0.8, -2.05, -31.3]), look: kf(u, [2.2, -2.3, -27.2], [2.5, -2.2, -27.6]), fov: 50}), shake: 0.006},
  {id: '17_message', phone: true, t0: 52.3, t1: 53.7, set: 'interior', note: '"Ты в порядке?" – phone close-up, message from Mom.',
    cam: (t, u) => {
      const ph = phoneFrame(heroState(t));
      return {pos: ph.at(kf(u, [0.012, -0.02, 0.36], [0.0, -0.02, 0.32])), look: ph.at([0, -0.02, 0]), fov: 55, up: ph.up};
    }, shake: 0.003},
  {id: '18_typing', phone: true, t0: 53.7, t1: 57.65, set: 'interior', note: '"Руки дрожат" – hands typing, shaking phone.',
    cam: (t, u) => {
      const ph = phoneFrame(heroState(t));
      return {pos: ph.at(kf(u, [0.0, -0.05, 0.4], [0.0, -0.045, 0.35])), look: ph.at([0, -0.045, 0]), fov: 58, up: ph.up};
    }, shake: 0.004},
  {id: '19_shelter_face', t0: 57.65, t1: 59.35, set: 'interior', note: '"20 секунд" – face lit by the phone, lamp flickers.',
    cam: (t, u) => {
      const h = heroState(t);
      return {pos: headRel(h, kf(u, [0.75, -0.18, 2.2], [0.55, -0.14, 1.8])), look: headRel(h, [0, -0.12, 0]), fov: 42};
    }, shake: 0.006},
  {id: '20_empty_city', t0: 59.35, t1: 63.3, set: 'city', empty: true, note: '"Город словно перестал дышать" – empty street, stopped cars.',
    cam: (t, u) => ({pos: kf(u, [-2.2, 1.6, -34.0], [-1.3, 5.2, -40.0]), look: kf(u, [2.5, 3.0, -110], [2.0, 2.0, -110]), fov: 50}), shake: 0.004},
  {id: '21_sit_down', t0: 63.3, t1: 65.9, set: 'interior', note: '"Вы опускаетесь на пол" – slides down the wall.',
    cam: (t, u) => ({pos: kf(u, [0.7, -2.15, -30.0], [1.2, -2.45, -29.5]), look: kf(u, [3.4, -2.5, -27.6], [3.6, -2.9, -27.6]), fov: 46}), shake: 0.005},
  {id: '22_countdown', t0: 65.9, t1: 70.0, set: 'interior', note: '"10… 9… 8…" – close-up push, heartbeat.',
    cam: (t, u) => {
      const h = heroState(t);
      return {pos: headRel(h, kf(u, [0.18, 0.02, 2.7], [0.06, 0.0, 2.05], 'lin')), look: headRel(h, [0, -0.02, 0]), fov: 38};
    }, shake: 0.004},
  {id: '23_eyes_close', t0: 70.0, t1: 74.3, set: 'interior', note: '"Вы закрываете глаза" – extreme close-up, very slow push.',
    cam: (t, u) => {
      const h = heroState(t);
      return {pos: headRel(h, kf(u, [0.0, 0.02, 2.0], [0.0, 0.01, 1.6], 'lin')), look: headRel(h, [0, 0.0, 0]), fov: 36};
    }, shake: 0.003},
  {id: '24_mom', t0: 74.3, t1: 77.2, set: 'city', mom: true, note: '"Успеют ли ваши близкие…" – Mom running with the crowd.',
    cam: (t, u) => {
      const m = momState(t);
      const base = {p: [m.p[0], 0.15, m.p[2]] as Vec3, yaw: Math.PI} as ActorState;
      return {pos: rel(base, kf(u, [-0.6, 1.6, 3.4], [-0.45, 1.55, 2.8], 'lin')), look: rel(base, [0, 1.4, 0]), fov: 50};
    }, shake: 0.025},
  {id: '25_last_frames', t0: 77.2, t1: T.blackout, set: 'interior', note: 'Back to the closed eyes – light surges, cut to black.',
    cam: (t, u) => {
      const h = heroState(t);
      return {pos: headRel(h, kf(u, [0.0, 0.01, 1.6], [0.0, 0.01, 1.5], 'lin')), look: headRel(h, [0, 0, 0]), fov: 36};
    }, shake: 0.02},
  {id: '26_black', t0: T.blackout, t1: TL.duration + 1, set: 'black', note: 'Silence, black. "А ЧТО БЫ СДЕЛАЛ ТЫ?"',
    cam: () => ({pos: [0, 0, 0], look: [0, 0, -1], fov: 40})},
];

export const shotAt = (t: number) => SHOTS.find((s) => t >= s.t0 && t < s.t1) ?? SHOTS[SHOTS.length - 1];

export function cameraAt(t: number): {cam: Cam; shot: Shot} {
  const shot = shotAt(t);
  const u = clamp((t - shot.t0) / (shot.t1 - shot.t0));
  const cam = shot.cam(t, u);
  const a = shot.shake ?? 0;
  if (a > 0) {
    // handheld: low-frequency drift + footstep-rate jitter for running shots
    const f = a > 0.015 ? 2.2 : 0.6;
    cam.pos = [cam.pos[0] + noise1(t * f, 1) * a, cam.pos[1] + noise1(t * f * 1.3, 2) * a, cam.pos[2] + noise1(t * f, 3) * a];
    cam.look = [cam.look[0] + noise1(t * f * 0.8, 4) * a * 1.5, cam.look[1] + noise1(t * f, 5) * a * 1.5, cam.look[2] + noise1(t * f * 0.9, 6) * a * 1.5];
  }
  return {cam, shot};
}
