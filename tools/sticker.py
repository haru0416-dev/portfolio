# /// script
# requires-python = ">=3.12"
# dependencies = ["pillow", "numpy", "scipy"]
# ///
"""透明背景のイラストを、白い台紙で型抜きしたシールにする。サイトのシール(Sticker.astro)と同じ見た目にそろえる。

    uv run tools/sticker.py 元の画像.png src/assets/avatar/haru.png

台紙の縁は絵の高さの BORDER。周りに浮かぶ泡などが別々の小さなシールに分かれないよう、GAP までのすき間は埋める。
"""
import sys

import numpy as np
from PIL import Image
from scipy.ndimage import distance_transform_edt

BORDER = 0.026
GAP = 0.03

src, out = sys.argv[1], sys.argv[2]
art = Image.open(src).convert("RGBA")
art = art.crop(art.getchannel("A").getbbox())
border, gap = round(art.height * BORDER), round(art.height * GAP)
pad = border + gap + 4
canvas = Image.new("RGBA", (art.width + pad * 2, art.height + pad * 2))
canvas.alpha_composite(art, (pad, pad))

shape = np.asarray(canvas.getchannel("A")) > 16
# すき間を埋める(太らせてから同じだけ痩せさせる)。
grown = distance_transform_edt(~shape) <= border + gap
closed = distance_transform_edt(grown) > gap
# 縁の境目は、形からの距離で階調を付ける。
dist = distance_transform_edt(~closed)
alpha = np.clip(border + 0.5 - dist, 0, 1)
base = Image.new("RGBA", canvas.size, (255, 255, 255, 0))
base.putalpha(Image.fromarray((alpha * 255).astype(np.uint8)))
base.alpha_composite(canvas)
base = base.crop(base.getchannel("A").getbbox())
base.save(out, optimize=True)
print(out, base.size)
