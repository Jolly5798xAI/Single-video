import * as THREE from 'three';
import React, {useMemo} from 'react';
import {useThree} from '@react-three/fiber';
import {Blocky, PhoneMesh, phoneMatrix} from '../characters/Blocky';
import {BOX, mat} from '../components/materials';
import {window01} from '../animations/math';
import {PhoneScreen, screenMode} from '../characters/phoneScreen';
import {CITY_FOG, CityDynamic, CityStatic, Sky} from '../environments/City';
import {Bulb, bulbFlicker, InteriorStatic} from '../environments/Interior';
import {cameraAt} from './shots';
import {HERO_LOOK, heroState, INTERIOR_START, MOM_LOOK, momState} from './hero';
import {NPCS, npcState, npcVisible} from './npcs';
import {Vec3} from '../animations/math';
import TL from '../timeline/timeline.json';

const T = TL.T;

export type DebugCam = {pos: Vec3; look: Vec3; fov: number; relHero?: boolean} | null;
let debugCam: DebugCam = null;
export const setDebugCam = (d: DebugCam) => {
  debugCam = d;
};

const CameraRig: React.FC<{t: number}> = ({t}) => {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  let {cam} = cameraAt(t);
  if (debugCam) {
    const h = heroState(t);
    const c = Math.cos(h.yaw);
    const sn = Math.sin(h.yaw);
    const tr = (v: Vec3): Vec3 => (debugCam!.relHero ? [h.p[0] + v[0] * c + v[2] * sn, h.p[1] + v[1], h.p[2] - v[0] * sn + v[2] * c] : v);
    cam = {pos: tr(debugCam.pos), look: tr(debugCam.look), fov: debugCam.fov};
  }
  camera.position.set(...cam.pos);
  camera.up.set(...(cam.up ?? [0, 1, 0]));
  camera.lookAt(...cam.look);
  camera.fov = cam.fov;
  camera.near = 0.02;
  camera.far = 900;
  camera.updateProjectionMatrix();
  return null;
};

/** Light cast by the phone screen on the face (red when the alert is on). */
const PhoneGlow: React.FC<{t: number}> = ({t}) => {
  const h = heroState(t);
  if (h.phone !== 'torso') return null;
  const m = phoneMatrix(h.p, h.yaw, h.pose);
  const o = new THREE.Vector3(0, 0, 0.12).applyMatrix4(m);
  const mode = screenMode(t);
  const alert = mode === 'alert' || mode === 'notify';
  const flash = alert ? (Math.floor((t - T.screenRed) * 2.2) % 2 === 0 ? 1 : 0.6) : 1;
  return <pointLight position={[o.x, o.y, o.z]} color={alert ? '#ff2a20' : '#cfe4ff'} intensity={(alert ? 2.6 : 0.9) * flash} distance={1.4} decay={1.6} />;
};

