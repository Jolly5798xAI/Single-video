"""Procedural sound design + final mix.

Every effect and the music bed are synthesised here (numpy/scipy), so there are no
third-party rights issues. Each element is also exported to assets/sfx and assets/music,
so it can be swapped for a real recording with the same file name later.

Cue times come from src/timeline/timeline.json (same source as the visuals).
The voiceover is never edited: it is only placed at t=0 and gain-matched in the
final loudness normalisation (-14 LUFS, as used by TikTok / Shorts).

Output: assets/audio/mix.wav (48 kHz stereo, length = video duration)
"""
import json, math, os, subprocess, wave
import numpy as np
from scipy import signal

SR = 48000
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TL = json.load(open(os.path.join(ROOT, "src/timeline/timeline.json"), encoding="utf-8"))
T = TL["T"]
DUR = TL["duration"]
N = int(round(DUR * SR))
rng = np.random.default_rng(42)

SFX_DIR = os.path.join(ROOT, "assets/sfx")
MUS_DIR = os.path.join(ROOT, "assets/music")
os.makedirs(SFX_DIR, exist_ok=True)
os.makedirs(MUS_DIR, exist_ok=True)


# ----------------------------------------------------------------------------- utils
def db(x):
    return 10 ** (x / 20)


def t_axis(d):
    return np.arange(int(d * SR)) / SR


def noise(d):
    return rng.standard_normal(int(d * SR))


def filt(x, kind, f, order=4):
    sos = signal.butter(order, f, btype=kind, fs=SR, output="sos")
    return signal.sosfilt(sos, x)


def env_ad(n, a=0.005, d=0.2):
    t = np.arange(n) / SR
    e = np.minimum(1, t / max(a, 1e-4)) * np.exp(-np.maximum(0, t - a) / max(d, 1e-4))
    return e


def reverb(x, rt=1.2, mix=0.3, tone=3000):
    n = int(rt * SR)
    ir = rng.standard_normal(n) * np.exp(-np.arange(n) / SR * 6.9 / rt)
    ir = filt(ir, "low", tone, 2)
    ir /= np.sqrt(np.sum(ir ** 2)) + 1e-9
    wet = signal.fftconvolve(x, ir)[: len(x) + n]
    out = np.zeros(len(x) + n)
    out[: len(x)] += x * (1 - mix)
    out[: len(wet)] += wet * mix
    return out


def norm(x, peak=0.9):
    m = np.max(np.abs(x)) + 1e-9
    return x / m * peak


def save(path, x):
    x = np.clip(x, -1, 1)
    with wave.open(path, "wb") as w:
        w.setnchannels(1 if x.ndim == 1 else 2)
        w.setsampwidth(2)
        w.setframerate(SR)
        data = (x * 32767).astype(np.int16)
        w.writeframes(data.T.flatten().tobytes() if x.ndim == 2 else data.tobytes())


class Track:
    def __init__(self, name):
        self.name = name
        self.x = np.zeros(N + SR * 4)

    def add(self, sig, at, gain_db=0.0):
        i = int(round(at * SR))
        if i < 0:
            sig = sig[-i:]
            i = 0
        j = min(len(self.x), i + len(sig))
        self.x[i:j] += sig[: j - i] * db(gain_db)

    def envelope(self, pts):
        """piecewise-linear gain envelope [(t, gain_linear), ...]"""
        tt = np.arange(len(self.x)) / SR
        self.x *= np.interp(tt, [p[0] for p in pts], [p[1] for p in pts])

    @property
    def y(self):
        return self.x[:N]


