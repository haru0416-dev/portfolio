# /// script
# requires-python = ">=3.12"
# dependencies = ["fonttools", "brotli"]
# ///
"""見出し用に、かなと約物だけを詰めた Zen Maru Gothic Bold を作る。

Zen Maru Gothic には字間を詰める OpenType 機能(palt)が無く、CSS で palt を指定しても
全角幅のまま(「ト」は字形の左に 378/1000 の空きがある)。そこで、かなと約物のグリフだけを
取り出し、かなは左右の空きを最大 SIDE まで削り、約物は半角にした幅を焼き込んだフォントを作る。
漢字は元のまま(CSS の unicode-range で、この範囲だけこのフォントを使う)。

    uv run scripts/zen-maru-kana.py

出力: public/fonts/zen-maru-kana-700.woff2(ライセンスは同じ場所の zen-maru-kana-OFL.txt)
"""

import io
import urllib.request
from pathlib import Path

from fontTools import subset
from fontTools.pens.recordingPen import DecomposingRecordingPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont

SRC = "https://github.com/google/fonts/raw/main/ofl/zenmarugothic/ZenMaruGothic-Bold.ttf"
LICENSE = "https://github.com/google/fonts/raw/main/ofl/zenmarugothic/OFL.txt"
OUT = Path(__file__).resolve().parent.parent / "public" / "fonts"
FAMILY = "Zen Maru Kana"

# かなの字形の左右に残す空き(1000 分率)。元の空きがこれより狭ければ元のまま
SIDE = 60
# 約物は一般的な palt と同じく半角(500)にし、字形の置き場所だけ変える
HALF = 500
OPENING = {0x3008, 0x300A, 0x300C, 0x300E, 0x3010, 0x3014, 0xFF08}  # 開き括弧: 右半分に字形がある
CENTERED = {0x30FB, 0xFF1A, 0xFF1B}  # 中黒・コロン・セミコロン: 中央に置く
CLOSING = {0x3001, 0x3002, 0x3009, 0x300B, 0x300D, 0x300F, 0x3011, 0x3015, 0xFF09, 0xFF0C, 0xFF0E}  # 閉じ括弧・句読点: 左半分

# ひらがな・カタカナ(長音符 ー と濁点単体は除く)と、和文の約物
CODEPOINTS = [
    *range(0x3041, 0x3097), 0x309D, 0x309E,
    *range(0x30A1, 0x30FB), 0x30FD, 0x30FE,
    0x3001, 0x3002, *range(0x3008, 0x3012), 0x3014, 0x3015, 0x30FB,
    0xFF01, 0xFF08, 0xFF09, 0xFF0C, 0xFF0E, 0xFF1A, 0xFF1B, 0xFF1F,
]
# css の unicode-range に書く値
UNICODE_RANGE = "U+3001-3002, U+3008-3011, U+3014-3015, U+3041-3096, U+309D-309E, U+30A1-30FB, U+30FD-30FE, U+FF01, U+FF08-FF09, U+FF0C, U+FF0E, U+FF1A-FF1B, U+FF1F"


def main() -> None:
    font = TTFont(io.BytesIO(urllib.request.urlopen(SRC).read()))

    opts = subset.Options()
    opts.layout_features = []  # kern なども要らない(幅を直接変える)
    opts.hinting = False
    opts.name_IDs = ["*"]
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=CODEPOINTS)
    sub.subset(font)

    glyf, hmtx = font["glyf"], font["hmtx"]
    glyph_set = font.getGlyphSet()
    kind = {}
    for cp, name in font.getBestCmap().items():
        kind[name] = "opening" if cp in OPENING else "centered" if cp in CENTERED else "closing" if cp in CLOSING else "kana"
    for name in font.getGlyphOrder():
        if name == ".notdef":
            continue
        g = glyf[name]
        if g.numberOfContours == 0:
            continue
        # 部品を参照するグリフは、部品ごと動いてしまわないよう先に輪郭へ展開する
        if g.isComposite():
            rec = DecomposingRecordingPen(glyph_set)
            glyph_set[name].draw(rec)
            pen = TTGlyphPen(None)
            rec.replay(pen)
            glyf[name] = g = pen.glyph()
        g.recalcBounds(glyf)
        adv, _ = hmtx[name]
        width = g.xMax - g.xMin
        match kind.get(name, "kana"):
            case "opening":
                dx, new_adv = -HALF, HALF
            case "centered":
                dx, new_adv = (HALF - width) / 2 - g.xMin, HALF
            case "closing":
                dx, new_adv = 0, HALF
            case _:
                left, right = g.xMin, adv - g.xMax
                new_left, new_right = min(left, SIDE), min(right, SIDE)
                dx, new_adv = new_left - left, new_left + width + new_right
        dx = round(dx)
        if dx:
            pen = TTGlyphPen(None)
            glyph_set[name].draw(TransformPen(pen, (1, 0, 0, 1, dx, 0)))
            glyf[name] = g = pen.glyph()
            g.recalcBounds(glyf)
        hmtx[name] = (round(new_adv), g.xMin)

    name = font["name"]
    for rec in list(name.names):
        if rec.nameID in (1, 3, 4, 6, 16, 17):
            name.removeNames(nameID=rec.nameID)
    name.setName(FAMILY, 1, 3, 1, 0x409)
    name.setName("Bold", 2, 3, 1, 0x409)
    name.setName(f"{FAMILY} Bold; derived from Zen Maru Gothic Bold", 3, 3, 1, 0x409)
    name.setName(f"{FAMILY} Bold", 4, 3, 1, 0x409)
    name.setName("ZenMaruKana-Bold", 6, 3, 1, 0x409)

    OUT.mkdir(parents=True, exist_ok=True)
    font.flavor = "woff2"
    out = OUT / "zen-maru-kana-700.woff2"
    font.save(out)
    (OUT / "zen-maru-kana-OFL.txt").write_bytes(urllib.request.urlopen(LICENSE).read())
    print(f"{out} {out.stat().st_size / 1024:.1f} KiB, {len(font.getGlyphOrder())} glyphs")
    print(f"unicode-range: {UNICODE_RANGE}")


if __name__ == "__main__":
    main()
