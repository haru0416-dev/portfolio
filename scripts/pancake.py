# /// script
# requires-python = ">=3.12"
# dependencies = ["fonttools", "brotli"]
# ///
"""Lab の Pancake で使う Pancake Mono / Pancake Sans を、文字の範囲ごとの woff2 に分ける。

    uv run scripts/pancake.py      # 出力がそろっていれば何もしない(デプロイでビルドの前に走る)

試し打ちでは何を打たれるか分からないので、pancake-site.py のように使う文字だけを抜き出せない。
1 ウェイトで 3〜4MB あるため、Google の分割版と同じく文字の範囲で分け、ページは打たれた文字の範囲だけを読む。
漢字は JIS 第 1 水準・第 2 水準・それ以外の順に分け、よく使う字ほど少ないファイルで済むようにする。
範囲はどのフォントでも同じなので、manifest.json に 1 回だけ書き、ページが FontFace で組み立てる。
出力は 110MB ほどあるので git には入れない(.gitignore)。
出力: public/fonts/pancake/(manifest.json、<フォント>/<番号>.woff2、OFL.txt)
"""

import io
import json
import os
import shutil
import sys
import urllib.request
import zipfile
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

VERSION = "1.0.1"
ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "node_modules" / ".cache" / "pancake"
OUT = ROOT / "public" / "fonts" / "pancake"
RELEASE = f"https://github.com/haru0416-dev/pancake-mono/releases/download/v{VERSION}"
FAMILIES = {"Pancake Mono": "PancakeMono", "Pancake Sans": "PancakeSans"}
WEIGHTS = {100: "Thin", 200: "ExtraLight", 300: "Light", 400: "Regular", 500: "Medium", 600: "SemiBold", 700: "Bold", 800: "ExtraBold"}

# 漢字以外(英字・記号・かな・全角英数)は 1 つにまとめる。試し打ちの最初の見本はほぼこれだけで描ける。
BASE = [(0x0000, 0x2E7F), (0x3000, 0x30FF), (0x31F0, 0x31FF), (0xFE30, 0xFE4F), (0xFF00, 0xFFEF)]
CHUNK = {"jis1": 500, "jis2": 700, "rest": 900}


def style_name(weight: int, italic: bool) -> str:
    name = WEIGHTS[weight]
    if italic:
        return "Italic" if name == "Regular" else f"{name}Italic"
    return name


def fetch(file: str) -> Path:
    path = CACHE / VERSION / file
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        print(f"取得: {file}", file=sys.stderr)
        tmp = path.with_suffix(".part")
        urllib.request.urlretrieve(f"{RELEASE}/{file}", tmp)
        tmp.rename(path)
    return path


def jis_level(ch: str) -> int:
    try:
        b = ch.encode("euc_jp")
    except UnicodeEncodeError:
        return 0
    if len(b) != 2:
        return 0
    if 0xB0 <= b[0] <= 0xCF:
        return 1
    if 0xD0 <= b[0] <= 0xF4:
        return 2
    return 0


def slices(cmap: set[int]) -> list[list[int]]:
    base = sorted(c for c in cmap if any(lo <= c <= hi for lo, hi in BASE))
    rest = sorted(cmap - set(base))
    groups = {"jis1": [], "jis2": [], "rest": []}
    for c in rest:
        level = jis_level(chr(c))
        groups["jis1" if level == 1 else "jis2" if level == 2 else "rest"].append(c)
    out = [base]
    for key, codes in groups.items():
        out += [codes[i : i + CHUNK[key]] for i in range(0, len(codes), CHUNK[key])]
    return out


def unicode_range(codes: list[int]) -> str:
    parts, start = [], None
    for i, c in enumerate(codes):
        if start is None:
            start = c
        if i + 1 == len(codes) or codes[i + 1] != c + 1:
            parts.append(f"U+{start:X}" if start == c else f"U+{start:X}-{c:X}")
            start = None
    return ",".join(parts)


def build_font(job: tuple[bytes, str, list[list[int]]]) -> str:
    data, name, groups = job
    options = subset.Options()
    options.flavor = "woff2"
    options.layout_features = ["*"]
    options.name_IDs = ["*"]
    options.name_languages = ["*"]
    options.notdef_outline = True
    options.hinting = True
    dest = OUT / name
    dest.mkdir(parents=True, exist_ok=True)
    for i, codes in enumerate(groups):
        font = TTFont(io.BytesIO(data))
        sub = subset.Subsetter(options)
        sub.populate(unicodes=codes)
        sub.subset(font)
        font.flavor = "woff2"
        font.save(dest / f"{i}.woff2")
    return name


def main() -> None:
    manifest_path = OUT / "manifest.json"
    if manifest_path.exists() and json.loads(manifest_path.read_text()).get("version") == VERSION:
        return
    shutil.rmtree(OUT, ignore_errors=True)
    OUT.mkdir(parents=True)

    jobs, faces, groups = [], [], None
    for family, prefix in FAMILIES.items():
        with zipfile.ZipFile(fetch(f"{prefix}-{VERSION}.zip")) as z:
            names = {Path(n).name: n for n in z.namelist() if n.endswith(".ttf")}
            if "OFL.txt" not in os.listdir(OUT):
                lic = next((n for n in z.namelist() if Path(n).name == "OFL.txt"), None)
                if lic:
                    (OUT / "OFL.txt").write_bytes(z.read(lic))
            for weight in WEIGHTS:
                for italic in (False, True):
                    file = f"{prefix}-{style_name(weight, italic)}.ttf"
                    if file not in names:
                        sys.exit(f"{prefix}-{VERSION}.zip に {file} がありません。")
                    data = z.read(names[file])
                    if groups is None:
                        groups = slices(set(TTFont(io.BytesIO(data), lazy=True).getBestCmap()))
                    name = Path(file).stem
                    jobs.append((data, name, groups))
                    faces.append({"family": family, "weight": weight, "style": "italic" if italic else "normal", "dir": name})

    with ProcessPoolExecutor(max_workers=os.cpu_count()) as pool:
        for name in pool.map(build_font, jobs):
            print(f"分割: {name}", file=sys.stderr)

    if not (OUT / "OFL.txt").exists():
        sys.exit("リリースの zip に OFL.txt がありません。")
    manifest = {"version": VERSION, "ranges": [unicode_range(g) for g in groups], "faces": faces}
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, separators=(",", ":")))
    size = sum(f.stat().st_size for f in OUT.rglob("*.woff2"))
    print(f"{len(faces)} フォント × {len(groups)} 範囲、計 {size / 1e6:.1f}MB", file=sys.stderr)


if __name__ == "__main__":
    main()
