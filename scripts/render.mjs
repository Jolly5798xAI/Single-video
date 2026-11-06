// Render driver.
//   node scripts/render.mjs --still 1.5,9,30     -> output/stills/*.png (seconds)
//   node scripts/render.mjs --test 25 35         -> output/test/test_25-35.mp4 (with audio)
//   node scripts/render.mjs                      -> output/nuclear_60s_final.mp4
import {bundle} from '@remotion/bundler';
import {renderMedia, renderStill, selectComposition} from '@remotion/renderer';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const args = process.argv.slice(2);
const BROWSER = process.env.CHROME_PATH || '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';
const concurrency = Number(process.env.CONCURRENCY || Math.max(1, os.cpus().length));

const serveUrl = await bundle({entryPoint: path.join(root, 'src/index.ts'), publicDir: path.join(root, 'assets')});
const common = {
  serveUrl,
  id: 'Main',
  browserExecutable: fs.existsSync(BROWSER) ? BROWSER : undefined,
  chromiumOptions: {gl: 'swangle'},
  timeoutInMilliseconds: 240000,
};
const debugCamEnv = process.env.DEBUG_CAM ? JSON.parse(process.env.DEBUG_CAM) : null;
const composition = await selectComposition({...common, inputProps: {withAudio: false, debugCam: debugCamEnv}});
const fps = composition.fps;
const mix = path.join(root, 'assets/audio/mix.wav');

const mux = (video, out, from = 0, dur = null) => {
  const a = ['-y', '-v', 'error', '-i', video, '-ss', String(from), ...(dur ? ['-t', String(dur)] : []), '-i', mix,
    '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-shortest', '-movflags', '+faststart', out];
  execFileSync('ffmpeg', a, {stdio: 'inherit'});
};

const debugCam = process.env.DEBUG_CAM ? JSON.parse(process.env.DEBUG_CAM) : null;
if (args[0] === '--still') {
  const dir = path.join(root, 'output/stills');
  fs.mkdirSync(dir, {recursive: true});
  for (const s of (args[1] || '1').split(',')) {
    const frame = Math.min(composition.durationInFrames - 1, Math.round(Number(s) * fps));
    const out = path.join(dir, `t${String(Number(s).toFixed(2)).padStart(6, '0')}.png`);
    const t0 = Date.now();
    await renderStill({...common, composition, frame, output: out, inputProps: {withAudio: false, debugCam}});
    console.log(`still ${s}s -> ${path.relative(root, out)} (${Date.now() - t0} ms)`);
  }
} else {
  const test = args[0] === '--test';
  const from = test ? Number(args[1] ?? 25) : 0;
  const to = test ? Number(args[2] ?? from + 6) : composition.durationInFrames / fps;
  const range = [Math.round(from * fps), Math.min(composition.durationInFrames, Math.round(to * fps)) - 1];
  const outDir = path.join(root, test ? 'output/test' : 'output');
  fs.mkdirSync(outDir, {recursive: true});
  const raw = path.join(outDir, test ? `raw_${from}-${to}.mp4` : 'render_video_only.tmp.mp4');
  const t0 = Date.now();
  let last = -1;
  await renderMedia({
    ...common, composition, codec: 'h264', crf: 17, pixelFormat: 'yuv420p', imageFormat: 'jpeg', jpegQuality: 94,
    outputLocation: raw, concurrency, muted: true, frameRange: range, inputProps: {withAudio: false},
    onProgress: ({progress}) => {
      const p = Math.floor(progress * 100);
      if (p !== last && p % 5 === 0) {
        last = p;
        const el = (Date.now() - t0) / 1000;
        console.log(`render ${p}%  elapsed ${el.toFixed(0)}s  eta ${(progress > 0 ? el / progress - el : 0).toFixed(0)}s`);
      }
    },
  });
  const out = path.join(outDir, test ? `test_${from}-${to}.mp4` : 'nuclear_60s_final.mp4');
  mux(raw, out, from, test ? to - from : null);
  fs.rmSync(raw);
  console.log(`done -> ${path.relative(root, out)} in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
