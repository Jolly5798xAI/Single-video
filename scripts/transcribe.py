"""Word-level transcription of the voiceover with faster-whisper.

Usage: python3 scripts/transcribe.py <model_dir> [audio] [out_json]
Model: Whisper small, CTranslate2 int8 (any faster-whisper compatible dir).
"""
import json, subprocess, sys
import numpy as np
from faster_whisper import WhisperModel

model_dir = sys.argv[1]
audio = sys.argv[2] if len(sys.argv) > 2 else "assets/audio/voiceover.mp3"
out = sys.argv[3] if len(sys.argv) > 3 else "src/timeline/transcript.json"

pcm = subprocess.run(["ffmpeg", "-v", "error", "-i", audio, "-ac", "1", "-ar", "16000", "-f", "s16le", "-"],
                     check=True, capture_output=True).stdout
samples = np.frombuffer(pcm, np.int16).astype(np.float32) / 32768.0
model = WhisperModel(model_dir, device="cpu", compute_type="int8")
segments, info = model.transcribe(samples, language="ru", word_timestamps=True, beam_size=5,
                                  vad_filter=False, condition_on_previous_text=True)
res = {"duration": info.duration, "language": info.language, "segments": []}
for s in segments:
    res["segments"].append({
        "start": round(s.start, 3), "end": round(s.end, 3), "text": s.text.strip(),
        "words": [{"word": w.word.strip(), "start": round(w.start, 3), "end": round(w.end, 3),
                   "prob": round(w.probability, 3)} for w in s.words],
    })
    print(f"[{s.start:6.2f}-{s.end:6.2f}] {s.text.strip()}", flush=True)
json.dump(res, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("saved", out)
