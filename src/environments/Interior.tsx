import React, {useMemo} from 'react';
import * as THREE from 'three';
import {CYL12, CYL6, mat, unlit} from '../components/materials';
import {shelterSignTexture, signTexture} from '../components/textures';
import {B} from './props';
import {Vec3} from '../animations/math';

// Corridor: x∈[-1.6,1.6], z∈[1,-16], floor y=0, ceiling y=3.0. Windows on the left (x=-1.6).
// Stairs: z∈[-16,-23.2] descending to y=-3.5. Basement: x∈[-4.3,4.15], z∈[-23.2,-35.5], y∈[-3.5,-0.6].
export const BASEMENT = {x0: -4.3, x1: 4.15, z0: -23.2, z1: -35.5, y0: -3.5, y1: -0.6};

const STEPS = 14;

function floorTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#8a6a50';
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#7a5b43';
  g.fillRect(0, 0, 64, 64);
  g.fillRect(64, 64, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3.2 / 1.2, 17 / 1.2);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export const InteriorStatic: React.FC = React.memo(() => {
  const floor = useMemo(floorTexture, []);
  const lowGreen = '#5d8a6c';
  const upWall = '#d7dccb';
  const concrete = '#8e908b';
  const windows = [-2.2, -6.2, -10.2, -14.0];
  const sign = shelterSignTexture();
  return (
    <group>
      {/* corridor floor & ceiling */}
      <mesh position={[0, 0, -7.5]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[3.2, 17]} />
        <meshStandardMaterial map={floor} roughness={0.8} />
      </mesh>
      <B p={[0, 3.05, -7.5]} s={[3.4, 0.1, 17.2]} c="#cfcabd" />
      {/* right wall (solid, with doors) */}
      <B p={[1.65, 0.6, -7.5]} s={[0.1, 1.2, 17]} c={lowGreen} />
      <B p={[1.65, 2.1, -7.5]} s={[0.1, 1.8, 17]} c={upWall} />
      {[-3.5, -9.0, -13.0].map((z) => (
        <group key={z}>
          <B p={[1.58, 1.05, z]} s={[0.06, 2.1, 1.0]} c="#6b4a33" />
          <B p={[1.54, 1.0, z - 0.35]} s={[0.04, 0.06, 0.14]} c="#d9c27a" />
        </group>
      ))}
      {/* left wall with bright windows */}
      <B p={[-1.65, 0.5, -7.5]} s={[0.1, 1.0, 17]} c={lowGreen} />
      <B p={[-1.65, 2.75, -7.5]} s={[0.1, 0.5, 17]} c={upWall} />
      {[0.4, -4.2, -8.2, -12.1, -15.6].map((z, i) => (
        <B key={i} p={[-1.65, 1.75, z]} s={[0.1, 1.5, i === 0 ? 1.2 : 1.4]} c={upWall} />
      ))}
      {windows.map((z) => (
        <group key={z}>
          <B p={[-1.7, 1.75, z]} s={[0.04, 1.5, 2.6]} m={unlit('#eaf6ff')} />
          <B p={[-1.64, 1.75, z]} s={[0.06, 1.5, 0.08]} c="#f0f0ea" />
          <B p={[-1.64, 1.75, z]} s={[0.06, 0.08, 2.6]} c="#f0f0ea" />
          <B p={[-1.5, 1.0, z]} s={[0.3, 0.06, 2.7]} c="#ecebe4" />
          {/* light patches on the floor */}
          <mesh position={[-0.7, 0.006, z - 0.3]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[1.6, 2.4]} />
            <meshBasicMaterial color="#fff6dd" transparent opacity={0.22} toneMapped={false} />
          </mesh>
        </group>
      ))}
      {/* entrance wall behind the hero (with door) */}
      <B p={[0, 1.5, 1.0]} s={[3.4, 3.0, 0.1]} c={upWall} />
      <B p={[0, 1.2, 0.94]} s={[1.6, 2.4, 0.06]} c="#4f5d55" />
      {/* ceiling lamps */}
      {[-1.5, -7, -12.5].map((z) => (
        <B key={z} p={[0, 2.97, z]} s={[0.5, 0.06, 1.2]} m={unlit('#fff4d6')} />
      ))}
      {/* posters / signs */}
      <mesh position={[1.59, 2.2, -6.2]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[0.9, 1.2]} />
        <meshStandardMaterial color="#d8c9a3" />
      </mesh>
      <mesh position={[0, 2.55, -15.9]}>
        <planeGeometry args={[1.8, 0.68]} />
        <meshStandardMaterial map={sign} emissive="#ffffff" emissiveMap={sign} emissiveIntensity={0.35} />
      </mesh>
      {/* stair well */}
      <B p={[0, 2.8, -16.05]} s={[3.4, 0.5, 0.1]} c={upWall} />
      {Array.from({length: STEPS}).map((_, i) => {
        const top = -((i + 0.5) * 3.5) / STEPS;
        const z = -16 - (i + 0.5) * (7.2 / STEPS);
        return <B key={i} p={[0.3, top - 0.125, z]} s={[2.6, 0.25, 7.2 / STEPS + 0.02]} c={i % 2 ? '#8b8d88' : '#93958f'} recv />;
      })}
      <B p={[1.65, -0.5, -19.6]} s={[0.1, 7, 7.4]} c={concrete} />
      <B p={[-1.05, -0.5, -19.6]} s={[0.1, 7, 7.4]} c={concrete} />
      {/* railing */}
      {Array.from({length: 5}).map((_, i) => (
        <B key={i} p={[-0.9, -i * 0.875 + 0.45, -16.6 - i * 1.6]} s={[0.05, 0.9, 0.05]} c="#2e3135" />
      ))}
      <B p={[-0.9, -1.25, -19.6]} s={[0.07, 0.07, 7.9]} r={[Math.atan2(3.5, 7.2), 0, 0]} c="#7a2a20" />
      {/* basement */}
      <B p={[0, BASEMENT.y0 - 0.05, -29.35]} s={[8.6, 0.1, 12.4]} c="#76786f" recv />
      <B p={[0, BASEMENT.y1 + 0.05, -29.35]} s={[8.6, 0.1, 12.4]} c="#6c6e69" />
      <B p={[BASEMENT.x1 + 0.05, -2.05, -29.35]} s={[0.1, 2.9, 12.4]} c={concrete} />
      <B p={[BASEMENT.x1 - 0.01, -2.95, -29.35]} s={[0.04, 1.1, 12.4]} c="#56685a" />
      <B p={[BASEMENT.x0 - 0.05, -2.05, -29.35]} s={[0.1, 2.9, 12.4]} c={concrete} />
      <B p={[BASEMENT.x0 + 0.01, -2.95, -29.35]} s={[0.04, 1.1, 12.4]} c="#56685a" />
      <B p={[0, -2.05, BASEMENT.z1 - 0.05]} s={[8.6, 2.9, 0.1]} c={concrete} />
      <B p={[-2.6, -2.05, BASEMENT.z0 + 0.05]} s={[3.4, 2.9, 0.1]} c={concrete} />
      <B p={[3.0, -2.05, BASEMENT.z0 + 0.05]} s={[2.3, 2.9, 0.1]} c={concrete} />
      {/* blast door on the back wall */}
      <B p={[1.5, -2.25, BASEMENT.z1 + 0.06]} s={[2.0, 2.2, 0.12]} c="#56635a" />
      <mesh geometry={CYL12} material={mat('#9a2b20')} position={[1.5, -2.25, BASEMENT.z1 + 0.18]} rotation={[Math.PI / 2, 0, 0]} scale={[0.7, 0.06, 0.7]} />
      {/* ceiling pipes */}
      {[-3.6, -2.9, 3.4].map((x, i) => (
        <mesh key={i} geometry={CYL6} material={mat(i === 2 ? '#7d4b33' : '#5e6a72')} position={[x, -0.85, -29.35]} rotation={[Math.PI / 2, 0, 0]} scale={[0.22, 12.3, 0.22]} />
      ))}
      {/* benches with crates / water */}
      <B p={[-3.85, -3.05, -28.5]} s={[0.55, 0.08, 4.0]} c="#7a5230" />
      <B p={[-3.85, -3.28, -27.0]} s={[0.45, 0.45, 0.08]} c="#3a3d40" />
      <B p={[-3.85, -3.28, -30.0]} s={[0.45, 0.45, 0.08]} c="#3a3d40" />
      <B p={[-3.85, -3.05, -33.4]} s={[0.55, 0.08, 2.4]} c="#7a5230" />
      {[[-3.4, -34.6], [-2.7, -34.8], [-3.6, -24.0]].map(([x, z], i) => (
        <B key={i} p={[x, -3.15, z]} s={[0.7, 0.7, 0.6]} c="#8a6b3c" cast />
      ))}
      <B p={[-3.4, -2.55, -34.6]} s={[0.6, 0.5, 0.5]} c="#7d5f33" />
      {Array.from({length: 6}).map((_, i) => (
        <mesh key={i} geometry={CYL6} material={mat('#5aa9d6', {rough: 0.3})} position={[-2.2 + (i % 3) * 0.24, -3.25, -34.9 + Math.floor(i / 3) * 0.26]} scale={[0.2, 0.5, 0.2]} />
      ))}
      <mesh position={[BASEMENT.x0 + 0.08, -1.7, -31.2]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[1.6, 0.6]} />
        <meshStandardMaterial map={signTexture('ВЫХОД', '#2e7d4f')} emissive="#ffffff" emissiveMap={signTexture('ВЫХОД', '#2e7d4f')} emissiveIntensity={0.6} />
      </mesh>
      <mesh position={[BASEMENT.x1 - 0.06, -1.6, -31.5]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[1.4, 0.53]} />
        <meshStandardMaterial map={sign} emissive="#ffffff" emissiveMap={sign} emissiveIntensity={0.2} />
      </mesh>
    </group>
  );
});

/** Hanging bulb with flicker. Returns light intensity factor too. */
export const bulbFlicker = (t: number) => {
  const f = Math.sin(t * 37) * Math.sin(t * 11.3) > 0.82 ? 0.45 : 1;
  const surge = t > 77.2 ? 1 + (t - 77.2) * 40 : 1;
  return f * surge;
};

export const Bulb: React.FC<{t: number; p: Vec3}> = ({t, p}) => {
  const k = bulbFlicker(t);
  return (
    <group position={p}>
      <B p={[0, 0.25, 0]} s={[0.02, 0.5, 0.02]} c="#222" />
      <mesh geometry={CYL6} material={unlit(k > 0.8 ? '#ffe7b0' : '#9a7d4a')} scale={[0.14, 0.18, 0.14]} />
    </group>
  );
};
