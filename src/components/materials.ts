import * as THREE from 'three';

// Shared geometry/material caches: every box in the film reuses one geometry,
// and every colour one material, which keeps draw setup cheap in SwiftShader.

export const BOX = new THREE.BoxGeometry(1, 1, 1);
export const PLANE = new THREE.PlaneGeometry(1, 1);
export const CYL6 = new THREE.CylinderGeometry(0.5, 0.5, 1, 6);
export const CYL12 = new THREE.CylinderGeometry(0.5, 0.5, 1, 12);
export const ICO = new THREE.IcosahedronGeometry(1, 0);
export const ICO1 = new THREE.IcosahedronGeometry(1, 1);
export const CONE4 = new THREE.ConeGeometry(1, 1, 4);

const cache = new Map<string, THREE.Material>();

export function mat(color: string, opts: {emissive?: string; ei?: number; rough?: number; flat?: boolean; transparent?: number} = {}) {
  const key = `${color}|${opts.emissive ?? ''}|${opts.ei ?? 0}|${opts.rough ?? 0.92}|${opts.flat ?? true}|${opts.transparent ?? 1}`;
  let m = cache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color,
      roughness: opts.rough ?? 0.92,
      metalness: 0,
      flatShading: opts.flat ?? true,
      emissive: opts.emissive ?? '#000000',
      emissiveIntensity: opts.ei ?? 0,
      transparent: (opts.transparent ?? 1) < 1,
      opacity: opts.transparent ?? 1,
    });
    cache.set(key, m);
  }
  return m;
}

const basicCache = new Map<string, THREE.Material>();
/** Unlit material (light panes, emissive glass, signs). */
export function unlit(color: string, opacity = 1) {
  const key = `${color}|${opacity}`;
  let m = basicCache.get(key);
  if (!m) {
    m = new THREE.MeshBasicMaterial({color, transparent: opacity < 1, opacity, toneMapped: false, fog: true});
    basicCache.set(key, m);
  }
  return m;
}
