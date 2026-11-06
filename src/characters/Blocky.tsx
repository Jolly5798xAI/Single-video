import * as THREE from 'three';
import React from 'react';
import {BOX, mat} from '../components/materials';
import {Pose} from '../animations/pose';
import {Vec3} from '../animations/math';

export type Expr = 'neutral' | 'smile' | 'surprised' | 'worried' | 'scared' | 'sad' | 'closed' | 'laugh';
export type Hair = 'short' | 'bun' | 'cap' | 'ushanka' | 'bald' | 'long';

export interface Look {
  shirt: string;
  stripe?: string;
  pants: string;
  shoes: string;
  skin: string;
  hair: string;
  hairStyle: Hair;
  hat?: string;
  mustache?: boolean;
  bag?: string;
}

export interface BlockyProps {
  position: Vec3;
  yaw: number;
  pose: Pose;
  look: Look;
  expr?: Expr;
  /** 0 = open eyes, 1 = closed (blink) */
  blink?: number;
  /** pupil offset (-1..1) for glances */
  gaze?: [number, number];
  phone?: 'torso' | 'hand' | null;
  phoneScreen?: THREE.Texture | null;
  /** rotation jitter of the held phone (trembling hands) */
  phoneJitter?: Vec3;
  hideHead?: boolean;
  castShadow?: boolean;
}

// --- body dimensions (metres) --------------------------------------------------
export const DIM = {
  torsoW: 0.56, torsoH: 0.66, torsoD: 0.3,
  shoulderX: 0.38, shoulderY: 0.6,
  upper: 0.32, fore: 0.27,
  hipX: 0.13, thigh: 0.45, shin: 0.4,
  head: 0.52, neckY: 0.66,
};
/** Phone transform when held up, expressed in torso space. */
export const PHONE_IN_TORSO = {pos: [-0.15, 0.43, 0.42] as Vec3, rot: [0.64, Math.PI, 0] as Vec3};

const Box: React.FC<{p: Vec3; s: Vec3; c: string; r?: Vec3; shadow?: boolean; m?: THREE.Material}> = ({p, s, c, r, shadow, m}) => (
  <mesh geometry={BOX} material={m ?? mat(c)} position={p} scale={s} rotation={r} castShadow={shadow} />
);

export const PhoneMesh: React.FC<{screen?: THREE.Texture | null}> = ({screen}) => (
  <group>
    <mesh geometry={BOX} material={mat('#16181d', {rough: 0.4})} scale={[0.085, 0.172, 0.012]} />
    {screen ? (
      <mesh position={[0, 0, 0.0065]}>
        <planeGeometry args={[0.077, 0.158]} />
        <meshBasicMaterial map={screen} toneMapped={false} />
      </mesh>
    ) : (
      <mesh geometry={BOX} material={mat('#0c1a2e', {rough: 0.2})} position={[0, 0, 0.004]} scale={[0.077, 0.158, 0.006]} />
    )}
  </group>
);

