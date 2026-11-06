import * as THREE from 'three';
import React, {useMemo} from 'react';
import {BOX, CONE4, CYL6, mat, unlit} from '../components/materials';
import {clockTexture, shelterSignTexture, signTexture} from '../components/textures';
import {rng, Vec3} from '../animations/math';
import {B, Bench, Car, CarDef, Cloud, Pigeon, StreetLamp, TrafficLight, Tree, TrashBin} from './props';
import TL from '../timeline/timeline.json';

const T = TL.T;

// ------------------------------------------------------------------------------------------
// Layout constants. Street runs along Z; the hero walks/runs towards -Z on the right sidewalk.
// Road x∈[-5,5], sidewalks x∈[±5, ±9.5], building façades at x=±9.5.
// ------------------------------------------------------------------------------------------
export const Z_MAX = 70;
export const Z_MIN = -280;
export const FACADE = 9.5;
export const SHELTER = {z0: -78.6, z1: -95.0, doorZ: -86.6, doorW: 2.1, doorH: 2.5};
export const METRO = {z: -158};

const PALETTE = ['#d9b25a', '#e2c27a', '#c98f6b', '#b9c9d6', '#e3d3b4', '#c7a7a0', '#a9b98f', '#d8a65b', '#cfc7b8'];
const SIGNS_R = [
  ['ПРОДУКТЫ', '#2e7d4f'], ['КАФЕ', '#7a4a2b'], ['ЦВЕТЫ', '#c2457a'], ['ХЛЕБ', '#d9822b'], ['КНИГИ', '#2b5c9e'],
  ['ОПТИКА', '#3b3f8f'], ['ПЕКАРНЯ', '#a8432b'], ['БАНК', '#1f6e6e'], ['ОБУВЬ', '#5c3b8f'],
];
const SIGNS_L = [
  ['КОФЕ', '#4a2f22'], ['МАРКЕТ', '#c0392b'], ['ПИЦЦА', '#d35400'], ['ЧАСЫ', '#34495e'], ['СУВЕНИРЫ', '#8e44ad'],
  ['ЦИРЮЛЬНЯ', '#2c3e50'], ['ИГРУШКИ', '#16a085'], ['ТКАНИ', '#9b6a2f'], ['ПОЧТА', '#2b5c9e'],
];

interface Bld {
  side: 1 | -1;
  z0: number;
  z1: number;
  h: number;
  d: number;
  color: string;
  sign?: [string, string];
  awning?: string;
  kind: 'normal' | 'shelter' | 'metro';
}

function layout(): Bld[] {
  const r = rng(7);
  const out: Bld[] = [];
  for (const side of [1, -1] as const) {
    let z = Z_MAX;
    let si = 0;
    while (z > Z_MIN) {
      if (side === 1 && z > SHELTER.z0 && z - 22 < SHELTER.z0) {
        // fill up to shelter start
        const w = z - SHELTER.z0;
        if (w > 4) out.push({side, z0: z, z1: SHELTER.z0, h: 14 + r() * 10, d: 14, color: PALETTE[Math.floor(r() * PALETTE.length)], kind: 'normal', sign: SIGNS_R[si++ % SIGNS_R.length] as [string, string]});
        out.push({side, z0: SHELTER.z0, z1: SHELTER.z1, h: 17, d: 20, color: '#9c9e9b', kind: 'shelter'});
        z = SHELTER.z1;
        continue;
      }
      if (side === -1 && z > METRO.z + 9 && z - 22 < METRO.z + 9) {
        const w = z - (METRO.z + 9);
        if (w > 4) out.push({side, z0: z, z1: METRO.z + 9, h: 14 + r() * 10, d: 14, color: PALETTE[Math.floor(r() * PALETTE.length)], kind: 'normal', sign: SIGNS_L[si++ % SIGNS_L.length] as [string, string]});
        out.push({side, z0: METRO.z + 9, z1: METRO.z - 9, h: 20, d: 16, color: '#cfc6b0', kind: 'metro'});
        z = METRO.z - 9;
        continue;
      }
      const w = 13 + Math.floor(r() * 10);
      const gap = r() < 0.18 ? 3.5 : 0;
      const signs = side === 1 ? SIGNS_R : SIGNS_L;
      out.push({
        side, z0: z, z1: z - w, h: 12 + Math.floor(r() * 6) * 3.2, d: 12 + r() * 6,
        color: PALETTE[Math.floor(r() * PALETTE.length)],
        sign: r() < 0.8 ? (signs[si++ % signs.length] as [string, string]) : undefined,
        awning: r() < 0.45 ? (r() < 0.5 ? '#2e7d4f' : '#a8322d') : undefined,
        kind: 'normal',
      });
      z -= w + gap;
    }
  }
  return out;
}

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpS = new THREE.Vector3();
const tmpP = new THREE.Vector3();

