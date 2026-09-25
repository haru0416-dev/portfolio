# 再生成: python3 tools/theme-waves.py
# テーマ切り替えの波の絵。global.css の「テーマの切り替え」が使う。
# 小さく保ってビルドで CSS に埋め込ませ、切り替えの最初の一コマから読み込みを待たずに効かせる。
# 縁の光はマスクの本体の波と同じ形でなければならない。どちらも横幅 100 で 3 周期で、CSS では横 100vw で並べて同じだけ横へ流す。
import os

PERIODS = 3
AMP = 3.6  # 本体の波の高さ(マスクでは 1 = 画面の高さの 1%、縁の光では 1 = 1vh)


def wave(y0, amp, phase=0.0, periods=PERIODS):
    """y0 を中心に上から始まる波の線。phase は周期の何割ずらすか(ずらすときは periods を 1 増やして左端を埋める)。"""
    per = 100 / PERIODS
    d = f"M{-per * phase:.1f} {y0}" if phase else f"M0 {y0}"
    for k in range(periods):
        x = (k - phase) * per
        d += f"C{x + per * 0.25:.1f} {y0 - amp} {x + per * 0.25:.1f} {y0 - amp} {x + per * 0.5:.1f} {y0}S{x + per * 0.75:.1f} {y0 + amp} {x + per:.1f} {y0}"
    return d


# 層: (波の高さ, 不透明度, 山の位置のずれ)。どの層も波の中心は上端から 150 で、global.css の mask-position がこれを前提にする。
LAYERS = {'front': (2.4, .2, .35), 'middle': (3.0, .45, .7), 'body': (AMP, 1, 0)}


def mask(dive, layer):
    """新しい画面を見せる範囲の 1 層。潜るときは波より下、浮かぶときは波より上。"""
    amp, opacity, phase = LAYERS[layer]
    left = f"{-100 / PERIODS * phase:.1f}" if phase else "0"
    close = f"V300H{left}Z" if dive else f"V0H{left}Z"
    path = f"<path d='{wave(150, amp, phase, PERIODS + 1)}{close}'" + (f" fill-opacity='{opacity}'" if opacity < 1 else '') + "/>"
    return f"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 300' preserveAspectRatio='none'>{path}</svg>"


def glow(dive):
    """水面の縁の光。帯の高さは 45vh(.theme-tide と同じ)で、波の中心は新しい画面と反対の端から 4vh。"""
    if dive:
        y0 = 4
        grad = ("<linearGradient id='g' x2='0' y2='1'><stop offset='0' stop-color='white' stop-opacity='.38'/>"
                "<stop offset='.35' stop-color='white' stop-opacity='.06'/><stop offset='1' stop-color='white' stop-opacity='0'/></linearGradient>")
        fill, line = f"{wave(y0, AMP)}V45H0Z", "oklch(90% .06 215)"
    else:
        y0 = 41
        grad = ("<linearGradient id='g' x2='0' y2='1'><stop offset='0' stop-color='white' stop-opacity='0'/>"
                "<stop offset='.65' stop-color='#fff6dc' stop-opacity='.1'/><stop offset='1' stop-color='#fff6dc' stop-opacity='.7'/></linearGradient>")
        fill, line = f"{wave(y0, AMP)}V0H0Z", "oklch(99% .04 90)"
    return (f"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 45' preserveAspectRatio='none'><defs>{grad}</defs>"
            f"<path d='{fill}' fill='url(#g)'/>"
            f"<path d='{wave(y0, AMP)}' fill='none' stroke='{line}' stroke-width='2.5' stroke-opacity='.9' vector-effect='non-scaling-stroke'/></svg>")


OUT = os.path.join(os.path.dirname(__file__), '..', 'src/assets/theme-switch')
os.makedirs(OUT, exist_ok=True)
files = {f'{side}-{layer}': mask(side == 'dive', layer) for side in ('dive', 'surface') for layer in LAYERS}
files.update({'dive-glow': glow(True), 'surface-glow': glow(False)})
for old in os.listdir(OUT):
    if old.endswith('.svg') and old.removesuffix('.svg') not in files:
        os.remove(os.path.join(OUT, old))
for name, svg in files.items():
    open(os.path.join(OUT, f'{name}.svg'), 'w').write(svg + '\n')
print('ok')
