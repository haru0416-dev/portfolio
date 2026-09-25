# 再生成: python3 tools/cursors.py
# SVG を public/cursors に、CSS を global.css の末尾(「/* カーソル」以降)に書き出す。
import math
import os

H = 300  # サイトの色相(src/palette.ts の HUE)
H_ACCENT = 356


def oklch(l, c, h):
    """OKLCH(L は %)を sRGB の 16 進にする。src/palette.ts の oklchToHex と同じ式。"""
    L = l / 100
    a, b = c * math.cos(math.radians(h)), c * math.sin(math.radians(h))
    l_, m_, s_ = L + 0.3963377774 * a + 0.2158037573 * b, L - 0.1055613458 * a - 0.0638541728 * b, L - 0.0894841775 * a - 1.2914855480 * b
    l3, m3, s3 = l_ ** 3, m_ ** 3, s_ ** 3
    rgb = (4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3,
           -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3,
           -0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3)
    gamma = lambda x: 12.92 * x if x <= 0.0031308 else 1.055 * x ** (1 / 2.4) - 0.055
    return '#' + ''.join(f'{round(min(1, max(0, gamma(v))) * 255):02x}' for v in rgb)


# テーマごとの色。light は global.css の --ink・--paper-2・--accent・--accent-ink と同じ値。
THEMES = {
    'light': {'base': '#ffffff', 'ink': oklch(32, 0.05, H), 'fill': oklch(94.5, 0.022, H), 'accent': oklch(66, 0.175, H_ACCENT), 'accent_down': oklch(52, 0.17, H_ACCENT)},
    # 台紙はシール(.sticker-base)と同じ 86%。インクは暗い地でも読めるよう濃いままにする。
    'dark': {'base': oklch(86, 0.015, H), 'ink': oklch(32, 0.05, H), 'fill': oklch(80, 0.02, H), 'accent': oklch(55, 0.16, H_ACCENT), 'accent_down': oklch(45, 0.15, H_ACCENT)},
}

ICONS = {
    'arrow': ["M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z"],
    'point': ["M22 14a8 8 0 0 1-8 8", "M18 11v-1a2 2 0 0 0-2-2a2 2 0 0 0-2 2", "M14 10V9a2 2 0 0 0-2-2a2 2 0 0 0-2 2v1", "M10 9.5V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v10", "M18 11a2 2 0 1 1 4 0v3a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"],
    'text': ["M17 22h-1a4 4 0 0 1-4-4V6a4 4 0 0 1 4-4h1", "M7 22h1a4 4 0 0 0 4-4", "M7 2h1a4 4 0 0 1 4 4"],
    'grab': ["M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2", "M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2", "M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8", "M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"],
    'grabbing': ["M18 11.5V9a2 2 0 0 0-2-2a2 2 0 0 0-2 2v1.4", "M14 10V8a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2", "M10 9.9V9a2 2 0 0 0-2-2a2 2 0 0 0-2 2v5", "M6 14a2 2 0 0 0-2-2a2 2 0 0 0-2 2", "M18 11a2 2 0 1 1 4 0v3a8 8 0 0 1-8 8h-4a8 8 0 0 1-8-8 2 2 0 1 1 4 0"],
}

SIZE = 32  # 32px を超えると表示しない環境がある。台紙の太い線が収まるよう、上限の 32px にする。
PAD = 4  # アイコン(24 単位)を枠の中央に置く余白。


def sticker(paths, line, fill=None, press=False, palm=False):
    """台紙(太い線と塗り)の上にアイコンの線を描く。press は少し縮めて下へ沈める。
    palm は、開いた線を塗りで閉じたときに手のひらに残る細い穴を台紙色の円でふさぐ。"""
    ps = ''.join(f"<path d='{d}'/>" for d in paths)
    hole = "<circle cx='14' cy='15.5' r='5.5'/>" if palm else ''
    inner = "translate(12 12.7) scale(.94) translate(-12 -12)" if press else ""
    f = f" fill='{fill}'" if fill else " fill='none'"
    return (f"<svg xmlns='http://www.w3.org/2000/svg' width='{SIZE}' height='{SIZE}' viewBox='0 0 {SIZE} {SIZE}'>"
            f"<g transform='translate({PAD} {PAD})' stroke-linecap='round' stroke-linejoin='round'><g transform='{inner}'>"
            # 台紙の太さ 7 はシールと同じ。細いと指の間が埋まらず、暗い地で背景が透ける。
            f"<g fill='{{base}}' stroke='{{base}}' stroke-width='7'>{hole}{ps}</g>"
            f"<g{f} stroke='{line}' stroke-width='2'>{ps}</g></g></g></svg>")