const Face: React.FC<{expr: Expr; blink: number; gaze: [number, number]; mustache?: boolean}> = ({expr, blink, gaze, mustache}) => {
  const z = DIM.head / 2 + 0.004;
  const dark = '#1d1712';
  const closed = expr === 'closed' || blink > 0.6;
  const wide = expr === 'scared' || expr === 'surprised';
  const eyeW = 0.115;
  const eyeH = wide ? 0.115 : 0.085;
  const pupil = wide ? 0.045 : 0.056;
  const browY = expr === 'scared' || expr === 'surprised' ? 0.165 : expr === 'worried' || expr === 'sad' ? 0.145 : 0.13;
  const browA = expr === 'worried' || expr === 'sad' || expr === 'scared' ? 0.32 : expr === 'smile' || expr === 'laugh' ? -0.05 : 0;
  const gx = gaze[0] * 0.025;
  const gy = gaze[1] * 0.018;
  const eyes = [1, -1].map((side) => (
    <group key={side} position={[side * 0.115, 0.035, z]}>
      {closed ? (
        <Box p={[0, -0.01, 0]} s={[eyeW, 0.02, 0.008]} c={dark} />
      ) : (
        <>
          <Box p={[0, 0, 0]} s={[eyeW, eyeH, 0.008]} c="#f4f1ea" />
          <Box p={[gx - side * 0.012, gy - 0.004, 0.005]} s={[pupil, pupil * 1.25, 0.008]} c={dark} />
        </>
      )}
      <Box p={[0, browY - 0.035, 0.002]} s={[0.13, 0.03, 0.01]} r={[0, 0, -side * browA]} c={dark} />
    </group>
  ));
  let mouth: React.ReactNode;
  const my = -0.12;
  switch (expr) {
    case 'smile':
      mouth = (
        <>
          <Box p={[0, my, z]} s={[0.12, 0.025, 0.008]} c={dark} />
          <Box p={[0.07, my + 0.012, z]} s={[0.04, 0.025, 0.008]} r={[0, 0, 0.6]} c={dark} />
          <Box p={[-0.07, my + 0.012, z]} s={[0.04, 0.025, 0.008]} r={[0, 0, -0.6]} c={dark} />
        </>
      );
      break;
    case 'laugh':
      mouth = <Box p={[0, my - 0.01, z]} s={[0.15, 0.085, 0.008]} c="#5a1a1a" />;
      break;
    case 'surprised':
    case 'scared':
      mouth = <Box p={[0, my - 0.012, z]} s={[expr === 'scared' ? 0.1 : 0.075, expr === 'scared' ? 0.075 : 0.07, 0.008]} c="#4a1616" />;
      break;
    case 'sad':
    case 'worried':
      mouth = (
        <>
          <Box p={[0, my, z]} s={[0.1, 0.024, 0.008]} c={dark} />
          <Box p={[0.06, my - 0.012, z]} s={[0.035, 0.024, 0.008]} r={[0, 0, -0.55]} c={dark} />
          <Box p={[-0.06, my - 0.012, z]} s={[0.035, 0.024, 0.008]} r={[0, 0, 0.55]} c={dark} />
        </>
      );
      break;
    default:
      mouth = <Box p={[0, my, z]} s={[0.13, 0.025, 0.008]} c={dark} />;
  }
  return (
    <group>
      {eyes}
      {mouth}
      {mustache ? <Box p={[0, my + 0.045, z + 0.003]} s={[0.17, 0.04, 0.012]} c="#2b1d14" /> : null}
    </group>
  );
};

const HairMesh: React.FC<{look: Look}> = ({look}) => {
  const h = DIM.head;
  const top = h / 2;
  const c = look.hair;
  switch (look.hairStyle) {
    case 'bald':
      return null;
    case 'cap':
      return (
        <group>
          <Box p={[0, top + 0.05, 0]} s={[h + 0.03, 0.12, h + 0.03]} c={look.hat ?? '#244'} />
          <Box p={[0, top + 0.0, h / 2 + 0.1]} s={[h * 0.8, 0.03, 0.22]} c={look.hat ?? '#244'} />
          <Box p={[0, 0.02, -h / 2 - 0.02]} s={[h + 0.02, 0.24, 0.05]} c={c} />
        </group>
      );
    case 'ushanka':
      return (
        <group>
          <Box p={[0, top + 0.08, 0]} s={[h + 0.08, 0.2, h + 0.08]} c={look.hat ?? '#5b4636'} />
          <Box p={[0, top + 0.0, h / 2 + 0.05]} s={[h + 0.1, 0.1, 0.08]} c={look.hat ?? '#5b4636'} />
          <Box p={[h / 2 + 0.05, 0.02, 0]} s={[0.07, 0.38, 0.4]} c={look.hat ?? '#5b4636'} />
          <Box p={[-h / 2 - 0.05, 0.02, 0]} s={[0.07, 0.38, 0.4]} c={look.hat ?? '#5b4636'} />
        </group>
      );
    case 'bun':
    case 'long':
      return (
        <group>
          <Box p={[0, top + 0.035, -0.01]} s={[h + 0.04, 0.08, h + 0.03]} c={c} />
          <Box p={[0, look.hairStyle === 'long' ? -0.12 : 0.02, -h / 2 - 0.03]} s={[h + 0.04, look.hairStyle === 'long' ? 0.6 : 0.42, 0.07]} c={c} />
          <Box p={[h / 2 + 0.02, 0.06, -0.06]} s={[0.05, 0.36, 0.4]} c={c} />
          <Box p={[-h / 2 - 0.02, 0.06, -0.06]} s={[0.05, 0.36, 0.4]} c={c} />
          {look.hairStyle === 'bun' ? <Box p={[0, top + 0.13, -0.16]} s={[0.2, 0.17, 0.2]} c={c} /> : null}
        </group>
      );
    default:
      return (
        <group>
          <Box p={[0, top + 0.04, -0.01]} s={[h + 0.04, 0.1, h + 0.03]} c={c} />
          <Box p={[0, 0.06, -h / 2 - 0.025]} s={[h + 0.04, 0.34, 0.06]} c={c} />
          <Box p={[0, top - 0.04, h / 2 + 0.012]} s={[h + 0.04, 0.09, 0.03]} c={c} />
          <Box p={[h / 2 + 0.018, 0.1, -0.05]} s={[0.04, 0.24, 0.42]} c={c} />
          <Box p={[-h / 2 - 0.018, 0.1, -0.05]} s={[0.04, 0.24, 0.42]} c={c} />
        </group>
      );
  }
};

