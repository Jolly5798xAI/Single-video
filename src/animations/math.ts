// Deterministic animation helpers. Everything is a pure function of time,
// so Remotion can render any frame in any order (multi-tab rendering).

export type Vec3 = [number, number, number];
export type Ease = 'lin' | 'in' | 'out' | 'inout';

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
export const lerp3 = (a: Vec3, b: Vec3, u: number): Vec3 => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];
export const smooth = (u: number) => {
  const x = clamp(u);
  return x * x * (3 - 2 * x);
};
export const easeFn = (e: Ease, u: number) => {
  const x = clamp(u);
  switch (e) {
    case 'in':
      return x * x;
    case 'out':
      return 1 - (1 - x) * (1 - x);
    case 'inout':
      return smooth(x);
    default:
      return x;
  }
};
/** 0 before a, 1 after b, smooth in between. */
export const ramp = (t: number, a: number, b: number) => smooth((t - a) / (b - a));
/** 1 inside [a,b] with fade of length f at both ends. */
export const window01 = (t: number, a: number, b: number, f = 0.25) =>
  Math.min(ramp(t, a - f, a), 1 - ramp(t, b, b + f));

/** Smooth pseudo-noise in [-1,1] (sum of incommensurate sines). */
export const noise1 = (t: number, seed = 0) =>
  (Math.sin(t * 1.7 + seed * 12.9) * 0.5 +
    Math.sin(t * 3.13 + seed * 4.1) * 0.3 +
    Math.sin(t * 5.71 + seed * 7.7) * 0.2);

/** Seeded RNG (mulberry32) for procedural city layout. */
export const rng = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export interface Key {
  t: number;
  p: Vec3;
  yaw: number;
  e?: Ease;
}

export interface PathSample {
  p: Vec3;
  yaw: number;
  /** distance travelled along the path (for gait phase) */
  dist: number;
  /** horizontal speed m/s */
  speed: number;
  active: boolean;
}

const segLen = (a: Vec3, b: Vec3) => Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);

function rawSample(keys: Key[], t: number) {
  if (t <= keys[0].t) return {p: keys[0].p, yaw: keys[0].yaw, dist: 0};
  let dist = 0;
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1];
    const b = keys[i];
    const L = segLen(a.p, b.p);
    if (t <= b.t) {
      const u = easeFn(b.e ?? 'lin', (t - a.t) / (b.t - a.t));
      const yu = smooth((t - a.t) / (b.t - a.t));
      return {p: lerp3(a.p, b.p, u), yaw: lerp(a.yaw, b.yaw, yu), dist: dist + L * u};
    }
    dist += L;
  }
  const last = keys[keys.length - 1];
  return {p: last.p, yaw: last.yaw, dist};
}

export function samplePath(keys: Key[], t: number): PathSample {
  const s = rawSample(keys, t);
  const dt = 1 / 60;
  const a = rawSample(keys, t - dt);
  const b = rawSample(keys, t + dt);
  const speed = Math.abs(b.dist - a.dist) / (2 * dt);
  return {...s, speed, active: t >= keys[0].t - 1e-6 && t <= keys[keys.length - 1].t + 1e9};
}

/** piecewise-linear lookup in [[t, v], ...] */
export const pl = (keys: number[][], t: number) => {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) {
      const [t0, v0] = keys[i - 1];
      const [t1, v1] = keys[i];
      return lerp(v0, v1, (t - t0) / (t1 - t0));
    }
  }
  return keys[keys.length - 1][1];
};