# 名前: (アイコン, 線の色, 塗り, 押し込み, ホットスポット, 代わりのカーソル)
CURSORS = {
    'arrow': ('arrow', 'ink', 'fill', False, (8, 8), 'auto'),
    'point': ('point', 'accent', None, False, (12, 6), 'pointer'),
    'point-down': ('point', 'accent_down', None, True, (12, 7), 'pointer'),
    'text': ('text', 'ink', None, False, (16, 16), 'text'),
    'grab': ('grab', 'accent', None, False, (16, 16), 'grab'),
    'grabbing': ('grabbing', 'accent_down', None, False, (16, 17), 'grabbing'),
}

ROOT = os.path.join(os.path.dirname(__file__), '..')
OUT = os.path.join(ROOT, 'public/cursors')
os.makedirs(OUT, exist_ok=True)
for old in os.listdir(OUT):
    if old.endswith('.svg'):
        os.remove(os.path.join(OUT, old))

decl = {}
svgs = {}
for theme, col in THEMES.items():
    lines = []
    for name, (icon, line, fill, press, (hx, hy), fb) in CURSORS.items():
        file = name if theme == 'light' else f'{name}-dark'
        svg = sticker(ICONS[icon], col[line], col[fill] if fill else None, press, palm=icon in ('point', 'grab', 'grabbing')).replace('{base}', col['base'])
        open(os.path.join(OUT, file + '.svg'), 'w').write(svg + '\n')
        svgs[(theme, name)] = svg
        lines.append(f'--cursor-{name}: url(/cursors/{file}.svg) {hx} {hy}, {fb};')
    decl[theme] = '\n    '.join(lines)

dark_nested = decl['dark'].replace('\n    ', '\n      ')
css = f"""
/* カーソル。tools/cursors.py が生成する。 */
@media (hover: hover) and (pointer: fine) {{
  :root {{
    {decl['light']}
  }}
  :root.dark {{
    {decl['dark']}
  }}
  @media (prefers-color-scheme: dark) {{
    :root:not(.light) {{
      {dark_nested}
    }}
  }}
  html, body {{ cursor: var(--cursor-arrow); }}
  a, button, [role="button"], summary, label, select {{ cursor: var(--cursor-point); }}
  :is(a, button, [role="button"], summary, label):active {{ cursor: var(--cursor-point-down); }}
  :is(button, input, select, textarea):disabled, [aria-disabled="true"] {{ cursor: var(--cursor-arrow); }}
  input, textarea, [contenteditable] {{ cursor: var(--cursor-text); }} /* 本文は矢印のまま(切り替わりの点滅を避ける) */
  a *, button * {{ cursor: inherit; }}
  canvas {{ cursor: var(--cursor-arrow); }}
  .bc-hit {{ cursor: var(--cursor-grab); }}
  .bc-hit:active, .is-dragging .bc-hit {{ cursor: var(--cursor-grabbing); }}
}}
"""
p = os.path.join(ROOT, 'src/styles/global.css')
s = open(p).read()
a = s.index("/* カーソル")
open(p, 'w').write(s[:a].rstrip('\n') + '\n' + css)

if os.environ.get('PREVIEW'):
    def row(theme):
        return ''.join(f'<div style="zoom:3">{svgs[(theme, n)]}</div>' for n in CURSORS)
    open(os.environ['PREVIEW'], 'w').write(
        '<body style="margin:0;font-family:sans-serif">'
        f'<div style="background:#f8f5fd;display:flex;gap:28px;padding:24px;align-items:center">{row("light")}</div>'
        f'<div style="background:#15121c;display:flex;gap:28px;padding:24px;align-items:center">{row("dark")}</div>'
        f'<div style="background:#1b2032;display:flex;gap:28px;padding:24px;align-items:center">{row("light")}</div>'
        '</body>')
print('ok')