/** Insert shot of the phone: just the phone and the hands (the body would block the camera). */
const PhoneInsert: React.FC<{t: number; tex: THREE.Texture}> = ({t, tex}) => {
  const h = heroState(t);
  const m = phoneMatrix(h.p, h.yaw, h.pose);
  const j = h.phoneJitter;
  m.multiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(j[0] * 0.5, j[1] * 0.5, j[2] * 0.5)));
  const typing = window01(t, T.startTyping + 0.1, 57.7, 0.25);
  const skin = mat(HERO_LOOK.skin);
  const sleeve = mat(HERO_LOOK.shirt);
  const tapR = typing * Math.max(0, Math.sin(t * 19)) * 0.012;
  const tapL = typing * Math.max(0, Math.sin(t * 19 + 2.1)) * 0.012;
  const box = (p: Vec3, s: Vec3, mm: THREE.Material, r?: Vec3, key?: string) => <mesh key={key} geometry={BOX} material={mm} position={p} scale={s} rotation={r} />;
  return (
    <group matrixAutoUpdate={false} matrix={m}>
      <PhoneMesh screen={tex} />
      {box([0.022, -0.065, -0.03], [0.072, 0.09, 0.034], skin)}
      {box([0.05, -0.04, -0.008], [0.018, 0.085, 0.03], skin)}
      {box([0.043 - typing * 0.01, -0.06 + typing * 0.015, 0.012 + tapR], [0.017, 0.048, 0.015], skin, [0, 0, 0.3 + typing * 0.25])}
      {box([0.035, -0.135, -0.17], [0.09, 0.09, 0.28], sleeve, [0.65, 0, 0])}
      {typing > 0.01 ? (
        <group position={[0, 0, 0]} scale={[1, 1, 1]}>
          {box([-0.024, -0.07, -0.03], [0.07, 0.088, 0.034], skin)}
          {box([-0.05, -0.045, -0.008], [0.018, 0.08, 0.03], skin)}
          {box([-0.036, -0.05, 0.012 + tapL], [0.017, 0.048, 0.015], skin, [0, 0, -0.5])}
          {box([-0.045, -0.14, -0.17], [0.09, 0.09, 0.28], sleeve, [0.65, 0, 0.1])}
        </group>
      ) : null}
    </group>
  );
};

const SunLight: React.FC<{focus: Vec3; intensity: number}> = ({focus, intensity}) => {
  const target = useMemo(() => new THREE.Object3D(), []);
  target.position.set(...focus);
  target.updateMatrixWorld();
  return (
    <>
      <primitive object={target} />
      <directionalLight
        position={[focus[0] - 28, focus[1] + 46, focus[2] + 18]}
        target={target}
        intensity={intensity}
        color="#fff4e2"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
        shadow-camera-left={-38}
        shadow-camera-right={38}
        shadow-camera-top={38}
        shadow-camera-bottom={-38}
        shadow-camera-near={1}
        shadow-camera-far={140}
      />
    </>
  );
};

