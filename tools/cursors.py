# カーソルの SVG を生成して global.css の第 6 節を書き換える。形や色を変えるときはこのファイルを編集して `python3 tools/cursors.py`
import urllib.parse
SAFE = "/:=,()' "
def url(svg, hx, hy, fb):
    q = urllib.parse.quote(svg.replace('\n',''), safe=SAFE).replace('#', '%23')
    return 'url("data:image/svg+xml,' + q + '") ' + str(hx) + ' ' + str(hy) + ', ' + fb
PINK='#ea689f'; DARK='#3d3452'
arrow = f"""<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 28 28'>
<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#f59ac0'/><stop offset='1' stop-color='{PINK}'/></linearGradient></defs>
<path d='M6.2 5.2c-.5-1.4 1-2.6 2.2-1.7l14.3 10.6c1.3 1 .6 3-1 3.1l-6.2.5-3.4 5.3c-.9 1.4-3 1-3.3-.6z' fill='url(%23g)' stroke='#fff' stroke-width='2.4' stroke-linejoin='round'/>
<path d='M6.2 5.2c-.5-1.4 1-2.6 2.2-1.7l14.3 10.6c1.3 1 .6 3-1 3.1l-6.2.5-3.4 5.3c-.9 1.4-3 1-3.3-.6z' fill='none' stroke='{DARK}' stroke-opacity='.3' stroke-width='.9' stroke-linejoin='round'/>
<path d='M9.2 6.8l6.5 4.8' stroke='#fff' stroke-opacity='.75' stroke-width='1.6' stroke-linecap='round'/>
</svg>"""
sprout = f"""<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'>
<defs><radialGradient id='s' cx='.35' cy='.25' r='.9'><stop offset='0' stop-color='#fff'/><stop offset='1' stop-color='#f3eef9'/></radialGradient></defs>
<circle cx='16' cy='17.5' r='13' fill='{DARK}' fill-opacity='.14'/>
<circle cx='16' cy='16' r='13' fill='url(%23s)' stroke='{DARK}' stroke-opacity='.22'/>
<path d='M8 9.5a9 9 0 0 1 16 0' fill='none' stroke='#fff' stroke-width='2' stroke-linecap='round' stroke-opacity='.9'/>
<g transform='translate(5.5 5.5) scale(.875)' fill='none' stroke='{PINK}' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'><path d='M14 9.536V7a4 4 0 0 1 4-4h1.5a.5.5 0 0 1 .5.5V5a4 4 0 0 1-4 4 4 4 0 0 0-4 4c0 2 1 3 1 5a5 5 0 0 1-1 3'/><path d='M4 9a5 5 0 0 1 8 4 5 5 0 0 1-8-4'/><path d='M5 21h14'/></g>
</svg>"""
sprout_down = (sprout.replace(f"<circle cx='16' cy='17.5' r='13' fill='{DARK}' fill-opacity='.14'/>", "")
    .replace("r='13' fill='url(%23s)'", "r='11.5' fill='url(%23s)'")
    .replace("translate(5.5 5.5) scale(.875)", "translate(6.6 6.6) scale(.78)")
    .replace("M8 9.5a9 9 0 0 1 16 0", "M9 10a8 8 0 0 1 14 0"))
ibeam = f"""<svg xmlns='http://www.w3.org/2000/svg' width='24' height='28' viewBox='0 0 24 28'>
<path d='M12 6v16' stroke='#fff' stroke-width='5' stroke-linecap='round'/>
<path d='M12 6v16' stroke='{PINK}' stroke-width='2.2' stroke-linecap='round'/>
<circle cx='12' cy='4.5' r='3.2' fill='{PINK}' stroke='#fff' stroke-width='1.6'/><circle cx='12' cy='23.5' r='3.2' fill='{PINK}' stroke='#fff' stroke-width='1.6'/>
<circle cx='11' cy='3.6' r='.9' fill='#fff' fill-opacity='.8'/><circle cx='11' cy='22.6' r='.9' fill='#fff' fill-opacity='.8'/>
</svg>"""
# 画像確認用は %23 を # に戻す
show = [x.replace('%23','#') for x in (arrow, sprout, sprout_down, ibeam)]
css = f"""
/* =====================================================================
   6. カーソル(ホバーできる端末だけ)。桃色の飴玉のような矢印、リンクの上は芽、文字の上は玉付きの I ビーム
   ===================================================================== */
@media (hover: hover) and (pointer: fine) {{
  :root {{
    --cursor-arrow: {url(arrow, 6, 4, 'auto')};
    --cursor-hand:  {url(sprout, 16, 16, 'pointer')};
    --cursor-hand-down: {url(sprout_down, 16, 16, 'pointer')};
    --cursor-text:  {url(ibeam, 12, 14, 'text')};
  }}
  html, body {{ cursor: var(--cursor-arrow); }}
  a, button, [role="button"], summary, label, .press, .chip, .pill, .icon-btn {{ cursor: var(--cursor-hand); }}
  :is(a, button, .press, .chip, .pill, .icon-btn):active {{ cursor: var(--cursor-hand-down); }} /* 押している間は少し縮む */
  :is(p, li, h1, h2, h3, dd, blockquote, .prose, time, pre, code, td, th):not(:has(a:hover)) {{ cursor: var(--cursor-text); }}
  a *, button * {{ cursor: inherit; }}
  canvas {{ cursor: var(--cursor-arrow); }}
}}
"""
import os; p=os.path.join(os.path.dirname(__file__), '..', 'src/styles/global.css'); s=open(p).read()
a=s.index("/* =====================================================================\n   6. カーソル")
open(p,'w').write(s[:a].rstrip('\n')+'\n'+css)
html='<body style="margin:0;background:#f8f5fd;display:flex;gap:36px;padding:24px;align-items:center">'+''.join(f'<div style="zoom:3">{x}</div>' for x in show)+'<div style="background:#15121c;padding:20px;display:flex;gap:36px">'+''.join(f'<div style="zoom:3">{x}</div>' for x in show)+'</div></body>'
pass
print('ok')
