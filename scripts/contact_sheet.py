"""Tile rendered stills into a contact sheet: python3 scripts/contact_sheet.py out.png [cols]"""
import glob, sys
from PIL import Image, ImageDraw
out = sys.argv[1]; cols = int(sys.argv[2]) if len(sys.argv) > 2 else 4
fs = sorted(glob.glob("output/stills/t*.png"))
w, h = 270, 480
rows = (len(fs) + cols - 1) // cols
W = Image.new("RGB", (w * cols, h * rows), "black")
for i, f in enumerate(fs):
    im = Image.open(f).convert("RGB").resize((w, h))
    ImageDraw.Draw(im).text((6, 6), f.split("/t")[-1][:-4] + "s", fill="yellow")
    W.paste(im, ((i % cols) * w, (i // cols) * h))
W.save(out)
