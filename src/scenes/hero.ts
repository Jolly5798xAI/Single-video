import TL from '../timeline/timeline.json';
import {Key, noise1, ramp, samplePath, Vec3, window01} from '../animations/math';
import {add, blend, COVER_HEAD, gaitPhase, gaitPose, LOOK_UP, PHONE_2, PHONE_R, Pose, SIT_HUG, SQUAT} from '../animations/pose';
import {Expr, Look} from '../characters/Blocky';

const T = TL.T;
export const HERO_CITY = TL.heroCity as Key[];
export const HERO_INT = TL.heroInterior as Key[];
export const INTERIOR_START = HERO_INT[0].t;

export const HERO_LOOK: Look = {
  shirt: '#a8262b', stripe: '#f2f2f2', pants: '#22242a', shoes: '#f1f1f1', skin: '#f0c39b', hair: '#3b2a1e', hairStyle: 'short',
};
export const MOM_LOOK: Look = {
  shirt: '#c45a8a', pants: '#3b3f58', shoes: '#4a3022', skin: '#efc3a2', hair: '#c9a36a', hairStyle: 'bun', bag: '#6b3f2a',
};

export interface ActorState {
  p: Vec3;
  yaw: number;
  pose: Pose;
  expr: Expr;
  blink: number;
  gaze: [number, number];
  phone: 'torso' | 'hand' | null;
  phoneJitter: Vec3;
}

export const blinkAt = (t: number, seed = 0) => {
  const period = 3.4 + (seed % 3) * 0.5;
  const x = (t + seed * 1.37) % period;
  return x < 0.13 ? 1 : 0;
};