function useWindows(blds: Bld[]) {
  return useMemo(() => {
    const frames: THREE.Matrix4[] = [];
    const glass: THREE.Matrix4[] = [];
    const sills: THREE.Matrix4[] = [];
    for (const b of blds) {
      const w = b.z0 - b.z1;
      const narrow = b.kind === 'shelter';
      const colStep = narrow ? 3.4 : 2.7;
      const cols = Math.floor((w - 1.6) / colStep);
      const startZ = b.z0 - (w - (cols - 1) * colStep) / 2;
      const firstY = b.kind === 'shelter' ? 5.6 : 5.4;
      for (let y = firstY; y < b.h - 1.6; y += 3.2) {
        for (let c = 0; c < cols; c++) {
          const z = startZ - c * colStep;
          if (b.kind === 'shelter' && Math.abs(z - SHELTER.doorZ) < 1.5 && y < 6) continue;
          const x = b.side * (FACADE - 0.02);
          const fw = narrow ? 1.0 : 1.35;
          const fh = narrow ? 1.2 : 1.75;
          tmpP.set(x, y, z);
          tmpS.set(0.12, fh, fw);
          frames.push(tmpM.compose(tmpP, tmpQ, tmpS).clone());
          tmpP.set(b.side * (FACADE - 0.05), y + 0.02, z);
          tmpS.set(0.1, fh - 0.22, fw - 0.22);
          glass.push(tmpM.compose(tmpP, tmpQ, tmpS).clone());
          tmpP.set(b.side * (FACADE - 0.1), y - fh / 2 - 0.05, z);
          tmpS.set(0.22, 0.08, fw + 0.15);
          sills.push(tmpM.compose(tmpP, tmpQ, tmpS).clone());
        }
      }
    }
    const mk = (list: THREE.Matrix4[], m: THREE.Material) => {
      const im = new THREE.InstancedMesh(BOX, m, list.length);
      list.forEach((mm, i) => im.setMatrixAt(i, mm));
      im.instanceMatrix.needsUpdate = true;
      im.frustumCulled = false;
      return im;
    };
    return [
      mk(frames, mat('#f4f1e8')),
      mk(glass, mat('#2f4561', {rough: 0.35})),
      mk(sills, mat('#e9e4d6')),
    ];
  }, [blds]);
}

function tileTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#c2c5c9';
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#b3b6bb';
  g.fillRect(64, 0, 64, 64);
  g.fillRect(0, 64, 64, 64);
  g.strokeStyle = '#a2a5aa';
  g.lineWidth = 3;
  g.strokeRect(0, 0, 128, 128);
  g.beginPath();
  g.moveTo(64, 0);
  g.lineTo(64, 128);
  g.moveTo(0, 64);
  g.lineTo(128, 64);
  g.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.repeat.set(4.5 / 1.6, (Z_MAX - Z_MIN) / 1.6);
  return tex;
}

