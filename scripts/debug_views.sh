#!/usr/bin/env bash
# Renders the hero from the side and the front at a given time (pose debugging).
# usage: scripts/debug_views.sh <seconds> <out.png>
set -e
rm -f output/stills/t*.png
T=${1:-12}; OUT=${2:-output/stills/pose.png}
DEBUG_CAM='{"pos":[3.2,1.2,0.3],"look":[0,1.1,0.3],"fov":34,"relHero":true}' node scripts/render.mjs --still $T >/dev/null 2>&1; mv output/stills/t*.png output/stills/_side.png
DEBUG_CAM='{"pos":[0.4,1.3,3.2],"look":[0,1.1,0],"fov":34,"relHero":true}' node scripts/render.mjs --still $T >/dev/null 2>&1; mv output/stills/t*.png output/stills/_front.png
python3 -c "
from PIL import Image
a=Image.open('output/stills/_side.png').crop((140,300,940,1500)).resize((400,600));b=Image.open('output/stills/_front.png').crop((140,300,940,1500)).resize((400,600))
W=Image.new('RGB',(800,600));W.paste(a,(0,0));W.paste(b,(400,0));W.save('$OUT')"