# ----------------------------------------------------------------------------- elements
def footstep(hard=False, indoor=False):
    d = 0.18 if hard else 0.12
    n = noise(d)
    body = filt(n, "band", [90, 900 if hard else 600]) * env_ad(len(n), 0.002, 0.035 if hard else 0.025)
    click = filt(n, "high", 2500) * env_ad(len(n), 0.001, 0.008) * 0.4
    thump = np.sin(2 * np.pi * 70 * t_axis(d)) * env_ad(len(n), 0.002, 0.04) * (0.8 if hard else 0.4)
    x = body + click + thump
    if indoor:
        x = reverb(x, 0.9, 0.35, 2500)
    return norm(x, 0.8)


def phone_buzz(bursts=3):
    out = []
    for _ in range(bursts):
        tt = t_axis(0.38)
        b = signal.square(2 * np.pi * 165 * tt) * (0.6 + 0.4 * np.sin(2 * np.pi * 31 * tt))
        b = filt(b, "low", 900) * np.minimum(1, np.minimum(tt / 0.01, (0.38 - tt) / 0.02))
        out += [b, np.zeros(int(0.17 * SR))]
    return norm(np.concatenate(out), 0.8)


def alert_tone(d):
    tt = t_axis(d)
    tone = np.sin(2 * np.pi * 853 * tt) + np.sin(2 * np.pi * 960 * tt)
    gate = (np.floor(tt / 0.5) % 2 == 0).astype(float)
    gate = filt(gate, "low", 60, 2)
    x = filt(tone * gate, "band", [450, 4000])
    return norm(x, 0.7)


def siren(d):
    tt = t_axis(d)
    f = 330 + 290 * (0.5 - 0.5 * np.cos(2 * np.pi * tt / 7.0))
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) + 0.45 * np.sin(2 * ph) + 0.25 * np.sin(3 * ph) + 0.12 * np.sin(4 * ph)
    ph2 = 2 * np.pi * np.cumsum(f * 1.006) / SR  # second, slightly detuned siren far away
    x += 0.5 * (np.sin(ph2) + 0.3 * np.sin(2 * ph2))
    x = reverb(x, 2.6, 0.55, 3500)[: len(tt)]
    return norm(x, 0.8)


def heartbeat():
    def thump(f0, d, g):
        tt = t_axis(d)
        f = f0 * (1 + 0.6 * np.exp(-tt * 30))
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * env_ad(len(tt), 0.004, 0.07) * g
    beat = np.zeros(int(0.6 * SR))
    a = thump(52, 0.25, 1.0)
    b = thump(46, 0.25, 0.7)
    beat[: len(a)] += a
    k = int(0.27 * SR)
    beat[k : k + len(b)] += b
    return norm(filt(beat, "low", 180), 0.9)


def door_creak_slam():
    tt = t_axis(0.7)
    f = 420 + 180 * np.sin(2 * np.pi * 1.3 * tt)
    creak = signal.sawtooth(2 * np.pi * np.cumsum(f) / SR) * (0.5 + 0.5 * np.sin(2 * np.pi * 37 * tt))
    creak = filt(creak, "band", [500, 2500]) * np.minimum(1, tt / 0.05) * np.exp(-tt * 2.5) * 0.35
    return norm(reverb(creak, 0.8, 0.25), 0.6)


def door_slam():
    n = noise(0.6)
    x = filt(n, "low", 400) * env_ad(len(n), 0.002, 0.09)
    x += np.sin(2 * np.pi * 55 * t_axis(0.6)) * env_ad(len(n), 0.002, 0.15) * 0.8
    x += filt(n, "band", [1500, 4000]) * env_ad(len(n), 0.001, 0.02) * 0.4
    return norm(reverb(x, 1.6, 0.4, 2000), 0.95)


def tick():
    tt = t_axis(0.06)
    x = np.sin(2 * np.pi * 2100 * tt) * env_ad(len(tt), 0.0005, 0.008)
    x += filt(noise(0.06), "high", 3000) * env_ad(len(tt), 0.0005, 0.004) * 0.5
    return norm(x, 0.7)