export const Stage: React.FC<{t: number}> = ({t}) => {
  const {cam, shot} = cameraAt(t);
  const screen = useMemo(() => new PhoneScreen(), []);
  const scene = useThree((s) => s.scene);
  const tex = screen.update(t);

  if (shot.set === 'black') {
    scene.background = new THREE.Color('#000000');
    scene.fog = null;
    scene.userData.set = 'black';
    return <CameraRig t={t} />;
  }

  const hero = heroState(t);
  const heroVisible = !shot.hideHero && !shot.phone && (shot.set === 'city' ? t < INTERIOR_START && !shot.mom && !shot.empty : t >= INTERIOR_START);

  if (shot.set === 'city') {
    const afterAlert = t > T.threat;
    if (!(scene.fog instanceof THREE.Fog) || scene.userData.set !== 'city') {
      scene.fog = new THREE.Fog(CITY_FOG.color, CITY_FOG.near, CITY_FOG.far);
      scene.background = new THREE.Color(CITY_FOG.color);
      scene.userData.set = 'city';
    }
    // focus of the shadow camera: the point the camera looks at, clamped near the ground
    const focus: Vec3 = [cam.look[0] * 0.5 + cam.pos[0] * 0.5, 0, cam.look[2] * 0.5 + cam.pos[2] * 0.5];
    const mom = shot.mom ? momState(t) : null;
    return (
      <>
        <CameraRig t={t} />
        <Sky top={afterAlert ? '#6a9fcf' : '#58a0e6'} bottom={afterAlert ? '#d9e2e6' : '#d4e7f3'} />
        <hemisphereLight args={['#d8ecff', '#7d7a68', afterAlert ? 1.05 : 1.2]} />
        <SunLight focus={focus} intensity={afterAlert ? 2.3 : 2.6} />
        {heroVisible ? <PhoneGlow t={t} /> : null}
        {shot.phone ? <PhoneInsert t={t} tex={tex} /> : null}
        <CityStatic />
        <CityDynamic t={t} empty={shot.empty} />
        {heroVisible ? (
          <Blocky position={hero.p} yaw={hero.yaw} pose={hero.pose} look={HERO_LOOK} expr={hero.expr} blink={hero.blink} gaze={hero.gaze} phone={hero.phone} phoneScreen={tex} phoneJitter={hero.phoneJitter} hideHead={shot.phone} />
        ) : null}
        {!shot.empty && !shot.mom
          ? NPCS.filter((n) => n.group === 'street' && npcVisible(n, t)).map((n) => {
              const s = npcState(n, t);
              return <Blocky key={n.id} position={s.p} yaw={s.yaw} pose={s.pose} look={n.look} expr={s.expr} blink={s.blink} gaze={s.gaze} phone={s.phone} />;
            })
          : null}
        {mom ? (
          <>
            <Blocky position={mom.p} yaw={mom.yaw} pose={mom.pose} look={MOM_LOOK} expr={mom.expr} blink={mom.blink} phone={mom.phone} />
            {NPCS.filter((n) => n.group === 'mom' && npcVisible(n, t)).map((n) => {
              const s = npcState(n, t);
              return <Blocky key={n.id} position={s.p} yaw={s.yaw} pose={s.pose} look={n.look} expr={s.expr} blink={s.blink} gaze={s.gaze} phone={s.phone} />;
            })}
          </>
        ) : null}
      </>
    );
  }

  // ---- interior ----
  if (scene.userData.set !== 'interior') {
    scene.fog = new THREE.Fog('#0b0d10', 8, 34);
    scene.background = new THREE.Color('#0b0d10');
    scene.userData.set = 'interior';
  }
  const inCorridor = t < 49.6;
  const flick = bulbFlicker(t);
  const phoneOut = hero.phone === 'torso';
  const surge = t > 77.2 ? Math.min(1, (t - 77.2) / 0.25) : 0;
  return (
    <>
      <CameraRig t={t} />
      <hemisphereLight args={['#aab6c4', '#3a3530', inCorridor ? 0.55 : 0.22 + surge * 4]} />
      {inCorridor ? (
        <>
          {[-2.2, -6.2, -10.2, -14.0].map((z) => (
            <pointLight key={z} position={[-1.0, 1.9, z]} color="#e4f1ff" intensity={5.5} distance={7} decay={1.4} />
          ))}
          <pointLight position={[0.4, 2.6, -16.5]} color="#ffe2b0" intensity={4} distance={8} decay={1.4} />
          <pointLight position={[0.3, -1.2, -22]} color="#ffcf8a" intensity={4} distance={8} decay={1.4} />
        </>
      ) : (
        <>
          <pointLight position={[0.2, -1.25, -29.2]} color="#ffcf8a" intensity={10 * flick} distance={14} decay={1.3} />
          <pointLight position={[-2.5, -1.5, -24.5]} color="#7d93b5" intensity={1.6} distance={9} decay={1.5} />
          {phoneOut && !shot.phone ? <PhoneGlow t={t} /> : null}
          {surge > 0 ? <pointLight position={[0.3, -1.5, -24]} color="#ffffff" intensity={60 * surge} distance={30} decay={1} /> : null}
        </>
      )}
      <InteriorStatic />
      <Bulb t={t} p={[0.2, -1.1, -29.2]} />
      {shot.phone ? <PhoneInsert t={t} tex={tex} /> : null}
      {t >= INTERIOR_START && !shot.phone ? (
        <Blocky position={hero.p} yaw={hero.yaw} pose={hero.pose} look={HERO_LOOK} expr={hero.expr} blink={hero.blink} gaze={hero.gaze} phone={hero.phone} phoneScreen={tex} phoneJitter={hero.phoneJitter} hideHead={shot.phone} castShadow={false} />
      ) : null}
      {NPCS.filter((n) => n.group === 'shelter').map((n) => {
        const s = npcState(n, t);
        return <Blocky key={n.id} position={s.p} yaw={s.yaw} pose={s.pose} look={n.look} expr={s.expr} blink={s.blink} castShadow={false} />;
      })}
    </>
  );
};
