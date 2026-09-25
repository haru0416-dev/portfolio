# /// script
# requires-python = ">=3.12"
# dependencies = ["fonttools", "brotli"]
# ///
"""見出しに使う文字だけを Zen Maru Gothic Bold から取り出したフォントを作る。

    bun run build && uv run scripts/zen-maru.py   # ビルドした HTML から文字を集めて作る
    uv run scripts/zen-maru.py --check            # 足りない文字がないか確かめる(デプロイでビルドのあとに走る)

Google の分割版は漢字を 120 ほどのファイルに分けて持ち、どれが要るかはページを組み立てるまで分からない。
先読みできず、遅い回線では見出しの漢字だけが後から差し替わるので、使う文字を 1 つにまとめて先読みする。
出力: public/fonts/zen-maru-700.woff2(ライセンスは同じ場所の zen-maru-kana-OFL.txt と同じ OFL)
"""

import sys
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
SRC = "https://github.com/google/fonts/raw/main/ofl/zenmarugothic/ZenMaruGothic-Bold.ttf"
CACHE = ROOT / "node_modules" / ".cache" / "zen-maru" / "ZenMaruGothic-Bold.ttf"
OUT = ROOT / "public" / "fonts" / "zen-maru-700.woff2"

# CSS で --font-zen-maru を使う要素。global.css の .display・.display-jp、about.astro の .about-h2、
# prose.css の .prose h2・h3、CardArt.astro の .t-jp。増やしたらここにも足す。
CLASSES = {"display", "display-jp", "about-h2", "t-jp"}
PROSE_TAGS = {"h2", "h3"}
VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"}


class Collect(HTMLParser):
    def __init__(self):
        super().__init__()
        self.stack: list[tuple[str, bool, bool]] = []  # (タグ, 見出しのフォントか, .prose の中か)
        self.chars: set[str] = set()

    def handle_starttag(self, tag, attrs):
        if tag in VOID:
            return
        classes = set((dict(attrs).get("class") or "").split())
        _, display, prose = self.stack[-1] if self.stack else ("", False, False)
        prose = prose or "prose" in classes
        display = display or bool(classes & CLASSES) or (prose and tag in PROSE_TAGS)
        self.stack.append((tag, display, prose))

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] == tag:
                del self.stack[i:]
                return

    def handle_data(self, data):
        if self.stack and self.stack[-1][1]:
            self.chars |= {c for c in data if not c.isspace()}


def used() -> set[str]:
    pages = list((ROOT / "dist").rglob("*.html"))
    if not pages:
        sys.exit("dist/ がありません。先にビルドしてください。")
    parser = Collect()
    for page in pages:
        parser.stack = []
        parser.feed(page.read_text())
    return parser.chars


def check() -> None:
    have = {chr(c) for c in TTFont(OUT).getBestCmap()} if OUT.exists() else set()
    missing = sorted(used() - have)
    if missing:
        print(f"{OUT.name} に足りない文字があります: {''.join(missing)}\n  uv run scripts/zen-maru.py で作り直してコミットしてください。", file=sys.stderr)
        sys.exit(1)


def main() -> None:
    if not CACHE.exists():
        CACHE.parent.mkdir(parents=True, exist_ok=True)
        CACHE.write_bytes(urllib.request.urlopen(SRC).read())
    font = TTFont(CACHE)
    opts = subset.Options()
    opts.hinting = False
    sub = subset.Subsetter(opts)
    sub.populate(text="".join(sorted(used())))
    sub.subset(font)
    font.flavor = "woff2"
    font.save(OUT)
    # ビルドをやり直さずに試せるよう、出力済みの dist にも置く。
    if (ROOT / "dist" / "fonts").exists():
        (ROOT / "dist" / "fonts" / OUT.name).write_bytes(OUT.read_bytes())
    print(f"{OUT} {OUT.stat().st_size / 1024:.1f} KiB, {len(font.getBestCmap())} chars")


if __name__ == "__main__":
    check() if "--check" in sys.argv else main()