export function heroState(t: number): ActorState {
  const interior = t >= INTERIOR_START;
  const keys = interior ? HERO_INT : HERO_CITY;
  const s = samplePath(keys, t);
  const phase = gaitPhase(keys, t);
  let pose = gaitPose(phase, s.speed);
  let expr: Expr = 'neutral';
  let gaze: [number, number] = [0, 0];
  let phone: ActorState['phone'] = null;
  let jitter: Vec3 = [0, 0, 0];

  if (!interior) {
    // --- phone in hand, looking at it (0 → 14.3) ---
    const phoneW = 1 - ramp(t, 13.8, 14.3);
    if (phoneW > 0.01) {
      pose = blend(pose, PHONE_R, phoneW);
      phone = phoneW > 0.5 ? 'torso' : 'hand';
      gaze = [0, -1];
    } else if (t < 33.0) phone = 'hand';
    // jerk of surprise when the screen turns red
    pose = add(pose, {headPitch: -0.12, lean: -0.05}, window01(t, T.screenRed + 0.15, T.screenRed + 0.7, 0.15));
    if (t < T.screenRed + 0.2) expr = t < 2 ? 'neutral' : 'smile';
    else if (t < T.threat + 3.7) expr = 'surprised';
    else if (t < T.sixty) expr = 'worried';
    else expr = 'scared';

    // lowering phone, looking ahead (14.3 → 17.2)
    if (t > 14.0 && t < 17.3) pose = add(pose, {headPitch: -0.05}, ramp(t, 14.0, 14.6));
    // look at the sky
    const sky = window01(t, T.first10 + 0.25, 20.3, 0.45);
    pose = blend(pose, LOOK_UP, sky);
    if (sky > 0.3) gaze = [0, 1];
    // look around at people
    const around = window01(t, 20.5, 24.9, 0.35);
    pose = add(pose, {headYaw: Math.sin((t - 20.5) * 1.25) * 0.65, torsoYaw: Math.sin((t - 20.5) * 1.25) * 0.15}, around);
    if (around > 0.2) gaze = [Math.sin((t - 20.5) * 1.25) > 0 ? 1 : -1, 0];
    // panting / breathing before running
    pose = add(pose, {rootY: Math.sin(t * 5) * 0.012, lean: 0.03}, window01(t, 24.9, 28.9, 0.3));
    // turning head toward the street before the run
    pose = add(pose, {headYaw: -0.35}, window01(t, 27.2, 28.7, 0.3));
    // phone while running ("хотите позвонить близким")
    const callW = window01(t, T.wantCall + 0.3, T.everySecond + 1.0, 0.35) * 0.85;
    if (callW > 0.01) {
      pose = blend(pose, PHONE_R, callW);
      phone = callW > 0.42 ? 'torso' : 'hand';
      gaze = [0, -1];
    } else if (t > 33.0 && t < T.everySecond + 1.6) phone = 'hand';
    // scanning for shelter
    const scan = window01(t, 38.0, 41.6, 0.3);
    pose = add(pose, {headYaw: Math.sin((t - 38.0) * 2.3) * 0.6}, scan);
    if (scan > 0.2) gaze = [Math.sin((t - 38.0) * 2.3) > 0 ? 1 : -1, 0];
    // pointing gaze at the building
    pose = add(pose, {headYaw: -0.3}, window01(t, 41.9, 43.0, 0.2));
  } else {
    expr = 'scared';
    // glance at the windows ("подальше от окон")
    pose = add(pose, {headYaw: 0.55}, window01(t, 44.9, 45.9, 0.25));
    // phone buzz → take it out
    const ph = ramp(t, 50.1, 50.7);
    const typing = window01(t, T.startTyping + 0.1, 57.7, 0.3);
    const sitStart = 63.55;
    const sit = ramp(t, sitStart, sitStart + 0.6);
    const sit2 = ramp(t, sitStart + 0.6, sitStart + 1.25);
    const holdW = ph * (1 - sit);
    if (holdW > 0.01) {
      pose = blend(pose, PHONE_R, holdW);
      phone = holdW > 0.5 ? 'torso' : 'hand';
      gaze = [0, -1];
    } else if (t > 49.6) phone = 'hand';
    if (typing > 0) pose = blend(pose, PHONE_2, typing * (1 - sit));
    if (t > T.areYouOk - 0.3) expr = 'worried';
    if (t > T.twenty) expr = 'scared';
    if (t > T.sitDown) expr = 'sad';
    // trembling hands / body from the message onwards
    const tremble = ramp(t, T.handsShake - 0.4, T.handsShake + 0.4) * (t < 77.5 ? 1 : 0);
    if (tremble > 0) {
      jitter = [noise1(t * 9, 1) * 0.06 * tremble, noise1(t * 11, 2) * 0.05 * tremble, noise1(t * 13, 3) * 0.03 * tremble];
      pose = add(pose, {rEl: noise1(t * 10, 4) * 0.08, lEl: noise1(t * 10, 5) * 0.08, headRoll: noise1(t * 3, 6) * 0.03}, tremble);
    }
    // slide down the wall
    if (sit > 0) {
      pose = blend(pose, SQUAT, sit);
      pose = blend(pose, SIT_HUG, sit2);
    }
    // breathing
    pose = add(pose, {rootY: Math.sin(t * 4.2) * 0.008, lean: Math.sin(t * 4.2) * 0.015}, 1);
    // countdown: look up toward the ceiling on each number, then close eyes
    if (t > T.ten - 0.2) {
      gaze = [0, 0.3];
      pose = add(pose, {headPitch: -0.12}, window01(t, T.ten, T.closeEyes, 0.3));
    }
    if (t > T.closeEyes + 0.35) {
      expr = 'closed';
      pose = add(pose, {headPitch: 0.12, headRoll: 0.04}, ramp(t, T.closeEyes + 0.3, T.closeEyes + 2.0));
    }
  }
  void COVER_HEAD;
  const blink = expr === 'closed' ? 1 : blinkAt(t, 1) || (interior && t > T.closeEyes && t < T.closeEyes + 0.35 ? ramp(t, T.closeEyes, T.closeEyes + 0.3) : 0);
  return {p: s.p, yaw: s.yaw, pose, expr, blink, gaze, phone, phoneJitter: jitter};
}

// ---------------------------------------------------------------------------------------------
// Mom (imagined, near the metro entrance): runs along the left sidewalk towards -Z.
export const MOM_KEYS: Key[] = [
  {t: 73.0, p: [-7.0, 0.15, -132], yaw: Math.PI},
  {t: 74.0, p: [-7.0, 0.15, -136.5], yaw: Math.PI, e: 'in'},
  {t: 77.6, p: [-7.2, 0.15, -153.0], yaw: Math.PI},
];

export function momState(t: number): ActorState {
  const s = samplePath(MOM_KEYS, t);
  let pose = gaitPose(gaitPhase(MOM_KEYS, t), s.speed);
  pose = add(pose, {headYaw: Math.sin(t * 2.1) * 0.35}, window01(t, 74.6, 76.4, 0.3));
  return {p: s.p, yaw: s.yaw, pose, expr: 'scared', blink: blinkAt(t, 4), gaze: [0, 0], phone: 'hand', phoneJitter: [0, 0, 0]};
}