export const Blocky: React.FC<BlockyProps> = ({position, yaw, pose, look, expr = 'neutral', blink = 0, gaze = [0, 0], phone = null, phoneScreen, phoneJitter = [0, 0, 0], hideHead = false, castShadow = true}) => {
  const sh = castShadow;
  const arm = (side: 1 | -1) => {
    const sx = side === 1 ? pose.lSx : pose.rSx;
    const sz = side === 1 ? pose.lSz : pose.rSz;
    const el = side === 1 ? pose.lEl : pose.rEl;
    return (
      <group position={[side * DIM.shoulderX, DIM.shoulderY, 0]} rotation={[-sx, 0, side * sz]}>
        <Box p={[0, -DIM.upper / 2 + 0.04, 0]} s={[0.2, DIM.upper + 0.08, 0.22]} c={look.shirt} shadow={sh} />
        <group position={[0, -DIM.upper + 0.02, 0]} rotation={[-el, 0, 0]}>
          <Box p={[0, -DIM.fore / 2, 0]} s={[0.19, DIM.fore, 0.21]} c={look.shirt} shadow={sh} />
          <Box p={[0, -DIM.fore - 0.055, 0]} s={[0.17, 0.12, 0.19]} c={look.skin} shadow={sh} />
          {side === -1 && phone === 'hand' ? (
            <group position={[0, -DIM.fore - 0.08, 0.1]} rotation={[0.3, 0, 0]}>
              <PhoneMesh />
            </group>
          ) : null}
        </group>
      </group>
    );
  };
  const leg = (side: 1 | -1) => {
    const hip = side === 1 ? pose.lHip : pose.rHip;
    const knee = side === 1 ? pose.lKnee : pose.rKnee;
    const hz = side === 1 ? pose.lHipZ : pose.rHipZ;
    return (
      <group position={[side * DIM.hipX, 0, 0]} rotation={[-hip, 0, side * hz]}>
        <Box p={[0, -DIM.thigh / 2 + 0.02, 0]} s={[0.25, DIM.thigh + 0.04, 0.27]} c={look.pants} shadow={sh} />
        <group position={[0, -DIM.thigh, 0]} rotation={[knee, 0, 0]}>
          <Box p={[0, -DIM.shin / 2, 0]} s={[0.24, DIM.shin, 0.26]} c={look.pants} shadow={sh} />
          <Box p={[0, -DIM.shin - 0.05, 0.035]} s={[0.26, 0.1, 0.33]} c={look.shoes} shadow={sh} />
        </group>
      </group>
    );
  };
  return (
    <group position={position} rotation={[0, yaw, 0]}>
      <group position={[0, pose.hipY + pose.rootY, 0]}>
        {leg(1)}
        {leg(-1)}
        <Box p={[0, 0.0, 0]} s={[0.54, 0.12, 0.28]} c={look.pants} />
        <group rotation={new THREE.Euler(pose.lean, pose.torsoYaw, pose.torsoRoll, 'YXZ')}>
          <Box p={[0, DIM.torsoH / 2, 0]} s={[DIM.torsoW, DIM.torsoH, DIM.torsoD]} c={look.shirt} shadow={sh} />
          {look.stripe ? <Box p={[0, DIM.torsoH / 2, DIM.torsoD / 2 + 0.005]} s={[0.035, DIM.torsoH * 0.92, 0.01]} c={look.stripe} /> : null}
          {look.bag ? (
            <>
              <Box p={[0, DIM.torsoH * 0.5, -DIM.torsoD / 2 - 0.1]} s={[0.4, 0.46, 0.18]} c={look.bag} shadow={sh} />
            </>
          ) : null}
          <Box p={[0, DIM.torsoH + 0.02, 0]} s={[0.22, 0.06, 0.2]} c={look.skin} />
          {arm(1)}
          {arm(-1)}
          <group visible={!hideHead} position={[0, DIM.neckY, 0]} rotation={new THREE.Euler(pose.headPitch, pose.headYaw, pose.headRoll, 'YXZ')}>
            <group position={[0, DIM.head / 2 + 0.02, 0]}>
              <Box p={[0, 0, 0]} s={[DIM.head, DIM.head, DIM.head]} c={look.skin} shadow={sh} />
              <Face expr={expr} blink={blink} gaze={gaze} mustache={look.mustache} />
              <HairMesh look={look} />
            </group>
          </group>
          {phone === 'torso' ? (
            <group
              position={[PHONE_IN_TORSO.pos[0] + phoneJitter[0] * 0.05, PHONE_IN_TORSO.pos[1] + phoneJitter[1] * 0.05, PHONE_IN_TORSO.pos[2]]}
              rotation={[PHONE_IN_TORSO.rot[0] + phoneJitter[0], PHONE_IN_TORSO.rot[1] + phoneJitter[1], PHONE_IN_TORSO.rot[2] + phoneJitter[2]]}
            >
              <PhoneMesh screen={phoneScreen} />
            </group>
          ) : null}
        </group>
      </group>
    </group>
  );
};

