# /// script
# requires-python = ">=3.12"
# dependencies = ["fonttools", "brotli"]
# ///
"""サイトの文字に使う Pancake Sans / Pancake Mono を、サイトで使う文字だけに絞って作る。

    bun run build && uv run scripts/pancake-site.py   # ビルドした HTML とスクリプトから文字を集めて作る
    uv run scripts/pancake-site.py --check            # 足りない文字がないか確かめる(デプロイでビルドのあとに走る)

Lab の Pancake(scripts/pancake.py)のように範囲で分けると、和文のページでは漢字のファイルをいくつも待つことになり、
本文が後から差し替わる。サイトの文字は 700 字ほどなので、使う字を 1 つにまとめて先読みする。
Pancake Mono はコードの欄(pre・code・kbd)の字だけを持つ。それ以外の和文はフォントの指定で Pancake Sans に落ちる。
OG 画像(src/og.ts)も、ここで作った Pancake Sans の Bold で描く。
出力: public/fonts/pancake-sans-500.woff2、pancake-sans-700.woff2、pancake-mono-400.woff2(ライセンスは同じ場所の OFL.txt)
"""

import io
import sys
import zipfile
from html.parser import HTMLParser
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pancake import VERSION, fetch  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
FONTS = ROOT / "public" / "fonts"
# (出力, リリースの zip, フォント, 文字を集める先)
OUTPUTS = [
    ("pancake-sans-500.woff2", "PancakeSans", "PancakeSans-Medium.ttf", "all"),
    ("pancake-sans-700.woff2", "PancakeSans", "PancakeSans-Bold.ttf", "all"),
    ("pancake-mono-400.woff2", "PancakeMono", "PancakeMono-Regular.ttf", "code"),
]
# 英字とかなは記事が増えても困らないよう全部入れる。
ALWAYS = {chr(c) for c in [*range(0x20, 0x7F), *range(0x3041, 0x3097), *range(0x30A1, 0x30FB), 0x30FC]}
# サイトで使う機能だけを残す。cv・ss などの字形の切り替えは Lab の Pancake で試せる。
FEATURES = ["ccmp", "locl", "kern", "calt", "liga", "rlig", "mark", "mkmk"]
CODE_TAGS = {"pre", "code", "kbd", "samp"}
VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"}


class Collect(HTMLParser):
    def __init__(self):
        super().__init__()
        self.stack: list[tuple[str, bool]] = []  # (タグ, コードの欄の中か)
        self.all: set[str] = set()
        self.code: set[str] = set()

    def handle_starttag(self, tag, attrs):
        if tag in VOID:
            return
        classes = set((dict(attrs).get("class") or "").split())
        code = (self.stack[-1][1] if self.stack else False) or tag in CODE_TAGS or "t-mono" in classes
        self.stack.append((tag, code))
        # ボタンの文字や入力欄の初期値など、属性のまま画面に出るもの。
        for name, value in attrs:
            if value and name in {"value", "placeholder", "alt", "data-samples"}:
                self.all |= set(value)

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] == tag:
                del self.stack[i:]
                return

    def handle_data(self, data):
        if self.stack and self.stack[-1][0] == "style":
            return
        chars = {c for c in data if not c.isspace()}
        self.all |= chars
        if self.stack and self.stack[-1][1]:
            self.code |= chars


def used() -> dict[str, set[str]]:
    dist = ROOT / "dist"
    pages = list(dist.rglob("*.html"))
    if not pages:
        sys.exit("dist/ がありません。先にビルドしてください。")
    parser = Collect()
    for page in pages:
        parser.stack = []
        parser.feed(page.read_text())
    # スクリプトが書き込む文字(「コピーしました」など)。英字は ALWAYS に入っているので和文だけ拾う。
    for script in dist.rglob("*.js"):
        parser.all |= {c for c in script.read_text(errors="ignore") if ord(c) > 0x7F and not c.isspace()}
    return {"all": parser.all | ALWAYS, "code": parser.code | {chr(c) for c in range(0x20, 0x7F)}}


def check() -> None:
    chars = used()
    failed = False
    for out, _, _, source in OUTPUTS:
        path = FONTS / out
        have = {chr(c) for c in TTFont(path).getBestCmap()} if path.exists() else set()
        # 元のフォントにない字(絵文字など)は作り直しても入らないので、端末のフォントに任せる。
        missing = sorted(c for c in chars[source] - have if c in source_cmap(out))
        if missing:
            print(f"{out} に足りない文字があります: {''.join(missing)}", file=sys.stderr)
            failed = True
    if failed:
        print("  uv run scripts/pancake-site.py で作り直してコミットしてください。", file=sys.stderr)
        sys.exit(1)


_cmaps: dict[str, set[str]] = {}


def source_font(out: str) -> bytes:
    _, prefix, file, _ = next(o for o in OUTPUTS if o[0] == out)
    with zipfile.ZipFile(fetch(f"{prefix}-{VERSION}.zip")) as z:
        return z.read(next(n for n in z.namelist() if Path(n).name == file))


def source_cmap(out: str) -> set[str]:
    if out not in _cmaps:
        _cmaps[out] = {chr(c) for c in TTFont(io.BytesIO(source_font(out)), lazy=True).getBestCmap()}
    return _cmaps[out]


def main() -> None:
    chars = used()
    for out, _, _, source in OUTPUTS:
        font = TTFont(io.BytesIO(source_font(out)))
        opts = subset.Options()
        # 著作権表示とライセンスの欄を残す(既定では落ちる)。OFL は複製にライセンスを付けることを求める。
        opts.name_IDs = ["*"]
        opts.layout_features = FEATURES
        opts.hinting = False
        sub = subset.Subsetter(opts)
        sub.populate(text="".join(sorted(chars[source])))
        sub.subset(font)
        font.flavor = "woff2"
        font.save(FONTS / out)
        # ビルドをやり直さずに試せるよう、出力済みの dist にも置く。
        if (ROOT / "dist" / "fonts").exists():
            (ROOT / "dist" / "fonts" / out).write_bytes((FONTS / out).read_bytes())
        print(f"{FONTS / out} {(FONTS / out).stat().st_size / 1024:.1f} KiB, {len(font.getBestCmap())} chars")


if __name__ == "__main__":
    check() if "--check" in sys.argv else main()
