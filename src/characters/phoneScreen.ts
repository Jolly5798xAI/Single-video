import * as THREE from 'three';
import {FONT_UI} from '../components/textures';
import TL from '../timeline/timeline.json';

const T = TL.T;
const W = 400;
const H = 820;

// Typing sequence with a typo (shaking hands): [time, text]
const TYPING: [number, string][] = [
  [54.05, 'М'], [54.2, 'Ма'], [54.35, 'Мам'], [54.5, 'Мам,'], [54.62, 'Мам, '], [54.8, 'Мам, я'],
  [54.98, 'Мам, я '], [55.12, 'Мам, я в'], [55.3, 'Мам, я в '], [55.48, 'Мам, я в п'], [55.66, 'Мам, я в по'],
  [55.95, 'Мам, я в поь'], [56.35, 'Мам, я в по'], [56.75, 'Мам, я в под'], [57.15, 'Мам, я в подв'],
  [57.6, 'Мам, я в подва'], [58.3, 'Мам, я в подвал'], [58.9, 'Мам, я в подвале'], [60.2, 'Мам, я в подвале.'],
  [61.0, 'Мам, я в подвале. Я'], [61.6, 'Мам, я в подвале. Я тебя'],
];

export const typedText = (t: number) => {
  let s = '';
  for (const [tt, txt] of TYPING) if (t >= tt) s = txt;
  return s;
};

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function statusBar(g: CanvasRenderingContext2D, t: number, light = true) {
  g.fillStyle = light ? '#ffffff' : '#111';
  g.font = `700 26px "${FONT_UI}"`;
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  const minutes = 32 + Math.floor((t + 20) / 60);
  g.fillText(`14:${String(minutes).padStart(2, '0')}`, 30, 34);
  g.textAlign = 'right';
  g.fillText('87%', W - 30, 34);
}

function drawFeed(g: CanvasRenderingContext2D, t: number) {
  g.fillStyle = '#10131a';
  g.fillRect(0, 0, W, H);
  statusBar(g, t);
  // scrolling feed of cards
  const scroll = (t * 60) % 300;
  const colors = ['#f2b33d', '#5fb7e5', '#7ac46b', '#e8746a', '#b18be0'];
  for (let i = 0; i < 5; i++) {
    const y = 80 + i * 300 - scroll;
    g.fillStyle = '#1d222d';
    roundRect(g, 20, y, W - 40, 280, 22);
    g.fill();
    g.fillStyle = colors[i % colors.length];
    roundRect(g, 34, y + 14, W - 68, 170, 16);
    g.fill();
    // little blocky "photo" content
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.fillRect(60, y + 90, 60, 80);
    g.fillRect(140, y + 60, 50, 110);
    g.fillRect(210, y + 100, 90, 70);
    g.fillStyle = '#c9ced8';
    g.fillRect(40, y + 200, 220, 18);
    g.fillStyle = '#7d8594';
    g.fillRect(40, y + 230, 150, 14);
    g.fillStyle = '#e8746a';
    g.beginPath();
    g.arc(W - 70, y + 236, 14, 0, Math.PI * 2);
    g.fill();
  }
}

function wrap(g: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (g.measureText(test).width > maxW && line) {
      g.fillText(line, x, yy);
      line = w;
      yy += lh;
    } else line = test;
  }
  if (line) g.fillText(line, x, yy);
  lastLineWidth = g.measureText(line).width;
  return yy;
}
let lastLineWidth = 0;

function drawAlert(g: CanvasRenderingContext2D, t: number) {
  const flash = Math.floor((t - T.screenRed) * 2.2) % 2 === 0;
  g.fillStyle = flash ? '#d0161d' : '#9c0f14';
  g.fillRect(0, 0, W, H);
  statusBar(g, t);
  // warning triangle
  const cx = W / 2;
  g.fillStyle = '#ffd400';
  g.beginPath();
  g.moveTo(cx, 120);
  g.lineTo(cx + 95, 285);
  g.lineTo(cx - 95, 285);
  g.closePath();
  g.fill();
  g.fillStyle = '#1b1b1b';
  g.fillRect(cx - 10, 170, 20, 70);
  g.fillRect(cx - 10, 252, 20, 20);
  g.fillStyle = '#ffffff';
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  g.font = `800 24px "${FONT_UI}"`;
  g.fillText('ЭКСТРЕННОЕ ОПОВЕЩЕНИЕ', cx, 345);
  g.font = `900 46px "${FONT_UI}"`;
  g.fillText('УГРОЗА', cx, 430);
  g.fillText('ЯДЕРНОГО', cx, 485);
  g.fillText('УДАРА', cx, 540);
  g.font = `600 25px "${FONT_UI}"`;
  wrap(g, 'Немедленно пройдите в ближайшее укрытие. Держитесь дальше от окон.', cx, 610, W - 70, 34);
  g.fillStyle = 'rgba(255,255,255,0.92)';
  roundRect(g, 40, H - 120, W - 80, 70, 35);
  g.fill();
  g.fillStyle = '#b10f15';
  g.font = `800 26px "${FONT_UI}"`;
  g.fillText('ПОНЯТНО', cx, H - 76);
}