// ---- forward kinematics helpers (used to aim cameras at the head / phone) ----

const _root = new THREE.Object3D();
const _pelvis = new THREE.Object3D();
const _torso = new THREE.Object3D();
const _head = new THREE.Object3D();
const _phone = new THREE.Object3D();
_root.add(_pelvis);
_pelvis.add(_torso);
_torso.add(_head);
_torso.add(_phone);

function solve(position: Vec3, yaw: number, pose: Pose) {
  _root.position.set(...position);
  _root.rotation.set(0, yaw, 0);
  _pelvis.position.set(0, pose.hipY + pose.rootY, 0);
  _torso.rotation.set(pose.lean, pose.torsoYaw, pose.torsoRoll, 'YXZ');
  _head.position.set(0, DIM.neckY, 0);
  _head.rotation.set(pose.headPitch, pose.headYaw, pose.headRoll, 'YXZ');
  _phone.position.set(...PHONE_IN_TORSO.pos);
  _phone.rotation.set(...PHONE_IN_TORSO.rot);
  _root.updateMatrixWorld(true);
}

/** World matrix of the phone (held up). Local +Z = screen normal, +Y = phone up. */
export function phoneMatrix(position: Vec3, yaw: number, pose: Pose) {
  solve(position, yaw, pose);
  return _phone.matrixWorld.clone();
}

/** World matrix of the head (centre of the cube). Local +Z = face direction. */
export function headMatrix(position: Vec3, yaw: number, pose: Pose) {
  solve(position, yaw, pose);
  const m = _head.matrixWorld.clone();
  m.multiply(new THREE.Matrix4().makeTranslation(0, DIM.head / 2 + 0.02, 0));
  return m;
}
