import {clamp, Key, lerp, samplePath, smooth} from './math';

/**
 * Flat pose record (radians / metres). Character local axes: +Z = front, +X = character's left.
 * Arms: Sx = forward swing, Sz = outward (abduction), El = elbow bend (forearm forward).
 * Legs: Hip = thigh forward, Knee = shin bend backwards.
 */
export interface Pose {
  hipY: number;
  rootY: number;
  lean: number;
  torsoYaw: number;
  torsoRoll: number;
  headYaw: number;
  headPitch: number;
  headRoll: number;
  lSx: number;
  lSz: number;
  lEl: number;
  rSx: number;
  rSz: number;
  rEl: number;
  lHip: number;
  lKnee: number;
  rHip: number;
  rKnee: number;
  lHipZ: number;
  rHipZ: number;
}

export const STAND: Pose = {
  hipY: 0.9, rootY: 0, lean: 0, torsoYaw: 0, torsoRoll: 0, headYaw: 0, headPitch: 0, headRoll: 0,
  lSx: 0, lSz: 0.06, lEl: 0.12, rSx: 0, rSz: 0.06, rEl: 0.12,
  lHip: 0, lKnee: 0, rHip: 0, rKnee: 0, lHipZ: 0, rHipZ: 0,
};

export const blend = (a: Pose, b: Partial<Pose>, w: number): Pose => {
  if (w <= 0) return a;
  const out = {...a};
  for (const k of Object.keys(b) as (keyof Pose)[]) {
    out[k] = lerp(a[k], b[k] as number, clamp(w));
  }
  return out;
};

export const add = (a: Pose, b: Partial<Pose>, w = 1): Pose => {
  const out = {...a};
  for (const k of Object.keys(b) as (keyof Pose)[]) out[k] = a[k] + (b[k] as number) * w;
  return out;
};

// ---- gait -------------------------------------------------------------------------------

export const runBlendFromSpeed = (speed: number) => smooth((speed - 2.0) / 1.6);
const cycleLen = (speed: number) => lerp(1.45, 3.1, runBlendFromSpeed(speed));

const phaseCache = new WeakMap<Key[], Float32Array>();
const PH_DT = 1 / 120;
/** Integrated gait phase (radians) so stride frequency changes smoothly with speed. */
export function gaitPhase(keys: Key[], t: number): number {
  let table = phaseCache.get(keys);
  const t0 = keys[0].t;
  if (!table) {
    const t1 = keys[keys.length - 1].t + 1;
    const n = Math.ceil((t1 - t0) / PH_DT) + 2;
    table = new Float32Array(n);
    let ph = 0;
    let prev = samplePath(keys, t0).dist;
    for (let i = 1; i < n; i++) {
      const s = samplePath(keys, t0 + i * PH_DT);
      const d = s.dist - prev;
      prev = s.dist;
      ph += (d / cycleLen(s.speed)) * Math.PI * 2;
      table[i] = ph;
    }
    phaseCache.set(keys, table);
  }
  const x = (t - t0) / PH_DT;
  if (x <= 0) return 0;
  const i = Math.min(table.length - 2, Math.floor(x));
  return lerp(table[i], table[i + 1], Math.min(1, x - i));
}

export function gaitPose(phase: number, speed: number): Pose {
  const moving = smooth(speed / 0.5);
  const r = runBlendFromSpeed(speed);
  const legAmp = lerp(0.42, 0.85, r) * moving;
  const kneeAmp = lerp(0.6, 1.55, r) * moving;
  const armAmp = lerp(0.38, 0.95, r) * moving;
  const s = Math.sin(phase);
  const c = Math.cos(phase);
  const bounce = lerp(0.035, 0.09, r) * moving;
  return {
    ...STAND,
    rootY: bounce * (Math.abs(c) - 0.5),
    lean: lerp(0.03, 0.24, r) * moving,
    torsoYaw: 0.06 * s * moving,
    headPitch: -lerp(0, 0.12, r) * moving,
    lHip: legAmp * s,
    rHip: -legAmp * s,
    lKnee: 0.08 * moving + kneeAmp * Math.max(0, c) * 0.9 + (r * 0.25 * moving),
    rKnee: 0.08 * moving + kneeAmp * Math.max(0, -c) * 0.9 + (r * 0.25 * moving),
    lSx: -armAmp * s,
    rSx: armAmp * s,
    lSz: 0.08 + 0.05 * r,
    rSz: 0.08 + 0.05 * r,
    lEl: lerp(0.15, 1.45, r * moving) + 0.15 * moving,
    rEl: lerp(0.15, 1.45, r * moving) + 0.15 * moving,
  };
}

// ---- upper-body / full-body overlays ----------------------------------------------------

/** Right hand holds the phone in front of the chest (phone is parented to torso). */
export const PHONE_R: Partial<Pose> = {rSx: 0.62, rSz: -0.62, rEl: 1.05, headPitch: 0.42};
/** Both hands on the phone (typing). */
export const PHONE_2: Partial<Pose> = {rSx: 0.62, rSz: -0.72, rEl: 1.05, lSx: 0.62, lSz: -1.05, lEl: 1.08, headPitch: 0.45};
/** Laughing: hands on belly. */
export const LAUGH: Partial<Pose> = {lSx: 0.35, lSz: -0.25, lEl: 1.6, rSx: 0.35, rSz: -0.25, rEl: 1.6};
/** Hands on head while running (panic). */
export const COVER_HEAD: Partial<Pose> = {lSx: 2.5, lSz: 0.5, lEl: 2.0, rSx: 2.5, rSz: 0.5, rEl: 2.0};
export const LOOK_UP: Partial<Pose> = {headPitch: -0.72, lean: -0.08};
export const SQUAT: Partial<Pose> = {hipY: 0.42, lean: 0.35, lHip: 1.45, rHip: 1.45, lKnee: 2.45, rKnee: 2.45, lSx: 0.9, rSx: 0.9, lEl: 0.6, rEl: 0.6, rootY: 0};
/** Sitting on the floor, back to the wall, hugging the knees. */
export const SIT_HUG: Partial<Pose> = {
  hipY: 0.24, rootY: 0, lean: 0.12, torsoYaw: 0, lHip: 1.62, rHip: 1.62, lKnee: 2.55, rKnee: 2.55,
  lHipZ: 0.08, rHipZ: 0.08,
  lSx: 1.05, lSz: -0.12, lEl: 1.0, rSx: 1.05, rSz: -0.12, rEl: 1.0, headPitch: 0.1,
};
/** Sitting on a bench (for shelter NPCs). */
export const SIT_BENCH: Partial<Pose> = {
  hipY: 0.5, rootY: 0, lean: 0.1, lHip: 1.5, rHip: 1.5, lKnee: 1.5, rKnee: 1.5,
  lSx: 0.5, rSx: 0.5, lEl: 0.9, rEl: 0.9, lSz: -0.05, rSz: -0.05,
};