const Building: React.FC<{b: Bld}> = ({b}) => {
  const w = b.z0 - b.z1;
  const zc = (b.z0 + b.z1) / 2;
  const xc = b.side * (FACADE + b.d / 2);
  const face = b.side * (FACADE - 0.06);
  const signTex = b.sign ? signTexture(b.sign[0], b.sign[1]) : null;
  const signW = Math.min(w * 0.55, 7);
  return (
    <group>
      <B p={[xc, b.h / 2, zc]} s={[b.d, b.h, w]} c={b.color} cast recv />
      <B p={[xc - b.side * 0.1, b.h + 0.3, zc]} s={[b.d + 0.4, 0.6, w + 0.2]} c="#8d7f6c" cast />
      <B p={[b.side * (FACADE - 0.04), 4.0, zc]} s={[0.12, 0.25, w]} c="#efe9da" />
      {b.kind === 'normal' ? (
        <>
          {/* ground-floor shop windows */}
          <B p={[face, 1.7, zc]} s={[0.1, 2.6, w * 0.82]} c="#24384d" />
          <B p={[b.side * (FACADE - 0.09), 1.6, zc - w * 0.25]} s={[0.06, 2.3, 1.3]} c="#5b3a26" />
          {[-0.3, 0.0, 0.3].map((k) => (
            <B key={k} p={[b.side * (FACADE - 0.1), 1.7, zc + k * w * 0.82]} s={[0.06, 2.6, 0.12]} c="#e8e2d2" />
          ))}
          {signTex ? (
            <mesh position={[b.side * (FACADE - 0.16), 3.45, zc + w * 0.08]} rotation={[0, -b.side * Math.PI / 2, 0]}>
              <planeGeometry args={[signW, signW / 4]} />
              <meshStandardMaterial map={signTex} emissive="#ffffff" emissiveMap={signTex} emissiveIntensity={0.25} roughness={0.8} />
            </mesh>
          ) : null}
          {signTex ? <B p={[b.side * (FACADE - 0.1), 3.45, zc + w * 0.08]} s={[0.1, signW / 4 + 0.16, signW + 0.16]} c="#1f1f1f" /> : null}
          {b.awning ? (
            <B p={[b.side * (FACADE - 0.7), 3.0, zc - w * 0.25]} s={[1.4, 0.12, 3.6]} r={[0, 0, b.side * 0.35]} c={b.awning} cast />
          ) : null}
        </>
      ) : null}
    </group>
  );
};

const Shelter: React.FC = () => {
  const x = FACADE;
  const z = SHELTER.doorZ;
  const sign = shelterSignTexture();
  return (
    <group>
      {/* massive concrete base, canopy, steps */}
      <B p={[x + 0.3, 1.2, (SHELTER.z0 + SHELTER.z1) / 2]} s={[0.7, 2.4, SHELTER.z0 - SHELTER.z1]} c="#7d807d" cast recv />
      <B p={[x - 0.9, 3.15, z]} s={[2.0, 0.3, 4.2]} c="#8a8c88" cast />
      <B p={[x - 0.2, 1.6, z + 1.85]} s={[0.6, 3.2, 0.4]} c="#7a7c79" cast />
      <B p={[x - 0.2, 1.6, z - 1.85]} s={[0.6, 3.2, 0.4]} c="#7a7c79" cast />
      <B p={[x - 0.9, 0.2, z]} s={[1.6, 0.12, 3.6]} c="#8f918d" recv />
      {/* dark doorway */}
      <B p={[x - 0.36, SHELTER.doorH / 2 + 0.15, z]} s={[0.04, SHELTER.doorH, SHELTER.doorW]} m={unlit('#07080a')} />
      <mesh position={[x - 1.92, 3.75, z]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[2.9, 1.09]} />
        <meshStandardMaterial map={sign} emissive="#ffffff" emissiveMap={sign} emissiveIntensity={0.3} />
      </mesh>
    </group>
  );
};