def braam(d=3.2, root=55.0):
    tt = t_axis(d)
    x = np.zeros_like(tt)
    for f, g in ((root, 1.0), (root * 1.5, 0.6), (root * 2, 0.5), (root * 1.002, 0.8)):
        x += signal.sawtooth(2 * np.pi * f * tt) * g
    x = np.tanh(x * 1.6)
    cutoff = filt(x, "low", 900)
    sub = np.sin(2 * np.pi * (root / 2) * tt) * 1.2
    e = np.minimum(1, tt / 0.02) * np.exp(-tt * 1.3)
    out = (cutoff + sub) * e
    return norm(reverb(out, 2.5, 0.35, 1500)[: len(tt) + SR], 0.95)


def brake():
    tt = t_axis(0.9)
    f = 2600 - 600 * tt
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * (0.6 + 0.4 * np.sin(2 * np.pi * 23 * tt))
    x += filt(noise(0.9), "band", [1800, 3500]) * 0.5
    x *= np.minimum(1, tt / 0.05) * np.exp(-tt * 2.5)
    return norm(reverb(x, 1.5, 0.4), 0.6)


def horn(d=0.6):
    tt = t_axis(d)
    x = signal.square(2 * np.pi * 415 * tt) + signal.square(2 * np.pi * 520 * tt)
    x = filt(x, "low", 2500) * np.minimum(1, np.minimum(tt / 0.02, (d - tt) / 0.04))
    return norm(reverb(x, 1.8, 0.5), 0.5)


def whoosh(d=0.8, up=True):
    n = noise(d)
    tt = t_axis(d)
    e = np.sin(np.pi * tt / d) ** 2
    lo = filt(n, "band", [300, 1200]) * e
    hi = filt(n, "band", [1500, 5000]) * e * (tt / d if up else 1 - tt / d)
    return norm(lo + hi, 0.6)


def flutter(d=1.2):
    tt = t_axis(d)
    n = filt(noise(d), "band", [400, 2500])
    gate = (np.sin(2 * np.pi * 14 * tt) > 0.2).astype(float)
    return norm(n * gate * np.exp(-tt * 1.8), 0.5)


def chirp_bird():
    tt = t_axis(0.12)
    f = 3800 + 1600 * np.sin(np.pi * tt / 0.12)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * tt / 0.12) ** 2 * 0.3


def ambience(d, lp=900):
    n = noise(d)
    brown = np.cumsum(n)
    brown = filt(brown - np.mean(brown), "high", 30, 2)
    x = filt(brown, "low", lp) * 0.02 + filt(n, "band", [200, 1800]) * 0.06
    return norm(x, 0.6)


def calm_pad(d):
    tt = t_axis(d)
    x = np.zeros_like(tt)
    for f in (261.6, 329.6, 392.0, 493.9):
        x += np.sin(2 * np.pi * f * tt) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.3 * tt + f))
    # soft plucked arpeggio
    notes = [523.3, 659.3, 784.0, 659.3]
    for k in range(int(d / 0.5)):
        st = int(k * 0.5 * SR)
        f = notes[k % 4]
        pt = t_axis(0.6)
        p = np.sin(2 * np.pi * f * pt) * np.exp(-pt * 6) * 0.8
        x[st : st + len(p)] += p[: len(x) - st]
    return norm(filt(x, "low", 3000), 0.5)


def tension_drone(d):
    """Detuned saws in A minor; filter opens over time; pulse during the run."""
    tt = t_axis(d)
    x = np.zeros_like(tt)
    for f, g in ((55, 1), (55.3, 0.8), (82.4, 0.6), (110, 0.5), (110.4, 0.4), (130.8, 0.25)):
        x += signal.sawtooth(2 * np.pi * f * tt) * g
    # time-varying low-pass via block processing
    out = np.zeros_like(x)
    blk = SR // 10
    zi = None
    for i in range(0, len(x), blk):
        tc = i / SR
        fc = 220 + 900 * min(1, tc / d) ** 1.4
        sos = signal.butter(2, fc, "low", fs=SR, output="sos")
        if zi is None:
            zi = signal.sosfilt_zi(sos) * 0
        out[i : i + blk], zi = signal.sosfilt(sos, x[i : i + blk], zi=zi)
    return norm(out, 0.6)


