# 再生成: python3 tools/cursors.py
import os

PINK = '#ea689f'; WHITE = '#fff'
ARROW = "M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z"
TEXT = ["M17 22h-1a4 4 0 0 1-4-4V6a4 4 0 0 1 4-4h1", "M7 22h1a4 4 0 0 0 4-4", "M7 2h1a4 4 0 0 1 4 4"]
SPROUT = ["M14 9.536V7a4 4 0 0 1 4-4h1.5a.5.5 0 0 1 .5.5V5a4 4 0 0 1-4 4 4 4 0 0 0-4 4c0 2 1 3 1 5a5 5 0 0 1-1 3", "M4 9a5 5 0 0 1 8 4 5 5 0 0 1-8-4", "M5 21h14"]

def lucide(paths, size, scale, tx, ty, fill=None, extra=''):
    ps = ''.join(f"<path d='{d}'/>" for d in paths)
    f = f" fill='{fill}'" if fill else " fill='none'"
    return (f"<svg xmlns='http://www.w3.org/2000/svg' width='{size}' height='{size}' viewBox='0 0 {size} {size}'>"
            f"{extra}<g transform='translate({tx} {ty}) scale({scale})' stroke-linecap='round' stroke-linejoin='round'>"
            f"<g fill='none' stroke='{WHITE}' stroke-width='5'>{ps}</g>"
            f"<g{f} stroke='{PINK}' stroke-width='2'>{ps}</g></g></svg>")

ROOT = os.path.join(os.path.dirname(__file__), '..')
OUT = os.path.join(ROOT, 'public/cursors')
os.makedirs(OUT, exist_ok=True)

def url(name, svg, hx, hy, fb):
    open(os.path.join(OUT, name + '.svg'), 'w').write(svg + '\n')
    return f'url(/cursors/{name}.svg) {hx} {hy}, {fb}'

arrow = lucide([ARROW], 28, 1.0, 2, 2, fill='#f9c9d8')
sprout = lucide([ARROW], 28, 1.0, 2, 2, fill='#f3a5c4')
sprout_down = lucide([ARROW], 28, 1.0, 2, 2, fill=PINK)
ibeam = lucide(TEXT, 28, 1.0, 2, 2)

css = f"""
/* カーソル */
@media (hover: hover) and (pointer: fine) {{
  :root {{
    --cursor-arrow: {url('arrow', arrow, 6, 7, 'auto')};
    --cursor-hand:  {url('sprout', sprout, 6, 7, 'pointer')};
    --cursor-hand-down: {url('sprout-down', sprout_down, 6, 7, 'pointer')};
    --cursor-text:  {url('text', ibeam, 14, 14, 'text')};
  }}
  html, body {{ cursor: var(--cursor-arrow); }}
  a, button, [role="button"], summary, label {{ cursor: var(--cursor-hand); }}
  :is(a, button):active {{ cursor: var(--cursor-hand-down); }}
  input, textarea, [contenteditable] {{ cursor: var(--cursor-text); }} /* 本文は矢印のまま(切り替わりの点滅を避ける) */
  a *, button * {{ cursor: inherit; }}
  canvas {{ cursor: var(--cursor-arrow); }}
}}
"""
p = os.path.join(ROOT, 'src/styles/global.css')
s = open(p).read()
a = s.index("/* カーソル */")
open(p, 'w').write(s[:a].rstrip('\n') + '\n' + css)

if os.environ.get('PREVIEW'):
    show = [arrow, sprout, sprout_down, ibeam]
    row = ''.join(f'<div style="zoom:3">{x}</div>' for x in show)
    open(os.environ['PREVIEW'], 'w').write(f'<body style="margin:0;background:#f8f5fd;display:flex;gap:36px;padding:24px;align-items:center">{row}<div style="background:#15121c;padding:20px;display:flex;gap:36px">{row}</div></body>')
print('ok')
