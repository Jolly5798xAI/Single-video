import React from 'react';
import {AbsoluteFill} from 'remotion';
import SUBS from './subtitles.json';
import TL from '../timeline/timeline.json';
import {clamp, pl, ramp, smooth} from '../animations/math';
import {FONT_SIGN, FONT_UI} from '../components/textures';
import {Shot} from '../scenes/shots';

const T = TL.T;
const RED = '#ff3b30';
const YELLOW = '#ffd60a';

type Word = {text: string; start: number; end: number; accent: string | null};
type Group = {start: number; end: number; words: Word[]};

const strokeText = (px: number): React.CSSProperties => ({
  WebkitTextStroke: `${px}px #000`,
  paintOrder: 'stroke fill',
  textShadow: '0 6px 0 rgba(0,0,0,0.55), 0 0 24px rgba(0,0,0,0.35)',
});

export const Subtitles: React.FC<{t: number; low?: boolean}> = ({t, low}) => {
  const g = (SUBS as Group[]).find((s) => t >= s.start && t < s.end);
  if (!g) return null;
  const inK = smooth((t - g.start) / 0.14);
  const outK = 1 - smooth((t - (g.end - 0.1)) / 0.1);
  const scale = 0.86 + 0.14 * inK;
  const finalPart = t > T.blackout;
  return (
    <div
      style={{
        position: 'absolute', left: 70, right: 70, top: finalPart ? 1080 : low ? 1340 : 1150, display: 'flex', justifyContent: 'center',
        flexWrap: 'wrap', columnGap: 34, rowGap: 0, transform: `scale(${scale})`, opacity: inK * outK, transformOrigin: '50% 50%',
      }}
    >
      {g.words.map((w, i) => {
        const active = t >= w.start - 0.03 && t < w.end + 0.05;
        const said = t >= w.start - 0.03;
        const color = w.accent === 'red' ? RED : w.accent === 'yellow' ? YELLOW : '#ffffff';
        return (
          <span
            key={i}
            style={{
              fontFamily: FONT_UI, fontWeight: 900, fontSize: 86, lineHeight: 1.12, color, letterSpacing: 1,
              display: 'inline-block', transform: `scale(${active ? 1.05 : 1})`, opacity: said ? 1 : 0.62,
              ...strokeText(12),
            }}
          >
            {w.text}
          </span>
        );
      })}
    </div>
  );
};

export const Timer: React.FC<{t: number; compact?: boolean}> = ({t, compact}) => {
  if (t < T.sixty - 0.05 || t >= T.blackout) return null;
  const v = pl(TL.timerKeys, t);
  const shown = Math.max(0, Math.ceil(v - 1e-4));
  // time since the displayed number changed (for the pulse)
  let since = 10;
  for (let k = 1; k < 60; k++) {
    const tt = t - k / 30;
    if (Math.max(0, Math.ceil(pl(TL.timerKeys, tt) - 1e-4)) !== shown || tt < T.sixty - 0.05) {
      since = (k - 1) / 30;
      break;
    }
  }
  const appear = smooth((t - (T.sixty - 0.05)) / 0.2);
  const urgent = shown <= 10;
  const pulse = 1 + (urgent ? 0.22 : 0.08) * Math.exp(-since * 7);
  const bg = shown <= 30 ? 'rgba(200,16,22,0.92)' : 'rgba(15,17,22,0.78)';
  const label = `00:${String(shown).padStart(2, '0')}`;
  return (
    <div style={{position: 'absolute', top: compact ? 175 : urgent ? 250 : 270, left: 0, right: 0, display: 'flex', justifyContent: 'center', opacity: appear}}>
      <div
        style={{
          transform: `scale(${(0.6 + 0.4 * appear) * pulse * (urgent ? 1.25 : 1) * (compact ? 0.72 : 1)})`, background: bg, borderRadius: 30,
          padding: '10px 38px 14px', display: 'flex', alignItems: 'center', gap: 22,
          boxShadow: urgent ? '0 0 60px rgba(255,40,40,0.75)' : '0 10px 30px rgba(0,0,0,0.4)',
          border: '4px solid rgba(255,255,255,0.85)',
        }}
      >
        <div style={{width: 30, height: 30, borderRadius: 15, background: Math.floor(t * 2) % 2 ? '#ff453a' : '#ffffff'}} />
        <span style={{fontFamily: FONT_SIGN, fontSize: 92, color: '#fff', letterSpacing: 4, lineHeight: 1}}>{label}</span>
      </div>
    </div>
  );
};