export const ShelterDoors: React.FC<{t: number}> = ({t}) => {
  const open = Math.min(1, Math.max(0, (t - (T.runInside - 0.05)) / 0.35));
  const close = Math.min(1, Math.max(0, (t - (T.runInside + 1.1)) / 0.4));
  const a = (open - close) * 1.45;
  const x = FACADE - 0.4;
  const z = SHELTER.doorZ;
  const half = SHELTER.doorW / 2;
  const doorM = mat('#4f5d55', {rough: 0.6});
  return (
    <group>
      <group position={[x, 0.15, z + half]} rotation={[0, a, 0]}>
        <mesh geometry={BOX} material={doorM} position={[0, SHELTER.doorH / 2, -half / 2]} scale={[0.1, SHELTER.doorH, half]} castShadow />
        <B p={[-0.07, 1.2, -half + 0.15]} s={[0.05, 0.25, 0.06]} c="#c9c9c9" />
      </group>
      <group position={[x, 0.15, z - half]} rotation={[0, -a, 0]}>
        <mesh geometry={BOX} material={doorM} position={[0, SHELTER.doorH / 2, half / 2]} scale={[0.1, SHELTER.doorH, half]} castShadow />
        <B p={[-0.07, 1.2, half - 0.15]} s={[0.05, 0.25, 0.06]} c="#c9c9c9" />
      </group>
    </group>
  );
};

const Metro: React.FC = () => {
  const x = -FACADE;
  const z = METRO.z;
  return (
    <group>
      <B p={[x + 1.5, 1.6, z]} s={[3.0, 3.2, 6]} c="#b8b0a0" cast />
      <B p={[x + 3.05, 1.4, z]} s={[0.08, 2.6, 3.2]} m={unlit('#0a0b0d')} />
      <mesh position={[x + 3.12, 2.85, z]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[3.6, 0.9]} />
        <meshStandardMaterial map={signTexture('МЕТРО', '#c0392b')} emissive="#ffffff" emissiveMap={signTexture('МЕТРО', '#c0392b')} emissiveIntensity={0.35} />
      </mesh>
    </group>
  );
};

const ClockTower: React.FC = () => {
  const clock = clockTexture();
  return (
    <group position={[24, 0, -175]}>
      <B p={[0, 14, 0]} s={[9, 28, 9]} c="#a4382c" cast />
      <B p={[0, 29, 0]} s={[7, 3, 7]} c="#f0e6d0" />
      <B p={[0, 33, 0]} s={[6, 6, 6]} c="#a4382c" />
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[Math.sin((i * Math.PI) / 2) * 3.02, 33, Math.cos((i * Math.PI) / 2) * 3.02]} rotation={[0, (i * Math.PI) / 2, 0]}>
          <planeGeometry args={[4.4, 4.4]} />
          <meshStandardMaterial map={clock} />
        </mesh>
      ))}
      <mesh geometry={CONE4} material={mat('#2f7d4f')} position={[0, 41.5, 0]} rotation={[0, Math.PI / 4, 0]} scale={[4.6, 11, 4.6]} castShadow />
      <B p={[0, 47.5, 0]} s={[0.6, 1.2, 0.6]} c="#c9a227" />
      {[[-4.5, 4.5], [4.5, 4.5], [-4.5, -4.5], [4.5, -4.5]].map(([dx, dz], i) => (
        <mesh key={i} geometry={CONE4} material={mat('#2f7d4f')} position={[dx, 30.8, dz]} rotation={[0, Math.PI / 4, 0]} scale={[0.9, 3, 0.9]} />
      ))}
    </group>
  );
};

/** Gradient sky dome. */
export const Sky: React.FC<{top?: string; bottom?: string}> = ({top = '#5aa2e6', bottom = '#d4e7f3'}) => {
  const m = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {top: {value: new THREE.Color(top)}, bottom: {value: new THREE.Color(bottom)}},
        vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
        fragmentShader:
          'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = clamp(vP.y*1.6+0.05,0.0,1.0); gl_FragColor = vec4(mix(bottom, top, pow(h,0.8)),1.0); }',
      }),
    [top, bottom],
  );
  return <mesh material={m} scale={600} geometry={useMemo(() => new THREE.SphereGeometry(1, 24, 12), [])} renderOrder={-1} />;
};

