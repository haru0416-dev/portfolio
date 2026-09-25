# 再生成: python3 tools/theme-waves.py
# テーマ切り替えの波の絵。global.css の「テーマの切り替え」が使う。
# 小さい絵なので、ビルドで CSS に埋め込まれる。切り替えの最初の一コマから、読み込みを待たずに波が効く。
# マスクは画面の高さの 3 倍の絵で、窓からずらして波が画面を横切るように見せる。縁の光は、マスクの本体の波と同じ形でなければならない。
# どちらも横幅 100 で 3 周期。CSS では横 100vw で並べ、同じだけ横へ流す。
import os

PERIODS = 3
AMP = 3.6  # 本体の波の高さ(マスクでは 1 = 画面の高さの 1%、縁の光では 1 = 1vh)


def wave(y0, amp, phase=0.0, periods=PERIODS):
    """y0 を中心に上から始まる波の線。phase は周期の何割ずらすか。ずらした分だけ 1 周期多く描いて左端を埋める。"""
    per = 100 / PERIODS
    d = f"M{-per * phase:.1f} {y0}" if phase else f"M0 {y0}"
    for k in range(periods):
        x = (k - phase) * per
        d += f"C{x + per * 0.25:.1f} {y0 - amp} {x + per * 0.25:.1f} {y0 - amp} {x + per * 0.5:.1f} {y0}S{x + per * 0.75:.1f} {y0 + amp} {x + per:.1f} {y0}"
    return d


# マスクの層。先を行く淡い 2 枚は水面の手前の薄い水の層で、本体とは別に動かす(CSS で層ごとに位置をずらし、横へ流す速さも変える)。
# 絵の中ではどの層も波の中心を上端から 150 に置く。本体は縁の光と同じ形・同じ位置のまま動かす。
LAYERS = {'front': (2.4, .2, .35), 'middle': (3.0, .45, .7), 'body': (AMP, 1, 0)}


def mask(dive, layer):
    """新しい画面を見せる範囲の 1 層。潜るときは波より下、浮かぶときは波より上。層ごとに波の高さと山の位置を変える。"""
    amp, opacity, phase = LAYERS[layer]
    left = f"{-100 / PERIODS * phase:.1f}" if phase else "0"
    close = f"V300H{left}Z" if dive else f"V0H{left}Z"
    path = f"<path d='{wave(150, amp, phase, PERIODS + 1)}{close}'" + (f" fill-opacity='{opacity}'" if opacity < 1 else '') + "/>"
    return f"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 300' preserveAspectRatio='none'>{path}</svg>"


def glow(dive):
    """水面の縁の光。本体の波と同じ形の線と、新しい画面の側へ薄れる光。帯の高さは 45vh で、波の中心は新しい画面と反対の端から 4vh。"""
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
