import * as THREE from 'three';

export const FONT_UI = 'Montserrat';
export const FONT_SIGN = 'Russo One';

const signCache = new Map<string, THREE.CanvasTexture>();

/** Shop / street sign texture. Drawn once (fonts are loaded before the scene mounts). */
export function signTexture(text: string, bg: string, fg = '#ffffff', w = 512, h = 128, border?: string) {
  const key = `${text}|${bg}|${fg}|${w}|${h}|${border}`;
  const hit = signCache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  if (border) {
    g.strokeStyle = border;
    g.lineWidth = h * 0.08;
    g.strokeRect(h * 0.06, h * 0.06, w - h * 0.12, h - h * 0.12);
  }
  g.fillStyle = fg;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  let size = h * 0.56;
  g.font = `${size}px "${FONT_SIGN}"`;
  while (g.measureText(text).width > w * 0.86 && size > 10) {
    size -= 2;
    g.font = `${size}px "${FONT_SIGN}"`;
  }
  g.fillText(text, w / 2, h / 2 + size * 0.04);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  signCache.set(key, tex);
  return tex;
}

/** Civil-defence style shelter sign: triangle in a circle + label. */
export function shelterSignTexture() {
  const key = '__shelter';
  const hit = signCache.get(key);
  if (hit) return hit;
  const w = 512;
  const h = 192;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  g.fillStyle = '#1f4fa3';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#f2a516';
  g.beginPath();
  g.arc(h / 2, h / 2, h * 0.38, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#1f4fa3';
  g.beginPath();
  g.moveTo(h / 2, h * 0.2);
  g.lineTo(h * 0.82, h * 0.74);
  g.lineTo(h * 0.18, h * 0.74);
  g.closePath();
  g.fill();
  g.fillStyle = '#ffffff';
  g.font = `${h * 0.34}px "${FONT_SIGN}"`;
  g.textBaseline = 'middle';
  g.fillText('УКРЫТИЕ', h * 0.98, h * 0.53);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  signCache.set(key, tex);
  return tex;
}

/** Clock face for the distant tower. */
export function clockTexture() {
  const key = '__clock';
  const hit = signCache.get(key);
  if (hit) return hit;
  const s = 256;
  const c = document.createElement('canvas');
  c.width = s;
  c.height = s;
  const g = c.getContext('2d')!;
  g.fillStyle = '#8f2a22';
  g.fillRect(0, 0, s, s);
  g.fillStyle = '#f3ecd8';
  g.beginPath();
  g.arc(s / 2, s / 2, s * 0.4, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#222';
  g.lineWidth = 8;
  g.stroke();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    g.fillStyle = '#222';
    g.fillRect(s / 2 + Math.cos(a) * s * 0.32 - 5, s / 2 + Math.sin(a) * s * 0.32 - 5, 10, 10);
  }
  g.lineWidth = 10;
  g.beginPath();
  g.moveTo(s / 2, s / 2);
  g.lineTo(s / 2 + s * 0.18, s / 2 - s * 0.1);
  g.moveTo(s / 2, s / 2);
  g.lineTo(s / 2 - s * 0.02, s / 2 - s * 0.3);
  g.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  signCache.set(key, tex);
  return tex;
}