export const CityStatic: React.FC = React.memo(() => {
  const blds = useMemo(layout, []);
  const windows = useWindows(blds);
  const tiles = useMemo(tileTexture, []);
  const len = Z_MAX - Z_MIN;
  const zc = (Z_MAX + Z_MIN) / 2;
  const r = useMemo(() => rng(11), []);
  const trees = useMemo(() => {
    const list: {p: Vec3; s: number; tint: string; seed: number}[] = [];
    const tints = ['#79b04a', '#6ea545', '#86bb4f', '#73a84a'];
    for (const side of [1, -1] as const) {
      for (let z = side === 1 ? 10 : 3; z > Z_MIN + 20; z -= 14) {
        if (side === 1 && z < SHELTER.z0 + 2 && z > SHELTER.z1 - 2) continue;
        if (side === -1 && Math.abs(z - METRO.z) < 6) continue;
        if (side === 1 && Math.abs(z + 8.3) < 2.5) continue;
        list.push({p: [side * 8.75, 0.15, z], s: 0.9 + r() * 0.3, tint: tints[Math.floor(r() * tints.length)], seed: r() * 6});
      }
    }
    return list;
  }, [r]);
  const lamps = useMemo(() => {
    const list: {p: Vec3; side: 1 | -1}[] = [];
    for (const side of [1, -1] as const) for (let z = side === 1 ? 2 : -6; z > Z_MIN + 20; z -= 18) list.push({p: [side * 5.45, 0.15, z], side: side === 1 ? -1 : 1});
    return list;
  }, []);
  const dashes = useMemo(() => {
    const im = new THREE.InstancedMesh(BOX, unlit('#e8e8e2'), Math.ceil(len / 6));
    let i = 0;
    for (let z = Z_MAX; z > Z_MIN; z -= 6) {
      if (Math.abs(z + 40) < 4 || Math.abs(z + 150) < 4) continue;
      im.setMatrixAt(i++, tmpM.compose(tmpP.set(0, 0.012, z), tmpQ, tmpS.set(0.18, 0.01, 3)).clone());
    }
    im.count = i;
    im.instanceMatrix.needsUpdate = true;
    im.frustumCulled = false;
    return im;
  }, [len]);
  const clouds = useMemo(() => {
    const rr = rng(5);
    return Array.from({length: 16}).map(() => ({p: [-160 + rr() * 320, 70 + rr() * 40, 40 - rr() * 380] as Vec3, s: 0.8 + rr() * 1.2}));
  }, []);
  return (
    <group>
      {/* ground, road, sidewalks, curbs */}
      <B p={[0, -0.05, zc]} s={[400, 0.1, 900]} c="#6f7a5c" recv />
      <B p={[0, 0.0, zc]} s={[10, 0.02, len]} c="#4b4e54" recv />
      {[1, -1].map((side) => (
        <group key={side}>
          <mesh position={[side * 7.25, 0.15, zc]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[4.5, len]} />
            <meshStandardMaterial map={tiles} roughness={0.95} />
          </mesh>
          <B p={[side * 7.25, 0.07, zc]} s={[4.5, 0.14, len]} c="#a9acb0" />
          <B p={[side * 5.06, 0.09, zc]} s={[0.14, 0.18, len]} c="#d9dadb" recv />
        </group>
      ))}
      <primitive object={dashes} />
      {/* crosswalks */}
      {[-40, -150].map((cz) => (
        <group key={cz}>
          {Array.from({length: 8}).map((_, i) => (
            <B key={i} p={[-4.2 + i * 1.2, 0.013, cz]} s={[0.6, 0.01, 3.4]} m={unlit('#ecebe6')} />
          ))}
        </group>
      ))}
      {blds.map((b, i) =>
        b.kind === 'normal' ? <Building key={i} b={b} /> : (
          <group key={i}>
            <B p={[b.side * (FACADE + b.d / 2), b.h / 2, (b.z0 + b.z1) / 2]} s={[b.d, b.h, b.z0 - b.z1]} c={b.color} cast recv />
            <B p={[b.side * (FACADE + b.d / 2), b.h + 0.4, (b.z0 + b.z1) / 2]} s={[b.d + 0.3, 0.8, b.z0 - b.z1 + 0.3]} c="#7f817e" />
          </group>
        ),
      )}
      {windows.map((w, i) => (
        <primitive key={i} object={w} />
      ))}
      <Shelter />
      <Metro />
      <ClockTower />
      {trees.map((tr, i) => (
        <Tree key={i} p={tr.p} s={tr.s} tint={tr.tint} seed={tr.seed} />
      ))}
      {lamps.map((l, i) => (
        <StreetLamp key={i} p={l.p} side={l.side} />
      ))}
      {trees.filter((_, i) => i % 2 === 0).map((tr, i) => (
        <Bench key={i} p={[Math.sign(tr.p[0]) * 9.0, 0.15, tr.p[2] + 3.2]} yaw={Math.sign(tr.p[0]) > 0 ? -Math.PI / 2 : Math.PI / 2} />
      ))}
      {trees.filter((_, i) => i % 3 === 1).map((tr, i) => (
        <TrashBin key={i} p={[Math.sign(tr.p[0]) * 5.6, 0.15, tr.p[2] - 2.5]} />
      ))}
      {clouds.map((c, i) => (
        <Cloud key={i} p={c.p} s={c.s} />
      ))}
    </group>
  );
});