def pulse_ostinato(d, bpm=128):
    tt = t_axis(d)
    step = 60 / bpm / 2
    x = np.zeros_like(tt)
    for k in range(int(d / step)):
        st = int(k * step * SR)
        pt = t_axis(step * 0.9)
        f = 55 if k % 8 not in (6, 7) else 65.4
        p = signal.sawtooth(2 * np.pi * f * pt) * np.exp(-pt * 9)
        x[st : st + len(p)] += p[: len(x) - st]
    return norm(filt(x, "low", 600), 0.6)


def tinnitus(d):
    tt = t_axis(d)
    return np.sin(2 * np.pi * 4200 * tt) * np.exp(-tt * 1.2) * 0.3


# ----------------------------------------------------------------------------- hero path → footsteps
def sample_path(keys, t):
    def ease(e, u):
        u = min(1, max(0, u))
        return {"in": u * u, "out": 1 - (1 - u) ** 2, "inout": u * u * (3 - 2 * u)}.get(e, u)
    if t <= keys[0]["t"]:
        return 0.0
    dist = 0.0
    for a, b in zip(keys, keys[1:]):
        L = math.dist(a["p"], b["p"])
        if t <= b["t"]:
            return dist + L * ease(b.get("e", "lin"), (t - a["t"]) / (b["t"] - a["t"]))
        dist += L
    return dist


def smooth01(x):
    x = min(1, max(0, x))
    return x * x * (3 - 2 * x)


