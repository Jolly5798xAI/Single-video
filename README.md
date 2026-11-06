# Что, если до ядерного взрыва осталось 60 секунд?

Вертикальный (9:16) low-poly 3D-ролик для TikTok / YouTube Shorts, полностью собираемый кодом:
**Remotion + React Three Fiber + Three.js (TypeScript)**, звук синтезируется на Python (numpy/scipy), сборка — FFmpeg.

Готовый файл: `output/nuclear_60s_final.mp4` — 1080×1920, 30 fps, H.264 + AAC, 87.0 с.

## Структура

```
assets/audio/       voiceover.mp3 (оригинал ElevenLabs, не изменяется), mix.wav (финальный микс)
assets/reference/   style-reference.jpg (стилевой референс)
assets/sfx/         синтезированные эффекты (можно заменить записями с тем же именем)
assets/music/       синтезированная музыка (calm_intro, tension_drone)
src/timeline/       transcript.json (слова + таймкоды), timeline.json (все тайминги), storyboard.md
src/subtitles/      subtitles.json (группы по 2–5 слов), Overlays.tsx (субтитры, таймер, титры, грейдинг)
src/characters/     Blocky.tsx (персонаж: кубическая голова, суставы, эмоции), phoneScreen.ts (экран телефона)
src/environments/   City.tsx (квартал), Interior.tsx (коридор, лестница, подвал), props.tsx (деревья, фонари, машины…)
src/animations/     math.ts (интерполяция, easing), pose.ts (ходьба/бег/позы)
src/scenes/         shots.ts (27 планов и камеры), hero.ts, npcs.ts, Stage.tsx
scripts/            transcribe.py, build_subtitles.py, build_audio.py, render.mjs, debug_views.sh, contact_sheet.py
output/             готовое видео
```

## Сборка

```bash
npm install
pip install faster-whisper scipy pillow

# 1. транскрипция (модель Whisper small в формате CTranslate2; путь к папке модели)
python3 scripts/transcribe.py /path/to/whisper-small-ct2
# 2. субтитры и звук
npm run subs
npm run audio
# 3. проверка: кадры / короткий фрагмент / полный рендер
node scripts/render.mjs --still 5,15,35
node scripts/render.mjs --test 28 36
npm run render
# превью в браузере
npm run studio
```

Рендер идёт в headless Chromium с WebGL на CPU (SwiftShader, `gl: swangle`); путь к браузеру — переменная `CHROME_PATH`.
На 4 ядрах ≈ 1 с на кадр (≈ 40–45 мин на ролик).

## Заметки

- Все анимации — чистые функции времени озвучки (детерминированный рендер в несколько потоков).
- Транскрипция: Whisper small (faster-whisper, словные таймкоды); 3 ошибки распознавания исправлены в тексте субтитров, таймкоды не менялись.
- Звук: только процедурный синтез, сторонних записей и музыки нет. Голос на 10–16 дБ громче фона, микс нормализован до −14 LUFS (true peak −1.5 dB).
- Remotion бесплатен для частных лиц и небольших компаний; для компаний крупнее нужна коммерческая лицензия Remotion.