// ------------------------------------------------------------------------------------------
// Dynamic city elements
// ------------------------------------------------------------------------------------------

export const CARS: CarDef[] = [
  {id: 1, color: '#c0392b', lane: 1, z0: 30, v: 8, tb: 12.0, swerve: 0.4, yawOff: 0.12},
  {id: 2, color: '#f2f2f0', lane: 1, z0: 8, v: 8, tb: 13.0, swerve: 0.2, yawOff: -0.05},
  {id: 3, color: '#2c5aa0', lane: 1, z0: 60, v: 8.5, tb: 12.5, swerve: 0.6, yawOff: 0.22, doorAt: 25},
  {id: 4, color: '#f1c40f', lane: 1, z0: 85, v: 8, tb: 14.0, swerve: 0.3, yawOff: 0.1, taxi: true},
  {id: 5, color: '#5d6d7e', lane: 1, z0: 122, v: 8.2, tb: 15.2, swerve: 0.1, yawOff: 0.04},
  {id: 6, color: '#27ae60', lane: 1, z0: -30, v: 8, tb: 11.5, swerve: 0.5, yawOff: 0.15},
  {id: 7, color: '#1c1e22', lane: -1, z0: -90, v: 8, tb: 12.0, swerve: 0.3, yawOff: -0.1},
  {id: 8, color: '#e67e22', lane: -1, z0: -140, v: 8, tb: 13.0, swerve: 0.7, yawOff: -0.3, doorAt: 22},
  {id: 9, color: '#ecf0f1', lane: -1, z0: -60, v: 8, tb: 12.0, swerve: 0.2, yawOff: -0.05},
  {id: 10, color: '#8e44ad', lane: -1, z0: -200, v: 8.5, tb: 14.0, swerve: 0.4, yawOff: -0.12},
  {id: 11, color: '#c0392b', lane: -1, z0: -126, v: 8, tb: 15.5, swerve: 0.2, yawOff: 0.06},
  {id: 12, color: '#16a085', lane: 1, z0: -110, v: 8, tb: 12.0, swerve: 0.4, yawOff: 0.1},
  {id: 13, color: '#bdc3c7', lane: -1, z0: -250, v: 8, tb: 13.5, swerve: 0.5, yawOff: -0.15},
  {id: 14, color: '#2980b9', lane: 1, z0: -170, v: 8, tb: 12.8, swerve: 0.3, yawOff: 0.1},
];

