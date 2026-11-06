import * as THREE from 'three';
import React from 'react';
import {BOX, CYL12, CYL6, ICO, mat, unlit} from '../components/materials';
import {Vec3} from '../animations/math';

export const B: React.FC<{p: Vec3; s: Vec3; c?: string; r?: Vec3; m?: THREE.Material; cast?: boolean; recv?: boolean}> = ({p, s, c = '#ccc', r, m, cast, recv}) => (
  <mesh geometry={BOX} material={m ?? mat(c)} position={p} scale={s} rotation={r} castShadow={cast} receiveShadow={recv} />
);

/** Birch-like tree with a faceted low-poly crown (as in the reference). */
export const Tree: React.FC<{p: Vec3; s?: number; tint?: string; seed?: number}> = React.memo(({p, s = 1, tint = '#79b04a', seed = 0}) => {
  const h = 3.4 * s;
  const rot = seed * 1.7;
  return (
    <group position={p} rotation={[0, rot, 0]}>
      <mesh geometry={CYL6} material={mat('#ecebe4')} position={[0, h / 2, 0]} scale={[0.26 * s, h, 0.26 * s]} castShadow />
      {[0.25, 0.48, 0.7, 0.86].map((k, i) => (
        <B key={i} p={[i % 2 ? 0.1 : -0.1, h * k, 0.1]} s={[0.12, 0.07, 0.1]} c="#2a2a2a" />
      ))}
      <mesh geometry={ICO} material={mat(tint)} position={[0, h + 1.5 * s, 0]} scale={[1.75 * s, 2.15 * s, 1.75 * s]} rotation={[0.3, seed, 0.2]} castShadow />
      <mesh geometry={ICO} material={mat(tint)} position={[0.9 * s, h + 0.7 * s, 0.4 * s]} scale={[1.0 * s, 1.1 * s, 1.0 * s]} rotation={[0.7, seed * 2, 0]} castShadow />
    </group>
  );
});

export const StreetLamp: React.FC<{p: Vec3; side: 1 | -1}> = React.memo(({p, side}) => (
  <group position={p}>
    <mesh geometry={CYL6} material={mat('#3b3f45')} position={[0, 2.6, 0]} scale={[0.16, 5.2, 0.16]} castShadow />
    <B p={[side * 0.55, 5.15, 0]} s={[1.2, 0.1, 0.12]} c="#3b3f45" />
    <B p={[side * 1.05, 5.02, 0]} s={[0.5, 0.18, 0.32]} c="#2c3035" />
    <B p={[side * 1.05, 4.92, 0]} s={[0.42, 0.04, 0.26]} m={unlit('#fff3cf')} />
    <B p={[0, 0.2, 0]} s={[0.32, 0.4, 0.32]} c="#2c3035" />
  </group>
));

export const Bench: React.FC<{p: Vec3; yaw: number}> = React.memo(({p, yaw}) => (
  <group position={p} rotation={[0, yaw, 0]}>
    <B p={[0, 0.45, 0]} s={[1.8, 0.08, 0.45]} c="#8b5a2b" cast />
    <B p={[0, 0.8, -0.2]} s={[1.8, 0.35, 0.07]} c="#8b5a2b" cast />
    <B p={[0.75, 0.22, 0]} s={[0.08, 0.45, 0.4]} c="#30343a" />
    <B p={[-0.75, 0.22, 0]} s={[0.08, 0.45, 0.4]} c="#30343a" />
  </group>
));

export const TrashBin: React.FC<{p: Vec3}> = React.memo(({p}) => (
  <group position={p}>
    <mesh geometry={CYL6} material={mat('#4d6b4f')} position={[0, 0.45, 0]} scale={[0.5, 0.9, 0.5]} castShadow />
  </group>
));

export const TrafficLight: React.FC<{p: Vec3; yaw: number; red: boolean}> = ({p, yaw, red}) => (
  <group position={p} rotation={[0, yaw, 0]}>
    <mesh geometry={CYL6} material={mat('#2d3136')} position={[0, 1.6, 0]} scale={[0.14, 3.2, 0.14]} />
    <B p={[0, 3.4, 0.1]} s={[0.36, 1.0, 0.3]} c="#22262b" />
    <B p={[0, 3.7, 0.26]} s={[0.2, 0.2, 0.03]} m={red ? unlit('#ff3b30') : mat('#4a1513')} />
    <B p={[0, 3.4, 0.26]} s={[0.2, 0.2, 0.03]} m={mat('#4a3c12')} />
    <B p={[0, 3.1, 0.26]} s={[0.2, 0.2, 0.03]} m={!red ? unlit('#3ce26b') : mat('#123a1e')} />
  </group>
);

export interface CarDef {
  id: number;
  color: string;
  lane: 1 | -1; // +1: x=+2.5 driving -z ; -1: x=-2.5 driving +z
  z0: number;
  v: number;
  tb: number; // brake start time
  swerve: number; // lateral offset at stop (towards road centre)
  yawOff: number;
  taxi?: boolean;
  doorAt?: number;
}

export function carState(c: CarDef, t: number) {
  const dir = c.lane === 1 ? -1 : 1;
  const decel = 4.5;
  const tStop = c.v / decel;
  let s: number;
  let braking = 0;
  if (t < c.tb) s = c.v * t;
  else {
    const dt = Math.min(t - c.tb, tStop);
    s = c.v * c.tb + c.v * dt - 0.5 * decel * dt * dt;
    braking = 1;
  }
  const u = t < c.tb ? 0 : Math.min(1, (t - c.tb) / tStop);
  const k = u * u * (3 - 2 * u);
  const x = c.lane * 2.5 - c.lane * c.swerve * k;
  const z = c.z0 + dir * s;
  const yaw = (c.lane === 1 ? Math.PI : 0) + c.yawOff * k;
  const moving = t < c.tb + tStop;
  const wheel = s / 0.34;
  return {p: [x, 0, z] as Vec3, yaw, braking, moving, wheel};
}