function drawChat(g: CanvasRenderingContext2D, t: number) {
  g.fillStyle = '#0e1621';
  g.fillRect(0, 0, W, H);
  statusBar(g, t);
  // header
  g.fillStyle = '#17212b';
  g.fillRect(0, 60, W, 90);
  g.fillStyle = '#e9a0b8';
  g.beginPath();
  g.arc(60, 105, 30, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#ffffff';
  g.font = `800 30px "${FONT_UI}"`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('М', 60, 106);
  g.textAlign = 'left';
  g.font = `800 30px "${FONT_UI}"`;
  g.fillText('Мама', 110, 94);
  g.fillStyle = '#6fb3f0';
  g.font = `500 21px "${FONT_UI}"`;
  g.fillText(t < T.areYouOk ? 'печатает…' : 'в сети', 110, 124);

  // message bubble
  if (t >= T.areYouOk - 0.05) {
    const pop = Math.min(1, (t - (T.areYouOk - 0.05)) / 0.18);
    const s = 0.6 + 0.4 * pop;
    g.save();
    g.translate(30, 200);
    g.scale(s, s);
    g.fillStyle = '#2b5278';
    g.fillStyle = '#182533';
    roundRect(g, 0, 0, 300, 96, 26);
    g.fill();
    g.fillStyle = '#ffffff';
    g.font = `700 36px "${FONT_UI}"`;
    g.fillText('Ты в порядке?', 22, 42);
    g.fillStyle = '#7f91a4';
    g.font = `500 18px "${FONT_UI}"`;
    g.fillText('14:33', 230, 78);
    g.restore();
  }
  // input field
  const txt = typedText(t);
  g.fillStyle = '#17212b';
  g.fillRect(0, H - 150, W, 150);
  g.fillStyle = '#242f3d';
  roundRect(g, 18, H - 135, W - 36, 110, 28);
  g.fill();
  g.font = `600 27px "${FONT_UI}"`;
  g.textBaseline = 'alphabetic';
  if (txt) {
    g.fillStyle = '#ffffff';
    const lastY = wrap(g, txt, 40, H - 92, W - 90, 34);
    const cursorOn = Math.floor(t * 2.5) % 2 === 0;
    if (cursorOn) {
      g.fillStyle = '#6fb3f0';
      g.fillRect(40 + lastLineWidth + 4, lastY - 24, 3, 30);
    }
  } else {
    g.fillStyle = '#6d7883';
    g.fillText('Сообщение', 40, H - 70);
  }
  // keyboard hint (blocky keys)
  if (t >= T.startTyping) {
    g.fillStyle = '#1f2833';
    g.fillRect(0, H - 150 - 230, W, 230);
    g.fillStyle = '#3a4757';
    for (let r = 0; r < 4; r++) {
      for (let k = 0; k < 10; k++) {
        if (r === 3 && (k < 2 || k > 7)) continue;
        g.fillRect(10 + k * 38.5, H - 370 + r * 54, 32, 44);
      }
    }
  }
}

function drawNotification(g: CanvasRenderingContext2D, t: number) {
  drawAlert(g, t);
  const k = Math.min(1, (t - T.phoneBuzz) / 0.25);
  const y = -140 + 200 * k;
  g.fillStyle = 'rgba(245,245,247,0.97)';
  roundRect(g, 16, y, W - 32, 120, 24);
  g.fill();
  g.fillStyle = '#e9a0b8';
  g.beginPath();
  g.arc(64, y + 60, 30, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#111';
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  g.font = `800 28px "${FONT_UI}"`;
  g.fillText('Мама', 110, y + 42);
  g.font = `500 24px "${FONT_UI}"`;
  g.fillStyle = '#333';
  g.fillText('Новое сообщение', 110, y + 80);
}

export type ScreenMode = 'feed' | 'alert' | 'notify' | 'chat';
export const screenMode = (t: number): ScreenMode =>
  t < T.screenRed ? 'feed' : t < T.phoneBuzz ? 'alert' : t < T.areYouOk - 1.0 ? 'notify' : 'chat';

export class PhoneScreen {
  canvas: HTMLCanvasElement;
  texture: THREE.CanvasTexture;
  private last = '';
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = W;
    this.canvas.height = H;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;
  }
  update(t: number) {
    const mode = screenMode(t);
    // quantise to frames so the texture only re-uploads when content changes
    const q = Math.round(t * 30);
    const key = mode === 'feed' ? `f${q}` : mode === 'alert' ? `a${Math.floor((t - T.screenRed) * 2.2)}|${Math.floor(t / 60)}` : `${mode}${q}`;
    if (key === this.last) return this.texture;
    this.last = key;
    const g = this.canvas.getContext('2d')!;
    g.save();
    if (mode === 'feed') drawFeed(g, t);
    else if (mode === 'alert') drawAlert(g, t);
    else if (mode === 'notify') drawNotification(g, t);
    else drawChat(g, t);
    g.restore();
    this.texture.needsUpdate = true;
    return this.texture;
  }
}