def footstep_times(keys, t0, t1):
    """Mirror of src/animations/pose.ts gaitPhase: a step every half gait cycle."""
    dt = 1 / 240
    ph, out, t = 0.0, [], keys[0]["t"]
    prev = sample_path(keys, t)
    last_k = 0
    while t < keys[-1]["t"] + 0.5:
        t += dt
        d = sample_path(keys, t)
        speed = (d - prev) / dt
        r = smooth01((speed - 2.0) / 1.6)
        cyc = 1.45 + (3.1 - 1.45) * r
        ph += (d - prev) / cyc * 2 * math.pi
        prev = d
        k = int(ph // math.pi)
        if k > last_k:
            last_k = k
            if t0 <= t <= t1 and speed > 0.3:
                out.append((t, speed))
    return out


# ----------------------------------------------------------------------------- build
def main():
    tracks = {}

    def tr(name):
        tracks.setdefault(name, Track(name))
        return tracks[name]

    # export the element library
    lib = {
        "footstep_walk.wav": footstep(False), "footstep_run.wav": footstep(True), "footstep_indoor.wav": footstep(True, True),
        "phone_vibrate.wav": phone_buzz(3), "alert_tone.wav": alert_tone(3.0), "siren_loop.wav": siren(14.0),
        "heartbeat.wav": heartbeat(), "door_creak.wav": door_creak_slam(), "door_slam.wav": door_slam(), "tick.wav": tick(),
        "impact_braam.wav": braam(), "car_brake.wav": brake(), "car_horn.wav": horn(), "whoosh.wav": whoosh(),
        "pigeons_flutter.wav": flutter(), "city_ambience.wav": ambience(10.0),
    }
    for k, v in lib.items():
        save(os.path.join(SFX_DIR, k), v)

    # ---- ambience ----
    amb = tr("ambience")
    amb.add(ambience(DUR + 1), 0, -14)
    amb.envelope([(0, 0.9), (T["threat"], 0.9), (T["threat"] + 1, 0.6), (44.4, 0.6), (44.5, 0.0), (59.3, 0.0), (59.4, 0.35),
                  (63.25, 0.35), (63.35, 0.0), (74.25, 0.0), (74.35, 0.7), (77.2, 0.7), (77.45, 0.0), (DUR + 4, 0.0)])
    for tb in (0.8, 2.6, 4.3, 6.0):
        amb.add(chirp_bird(), tb, -16)
        amb.add(chirp_bird(), tb + 0.18, -18)
    for tc in (1.2, 4.6, 8.4):
        amb.add(whoosh(2.2), tc, -18)

    room = tr("room")
    tt = t_axis(DUR + 1)
    hum = (np.sin(2 * np.pi * 50 * tt) * 0.5 + np.sin(2 * np.pi * 100 * tt) * 0.25 + filt(noise(DUR + 1), "low", 300) * 0.4)
    room.add(norm(hum, 0.5), 0, -30)
    room.envelope([(0, 0), (44.4, 0), (44.5, 1), (59.3, 1), (59.4, 0), (63.25, 0), (63.35, 1), (74.25, 1), (74.35, 0), (77.2, 0),
                   (77.21, 1), (77.45, 1), (77.46, 0), (DUR + 4, 0)])

    # ---- hero footsteps ----
    fs = tr("foley")
    for t, sp in footstep_times(TL["heroCity"], 0.0, 44.2):
        hard = sp > 2.5
        g = -14 if hard else -22
        if 9.85 <= t < 13.6:
            continue
        fs.add(footstep(hard), t, g + rng.uniform(-2, 2))
    for t, sp in footstep_times(TL["heroInterior"], 44.45, 64.0):
        fs.add(footstep(sp > 2.5, True), t, (-13 if sp > 2.5 else -20) + rng.uniform(-2, 2))
    mom_keys = [{"t": 73.0, "p": [-7.0, 0.15, -132], "e": "lin"}, {"t": 74.0, "p": [-7.0, 0.15, -136.5], "e": "in"},
                {"t": 77.6, "p": [-7.2, 0.15, -153.0], "e": "lin"}]
    for t, sp in footstep_times(mom_keys, 74.3, 77.2):
        fs.add(footstep(True), t, -17)
    # crowd running on the street
    for k in range(60):
        t = 23.6 + rng.uniform(0, 20.5)
        if 29.0 < t < 43.2:
            fs.add(footstep(True), t, -27)
    for k in range(25):
        fs.add(footstep(True), 74.3 + rng.uniform(0, 2.9), -25)

    # ---- phone ----
    ph = tr("phone")
    ph.add(phone_buzz(4), T["screenRed"], -8)
    ph.add(alert_tone(4.4), T["screenRed"] + 0.05, -15)
    ph.add(phone_buzz(2), T["phoneBuzz"], -9)
    ph.add(tick() * 0.6, T["areYouOk"], -14)  # message pop
    typing = [54.05, 54.2, 54.35, 54.5, 54.62, 54.8, 54.98, 55.12, 55.3, 55.48, 55.66, 55.95, 56.35, 56.75, 57.15, 57.6]
    for t in typing:
        ph.add(tick() * 0.5, t, -22)
    fs.add(flutter(1.3), T["screenRed"] + 0.25, -17)

    # ---- sirens (dry outside / muffled inside) ----
    s_len = DUR - T["threat"]
    sir = siren(s_len)
    sir_out = Track("siren_out")
    sir_out.add(sir, T["threat"] + 0.4, -10)
    sir_out.envelope([(0, 0), (T["threat"] + 0.4, 0), (T["threat"] + 2.5, 1), (44.4, 1), (44.5, 0), (59.3, 0), (59.4, 0.45),
                      (63.25, 0.45), (63.35, 0), (74.25, 0), (74.35, 0.9), (77.2, 0.9), (77.45, 0), (DUR + 4, 0)])
    sir_in = Track("siren_in")
    sir_in.add(filt(sir, "low", 380), T["threat"] + 0.4, -12)
    sir_in.envelope([(0, 0), (44.4, 0), (44.5, 1), (59.3, 1.3), (59.4, 0), (63.25, 0), (63.35, 1), (70, 0.6), (74.25, 0.5), (74.35, 0),
                     (77.2, 0), (77.21, 0.5), (77.45, 0), (DUR + 4, 0)])
    tracks["siren_out"] = sir_out
    tracks["siren_in"] = sir_in

    # ---- street events ----
    ev = tr("events")
    for tb in (11.5, 12.0, 12.5, 13.0, 14.0, 15.2):
        ev.add(brake(), tb, -20 + rng.uniform(-3, 0))
    ev.add(horn(0.7), 15.6, -18)
    ev.add(horn(0.4), 23.1, -20)
    ev.add(horn(0.9), 33.8, -21)
    ev.add(door_creak_slam(), T["runInside"] + 0.15, -14)
    ev.add(door_slam(), 44.42, -9)

    # ---- heartbeat ----
    hb = tr("heart")
    hbs = heartbeat()
    t = T["heart"] - 0.2
    while t < 43.3:
        hb.add(hbs, t, -9)
        t += 60 / 140
    t = 49.9
    while t < 63.3:
        hb.add(hbs, t, -17)
        t += 60 / 112
    t = 63.4
    while t < 77.4:
        prog = (t - 63.4) / 14
        hb.add(hbs, t, -13 + 7 * prog)
        t += 60 / (105 + 20 * prog)

    # ---- timer ticks & impacts ----
    tk = tr("ticks")
    keys = TL["timerKeys"]

    def timer(t):
        return np.interp(t, [k[0] for k in keys], [k[1] for k in keys])
    prev = None
    for i in range(int(57.6 * 100), int(T["blackout"] * 100)):
        tt_ = i / 100
        v = math.ceil(timer(tt_) - 1e-4)
        if prev is not None and v != prev:
            tk.add(tick(), tt_, -12 if v <= 10 else -20)
        prev = v
    im = tr("impacts")
    for t, g, root in ((T["threat"], -4, 49.0), (T["sixty"], -8, 55.0), (T["fifty"], -10, 55.0), (T["forty"], -10, 58.3),
                       (T["thirty"], -9, 61.7), (T["twenty"], -8, 65.4), (T["ten"], -9, 49.0)):
        im.add(braam(3.2, root), t - 0.03, g)
    for t in (59.35 - 0.4, 63.3 - 0.3, 74.3 - 0.4, 44.45 - 0.35):
        im.add(whoosh(0.7), t, -16)
    # surge & cut to silence at the blackout
    sd = T["blackout"] - 76.6
    st = t_axis(sd)
    surge = filt(noise(sd), "low", 200) * (st / sd) ** 2 * 1.2 + filt(noise(sd), "band", [800, 6000]) * (st / sd) ** 3 * 0.6
    im.add(norm(surge, 0.95), 76.6, -3)
    im.add(tinnitus(3.5), T["blackout"] + 0.05, -26)

    # ---- music ----
    mu = tr("music")
    mu.add(calm_pad(7.4), 0, -21)
    mu.envelope([(0, 0), (0.6, 1), (T["screenRed"], 1), (T["screenRed"] + 0.15, 0), (DUR + 4, 0)])
    dr = Track("drone")
    dr.add(tension_drone(T["blackout"] - T["threat"]), T["threat"], -15)
    dr.envelope([(0, 0), (T["threat"], 0), (T["threat"] + 1.5, 0.7), (29, 0.8), (44, 1.0), (49.8, 0.65), (63.3, 0.75), (77.2, 1.2),
                 (T["blackout"] - 0.005, 1.2), (T["blackout"], 0), (DUR + 4, 0)])
    tracks["drone"] = dr
    po = Track("pulse")
    po.add(pulse_ostinato(44.45 - T["fifty"]), T["fifty"], -17)
    po.add(pulse_ostinato(T["blackout"] - T["ten"], 100), T["ten"], -19)
    po.envelope([(0, 0), (T["fifty"], 0), (T["fifty"] + 0.5, 1), (44.3, 1), (44.5, 0), (T["ten"], 0), (T["ten"] + 0.3, 0.8),
                 (T["blackout"] - 0.005, 1), (T["blackout"], 0), (DUR + 4, 0)])
    tracks["pulse"] = po
    fin = Track("final_pad")
    fd = DUR - T["nowAnswer"] + 0.5
    ft = t_axis(fd)
    pad = sum(np.sin(2 * np.pi * f * ft) * g for f, g in ((55, 0.6), (110, 0.3), (164.8, 0.2), (220, 0.15), (659.3, 0.05)))
    pad *= np.minimum(1, ft / 1.5) * np.minimum(1, np.maximum(0, (fd - 0.3 - ft)) / 1.5)
    fin.add(norm(pad, 0.5), T["nowAnswer"] - 0.2, -20)
    fin.add(braam(3.0, 41.2), T["whatWouldYou"] - 0.02, -14)
    tracks["final_pad"] = fin

    save(os.path.join(MUS_DIR, "calm_intro.wav"), calm_pad(7.4))
    save(os.path.join(MUS_DIR, "tension_drone.wav"), tension_drone(20))

    # ---- voice ----
    vo_path = os.path.join(ROOT, "assets/audio/voiceover.mp3")
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", vo_path, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                         check=True, capture_output=True).stdout
    vo = np.frombuffer(raw, np.float32).astype(np.float64)
    voice = np.zeros(N)
    voice[: min(N, len(vo))] = vo[:N]

    # ---- ducking: sidechain the bed under the voice ----
    env = np.sqrt(signal.lfilter([1], [1, -0.999], voice ** 2) * 0.001 + 1e-12)
    env = filt(env, "low", 4, 2)
    duck = 1 - 0.65 * np.clip(env / (np.percentile(env, 90) + 1e-9), 0, 1)

    bed = np.zeros(N)
    stems = {}
    for k, v in tracks.items():
        stems[k] = v.y
        bed += v.y * (duck if k not in ("impacts", "heart") else 0.4 + 0.6 * duck)
    # stereo: bed slightly widened (Haas on ambience/siren), voice centred
    wide = tracks["ambience"].y + tracks["siren_out"].y * 0.6
    d = int(0.012 * SR)
    bed *= db(-7.5)  # keep the narration clearly on top (>= ~8-10 dB)
    L = bed + voice
    R = bed + voice
    R[d:] += (wide[:-d] - wide[d:]) * 0.0  # keep mono-compatible
    L += wide * 0.08 * duck * db(-7.5)
    R[d:] += wide[:-d] * 0.08 * duck[d:] * db(-7.5)
    mix = np.stack([L, R])
    mix /= max(1.0, np.max(np.abs(mix)) / 0.97)
    tmp = os.path.join(ROOT, "assets/audio/mix_premaster.wav")
    save(tmp, mix)

    # loudness normalisation (two-pass, linear: a pure gain change)
    out = os.path.join(ROOT, "assets/audio/mix.wav")
    p = subprocess.run(["ffmpeg", "-hide_banner", "-i", tmp, "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"],
                       capture_output=True, text=True)
    js = json.loads(p.stderr[p.stderr.rfind("{"):])
    af = (f"loudnorm=I=-14:TP=-1.5:LRA=11:measured_I={js['input_i']}:measured_TP={js['input_tp']}:"
          f"measured_LRA={js['input_lra']}:measured_thresh={js['input_thresh']}:offset={js['target_offset']}:linear=true")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", tmp, "-af", af, "-ar", str(SR), "-t", str(DUR), out], check=True)
    os.remove(tmp)
    print("measured input:", js["input_i"], "LUFS ->", out)
    print("stems:", ", ".join(sorted(stems)))


if __name__ == "__main__":
    main()