const PIGEONS = Array.from({length: 7}).map((_, i) => {
  const r = rng(100 + i);
  return {x: 6.2 + r() * 2.4, z: -12 - r() * 3, yaw: r() * 6.28, seed: r() * 10, flyT: T.screenRed + 0.25 + r() * 0.5, dx: -6 - r() * 6, dz: -8 - r() * 10};
});

const SKY_BIRDS = Array.from({length: 6}).map((_, i) => ({off: [i * 1.6 - 4, (i % 2) * 1.2, (i % 3) * 1.4] as Vec3, seed: i}));

export const CityDynamic: React.FC<{t: number; empty?: boolean}> = ({t, empty}) => {
  return (
    <group>
      {CARS.map((c) => (
        <Car key={c.id} def={c} t={t} />
      ))}
      <ShelterDoors t={t} />
      <TrafficLight p={[-5.4, 0.15, -41.8]} yaw={Math.PI} red={t > 10} />
      {!empty && t < 20
        ? PIGEONS.map((pg, i) => {
            const ft = t - pg.flyT;
            const flying = ft > 0;
            const k = Math.max(0, ft);
            const p: Vec3 = flying
              ? [pg.x + pg.dx * (k / 2.5) * Math.min(1, k), 0.15 + k * 2.8 + k * k * 0.6, pg.z + pg.dz * (k / 2.5) * Math.min(1, k)]
              : [pg.x + Math.sin(t * 0.5 + pg.seed) * 0.15, 0.15, pg.z + Math.cos(t * 0.4 + pg.seed) * 0.15];
            const yaw = flying ? Math.atan2(pg.dx, pg.dz) : pg.yaw + Math.sin(t * 0.7 + pg.seed) * 0.6;
            const peck = flying ? 0 : Math.max(0, Math.sin(t * 6 + pg.seed * 3)) ** 4;
            return <Pigeon key={i} p={p} yaw={yaw} flap={t * 28 + pg.seed} flying={flying} peck={peck} />;
          })
        : null}
      {/* birds crossing the sky during the "look at the sky" POV */}
      {t > T.first10 && t < T.peopleStop + 1
        ? SKY_BIRDS.map((b, i) => {
            const k = t - T.first10;
            const p: Vec3 = [-14 + k * 6.5 + b.off[0], 22 + b.off[1] + Math.sin(k * 2 + i) * 0.3, -18 + k * 1.5 + b.off[2]];
            return (
              <group key={i} scale={1.6}>
                <Pigeon p={[p[0] / 1.6, p[1] / 1.6, p[2] / 1.6]} yaw={1.35} flap={t * 22 + i * 1.3} flying peck={0} />
              </group>
            );
          })
        : null}
      {/* contrail high in the sky */}
      {t > T.first10 - 0.5 && t < T.blackout ? (
        <group position={[-60, 120, -80]} rotation={[0, -0.35, 0.08]}>
          <mesh geometry={BOX} material={unlit('#ffffff', 0.85)} position={[Math.min(140, (t - T.first10 + 0.5) * 9) / 2, 0, 0]} scale={[Math.min(140, (t - T.first10 + 0.5) * 9), 0.7, 0.7]} />
          <mesh geometry={BOX} material={unlit('#ffffff')} position={[Math.min(140, (t - T.first10 + 0.5) * 9), 0, 0]} scale={[1.6, 0.9, 0.9]} />
        </group>
      ) : null}
    </group>
  );
};

export {Sky as CitySky};
export const CITY_FOG = {color: '#cfe0ec', near: 60, far: 290};
export {Tree};
