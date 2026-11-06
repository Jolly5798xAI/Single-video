"""Build subtitle groups (2-5 words) from the word-level transcript.

Fixes the few ASR mistakes (text only, timings stay from the model), groups words
at punctuation / pauses, and marks keywords for colour accents.
Output: src/subtitles/subtitles.json
"""
import json, re

SRC = "src/timeline/transcript.json"
OUT = "src/subtitles/subtitles.json"

# ASR corrections: (recognised word) -> replacement words (timing is split evenly)
FIX = {"неучебная": ["не", "учебная"], "ищите": ["ищете"], "токан": ["окон"], "смеется.": ["смеётся."]}

RED = {"угроза", "ядерного", "удара", "60", "50", "40", "30", "20", "10", "9", "8", "секунд", "тревога",
       "сирены", "учебная", "не"}
YELLOW = {"укройтесь", "укрытие", "здание", "сердце", "колотится", "мамы", "близким", "близкие", "внутрь",
          "дрожат", "одна", "минута", "окон", "небо", "бежать", "глаза", "порядке"}

words = []
for seg in json.load(open(SRC, encoding="utf-8"))["segments"]:
    for w in seg["words"]:
        txt = w["word"].strip()
        key = txt.lower()
        if key in FIX:
            parts = FIX[key]
            d = (w["end"] - w["start"]) / len(parts)
            for i, p in enumerate(parts):
                words.append({"w": p, "s": w["start"] + i * d, "e": w["start"] + (i + 1) * d})
        else:
            words.append({"w": txt, "s": w["start"], "e": w["end"]})

# merge "Кто -то" -> "Кто-то"
merged = []
for w in words:
    if w["w"].startswith("-") and merged:
        merged[-1]["w"] += w["w"]
        merged[-1]["e"] = w["e"]
    else:
        merged.append(dict(w))
words = merged

def accent(word, prev):
    k = re.sub(r"[^\wё-]", "", word.lower())
    if k in ("не",):
        return None  # handled with the next word
    if k in RED:
        return "red"
    if k in YELLOW:
        return "yellow"
    return None

groups, cur = [], []
for i, w in enumerate(words):
    cur.append(w)
    nxt = words[i + 1] if i + 1 < len(words) else None
    pause = (nxt["s"] - w["e"]) if nxt else 9
    strong = re.search(r"[.?!]$", w["w"]) is not None
    soft = re.search(r"[,:]$", w["w"]) is not None
    n = len(cur)
    # keep numbers with "секунд"
    glue = nxt is not None and nxt["w"].lower().startswith("секунд") and re.match(r"^\d+$", w["w"])
    weak = w["w"].lower() in ("и", "а", "но", "в", "у", "на", "от", "за", "ли", "бы", "об")
    if weak and nxt is not None:
        continue
    conj_next = nxt is not None and nxt["w"].lower() in ("и", "но", "а") and n >= 3
    if not glue and (conj_next or strong or n >= 4 or (soft and n >= 2) or pause > 0.45 or (n >= 3 and pause > 0.25)):
        groups.append(cur)
        cur = []
if cur:
    groups.append(cur)

out = []
for gi, g in enumerate(groups):
    items = []
    for j, w in enumerate(g):
        a = accent(w["w"], g[j - 1]["w"] if j else "")
        # "не учебная" both red
        if w["w"].lower() == "не" and j + 1 < len(g) and g[j + 1]["w"].lower().startswith("учебная"):
            a = "red"
        if w["w"].lower() == "не" and a is None:
            a = None
        items.append({"text": w["w"].upper(), "start": round(w["s"], 3), "end": round(w["e"], 3), "accent": a})
    start = max(0.0, g[0]["s"] - 0.06)
    nxt_start = groups[gi + 1][0]["s"] - 0.06 if gi + 1 < len(groups) else g[-1]["e"] + 1.2
    end = min(g[-1]["e"] + 0.6, nxt_start)
    out.append({"start": round(start, 3), "end": round(end, 3), "words": items})

json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
for g in out:
    print(f'{g["start"]:6.2f}-{g["end"]:6.2f}  ' + " ".join(w["text"] + ("*" if w["accent"] else "") for w in g["words"]))