export const HookTitle: React.FC<{t: number}> = ({t}) => {
  if (t > 6.5) return null;
  const lines: {w: string; c?: string}[][] = [
    [{w: 'ЧТО,'}, {w: 'ЕСЛИ'}, {w: 'ДО'}],
    [{w: 'ЯДЕРНОГО', c: YELLOW}, {w: 'ВЗРЫВА', c: YELLOW}],
    [{w: 'ОСТАЛОСЬ'}],
    [{w: '60', c: RED}, {w: 'СЕКУНД?', c: RED}],
  ];
  const out = 1 - smooth((t - 6.0) / 0.4);
  let idx = 0;
  return (
    <div style={{position: 'absolute', top: 300, left: 40, right: 40, textAlign: 'center', opacity: out}}>
      {lines.map((line, li) => (
        <div key={li} style={{display: 'flex', justifyContent: 'center', gap: 24}}>
          {line.map((w) => {
            const k = smooth((t - 0.15 - idx++ * 0.12) / 0.25);
            return (
              <span
                key={w.w}
                style={{
                  fontFamily: FONT_SIGN, fontSize: li === 3 ? 132 : 96, color: w.c ?? '#fff', lineHeight: 1.08,
                  display: 'inline-block', transform: `translateY(${(1 - k) * 40}px) scale(${0.8 + 0.2 * k})`, opacity: k,
                  ...strokeText(12),
                }}
              >
                {w.w}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
};

export const FinalTitle: React.FC<{t: number}> = ({t}) => {
  if (t < T.ifYouHad - 0.1) return null;
  const k = smooth((t - (T.ifYouHad - 0.1)) / 0.5);
  const hit = Math.exp(-Math.max(0, t - T.whatWouldYou) * 5) * (t > T.whatWouldYou ? 1 : 0);
  return (
    <div style={{position: 'absolute', top: 560, left: 50, right: 50, textAlign: 'center', opacity: k, transform: `scale(${(0.9 + 0.1 * k) * (1 + 0.08 * hit)})`}}>
      <div style={{fontFamily: FONT_SIGN, fontSize: 128, color: '#fff', lineHeight: 1.1, ...strokeText(10)}}>
        А ЧТО БЫ
        <br />
        СДЕЛАЛ <span style={{color: RED}}>ТЫ?</span>
      </div>
    </div>
  );
};

/** Colour grading, vignette, siren pulse, dips to black and the final flash. */
export const Grade: React.FC<{t: number; shot: Shot}> = ({t, shot}) => {
  const exterior = shot.set === 'city' && !shot.mom;
  const siren = exterior && t > T.threat + 0.4 && t < 44.45 ? 0.5 + 0.5 * Math.sin((t - T.threat) * Math.PI * 2 / 2.4) : 0;
  const sirenAmp = exterior ? (shot.empty ? 0.18 : 0.26) * ramp(t, T.threat, T.threat + 1.5) : 0;
  const dips = [59.35, 63.3, 74.3];
  let dip = 0;
  for (const c of dips) dip = Math.max(dip, 1 - Math.abs(t - c) / 0.14);
  const flash = t > 77.22 && t < T.blackout ? clamp((t - 77.22) / 0.18) : 0;
  const vignette = shot.set === 'interior' ? 0.62 : shot.mom ? 0.55 : 0.32;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <AbsoluteFill style={{background: `radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 45%, rgba(0,0,0,${vignette}) 100%)`}} />
      {siren > 0 || shot.empty ? (
        <AbsoluteFill style={{background: `radial-gradient(ellipse at 50% 50%, rgba(255,0,0,0) 35%, rgba(230,20,20,${(siren * sirenAmp + (shot.empty ? 0.06 : 0)).toFixed(3)}) 100%)`}} />
      ) : null}
      {shot.mom ? <AbsoluteFill style={{background: 'rgba(255,236,210,0.08)'}} /> : null}
      {dip > 0 ? <AbsoluteFill style={{background: `rgba(0,0,0,${clamp(dip)})`}} /> : null}
      {flash > 0 ? <AbsoluteFill style={{background: `rgba(255,255,255,${flash})`}} /> : null}
    </AbsoluteFill>
  );
};

export const canvasFilter = (t: number, shot: Shot) => {
  if (shot.mom) return 'saturate(0.5) sepia(0.2) contrast(1.05) brightness(0.96)';
  if (shot.set === 'interior') return 'saturate(0.88) contrast(1.08)';
  if (t > T.threat) return 'saturate(0.86) contrast(1.06)';
  return 'saturate(1.05)';
};