export const Car: React.FC<{def: CarDef; t: number}> = ({def, t}) => {
  const st = carState(def, t);
  const door = def.doorAt !== undefined ? Math.min(1, Math.max(0, (t - def.doorAt) / 0.6)) : 0;
  const glass = mat('#1f2b3a', {rough: 0.25});
  const wheelM = mat('#17181b');
  const wheels: Vec3[] = [
    [0.92, 0.36, 1.3], [-0.92, 0.36, 1.3], [0.92, 0.36, -1.3], [-0.92, 0.36, -1.3],
  ];
  return (
    <group position={st.p} rotation={[0, st.yaw, 0]}>
      <B p={[0, 0.62, 0]} s={[1.9, 0.62, 4.2]} c={def.color} cast />
      <B p={[0, 1.2, -0.25]} s={[1.72, 0.58, 2.2]} m={glass} cast />
      <B p={[0, 1.52, -0.25]} s={[1.76, 0.08, 2.24]} c={def.color} />
      <B p={[0.0, 1.2, -0.25]} s={[1.76, 0.58, 0.1]} c={def.color} />
      {def.taxi ? <B p={[0, 1.66, -0.25]} s={[0.6, 0.2, 0.3]} c="#ffd21f" /> : null}
      {wheels.map((w, i) => (
        <mesh key={i} geometry={CYL12} material={wheelM} position={w} rotation={[st.wheel * (st.moving ? 1 : 0), 0, Math.PI / 2]} scale={[0.72, 0.28, 0.72]} />
      ))}
      <B p={[0.6, 0.72, 2.11]} s={[0.4, 0.16, 0.04]} m={unlit('#fff6d8')} />
      <B p={[-0.6, 0.72, 2.11]} s={[0.4, 0.16, 0.04]} m={unlit('#fff6d8')} />
      <B p={[0.65, 0.75, -2.11]} s={[0.4, 0.14, 0.04]} m={st.braking ? unlit('#ff2a1a') : mat('#7a1810')} />
      <B p={[-0.65, 0.75, -2.11]} s={[0.4, 0.14, 0.04]} m={st.braking ? unlit('#ff2a1a') : mat('#7a1810')} />
      <B p={[0, 0.42, 2.12]} s={[1.6, 0.14, 0.06]} c="#2a2c30" />
      {door > 0 ? (
        <group position={[0.96, 0, 0.55]} rotation={[0, door * 1.1, 0]}>
          <B p={[0.02, 0.85, -0.6]} s={[0.08, 0.9, 1.2]} c={def.color} />
        </group>
      ) : null}
    </group>
  );
};

/** Low-poly pigeon. flap 0..1 wings angle phase, flying toggles posture. */
export const Pigeon: React.FC<{p: Vec3; yaw: number; flap: number; flying: boolean; peck: number}> = ({p, yaw, flap, flying, peck}) => {
  const wing = flying ? Math.sin(flap) * 0.9 : 0;
  return (
    <group position={p} rotation={[0, yaw, 0]}>
      <B p={[0, 0.18, 0]} s={[0.2, 0.18, 0.34]} c="#69707c" />
      <B p={[0, 0.2, -0.2]} s={[0.14, 0.08, 0.14]} c="#4f5560" />
      <group position={[0, 0.3 - peck * 0.12, 0.17 + peck * 0.05]}>
        <B p={[0, 0, 0]} s={[0.11, 0.11, 0.12]} c="#4c5866" />
        <B p={[0, -0.01, 0.08]} s={[0.04, 0.03, 0.05]} c="#e0a020" />
      </group>
      <group position={[0.1, 0.24, 0]} rotation={[0, 0, flying ? wing : -0.2]}>
        <B p={[flying ? 0.18 : 0.0, 0, 0]} s={[flying ? 0.36 : 0.04, 0.03, 0.24]} c="#5b6270" />
      </group>
      <group position={[-0.1, 0.24, 0]} rotation={[0, 0, flying ? -wing : 0.2]}>
        <B p={[flying ? -0.18 : 0.0, 0, 0]} s={[flying ? 0.36 : 0.04, 0.03, 0.24]} c="#5b6270" />
      </group>
      {!flying ? (
        <>
          <B p={[0.05, 0.05, 0.02]} s={[0.03, 0.1, 0.03]} c="#c0392b" />
          <B p={[-0.05, 0.05, 0.02]} s={[0.03, 0.1, 0.03]} c="#c0392b" />
        </>
      ) : null}
    </group>
  );
};

export const Cloud: React.FC<{p: Vec3; s: number}> = React.memo(({p, s}) => (
  <group position={p}>
    <mesh geometry={ICO} material={unlit('#ffffff')} scale={[9 * s, 3.2 * s, 6 * s]} />
    <mesh geometry={ICO} material={unlit('#f3f7fb')} position={[7 * s, -0.8 * s, 1 * s]} scale={[6 * s, 2.4 * s, 4.5 * s]} />
    <mesh geometry={ICO} material={unlit('#f3f7fb')} position={[-7 * s, -0.9 * s, -1 * s]} scale={[5.5 * s, 2.2 * s, 4 * s]} />
  </group>
));
