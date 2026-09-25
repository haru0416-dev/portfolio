#version 300 es
// 1 枚目: 網の明るさ(R)と虹色のにじみの強さ(G)。座標は CSS px、上が 0。
precision highp float;
in vec2 vUv;
uniform vec2 uRes;
uniform float uTime;
out vec4 outColor;

// 網目 1 つの大きさ(CSS px)。浅い左上での大きさで、深いほど大きくなる。
const float NET = 84.0;
// 波の進む向き(左上から右下へ約 30°)。網の目はこの向きに伸びる。
const float WAVE = -0.4887;
const float STRETCH = 1.28;

vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}
vec2 seed(vec2 n, float t) {
  vec2 h = hash2(n), k = hash2(n + 17.3);
  float a = t * (0.6 + 0.8 * k.x) + k.y * 6.2832;
  return 0.2 + 0.6 * h + 0.3 * vec2(sin(a), cos(a * 0.8));
}

// 細かい網は線の太さをそろえなくてよいので、境界の差だけで 1 回で済ませる。
float fineGap(vec2 q, float t) {
  vec2 n = floor(q), f = fract(q);
  float f1 = 8.0, f2 = 8.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 c = vec2(float(i), float(j));
    vec2 d = c + seed(n + c + 41.0, t) - f;
    float dd = dot(d, d);
    if (dd < f1) { f2 = f1; f1 = dd; } else if (dd < f2) { f2 = dd; }
  }
  return sqrt(f2) - sqrt(f1);
}

void main() {
  vec2 p = vec2(vUv.x, 1.0 - vUv.y) * uRes;
  // 深さ。太陽のある左上で 0、右下の角で 1。
  float depth = clamp(length(p) / length(uRes), 0.0, 1.0);
  float t = uTime * 0.25;
  float g = 1.0 + 0.45 * depth;
  float cs = cos(WAVE), sn = sin(WAVE);
  vec2 r = vec2(cs * p.x + sn * p.y, -sn * p.x + cs * p.y);
  r.x /= STRETCH;
  vec2 q = r / (NET * g);
  // 境界をゆるく曲げて、多角形らしさを消す。
  q += vec2(0.22 * sin(q.y * 1.7 + t * 0.9) + 0.1 * sin(q.y * 4.1 - t * 1.3),
            0.22 * sin(q.x * 1.3 - t * 0.8) + 0.1 * sin(q.x * 3.7 + t * 1.1));

  vec2 n = floor(q), f = fract(q);
  float f1 = 8.0, f2 = 8.0, f3 = 8.0;
  vec2 mg = vec2(0.0), mr = vec2(0.0);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 c = vec2(float(i), float(j));
    vec2 d = c + seed(n + c, t) - f;
    float dd = dot(d, d);
    if (dd < f1) { f3 = f2; f2 = f1; f1 = dd; mg = c; mr = d; }
    else if (dd < f2) { f3 = f2; f2 = dd; }
    else if (dd < f3) { f3 = dd; }
  }
  // いちばん近い境界までの距離。線の太さを画面の px でそろえるのに使う。
  float edge = 8.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 c = mg + vec2(float(i), float(j));
    vec2 d = c + seed(n + c, t) - f;
    vec2 e = d - mr;
    if (dot(e, e) > 1e-5) edge = min(edge, dot(0.5 * (mr + d), normalize(e)));
  }
  float px = NET * g * 1.12;
  float dpx = edge * px;
  float s1 = sqrt(f1), gap = (sqrt(f2) - s1) * px;

  float vary = 0.5 + 0.5 * sin(q.x * 0.9 + t * 0.6) * sin(q.y * 1.1 - t * 0.5);
  float taper = smoothstep(0.08, 0.55, 0.5 + 0.5 * sin(q.x * 4.3 - q.y * 3.1 + t * 0.7) * sin(q.y * 5.3 + t * 0.4 + q.x * 1.9));
  float hero = smoothstep(0.7, 0.97, 0.5 + 0.5 * sin(q.x * 0.35 + t * 0.25) * sin(q.y * 0.42 - q.x * 0.18 - t * 0.2));

  // 点から境界までの長さで目の大きさを測る(ふつうは 0.5 前後)。小さな目ほど線を細く明るくする。
  float cellSize = clamp((s1 + edge) / 0.5, 0.6, 1.5);
  float width = (0.55 + 0.8 * depth) * (0.75 + 0.4 * vary + 0.35 * hero) * cellSize;
  float soft = 0.6 + 1.6 * depth;
  float core = 1.0 - smoothstep(width - soft * 0.5, width + soft, dpx);
  // 縁の光は目ごとに片側にだけ付ける。
  float bright = smoothstep(0.35, 0.8, hash2(n + mg + 7.0).x);
  float rim = exp(-gap / (5.0 + 8.0 * depth)) * bright * 1.8;
  float bloom = exp(-dpx / (5.0 + 8.0 * depth)) * hero;
  // 線が 3 本出会う点。
  float node = max(0.0, 1.0 - (sqrt(f3) - s1) / 0.3);
  node = node * node * node;
  float sun = max(0.0, 1.0 - length(p / uRes) / 0.7);
  float glint = node * node * sun * (0.5 + 0.5 * sin(uTime * 2.25 + q.x * 13.1 + q.y * 7.7));

  float fine = exp(-fineGap(q * 2.1 + 5.0, t * 1.4) * px / 2.1 / (1.2 + 1.5 * depth));
  float light = core * (0.18 + 0.22 * vary + 0.8 * hero) * mix(0.1, 1.0, max(taper, hero)) / cellSize
              + rim * 0.1 + bloom * 0.22 + fine * 0.1 + node * 0.45 + glint * 0.8;
  light *= mix(1.0, 0.35, smoothstep(0.15, 0.9, depth));
  float prism = hero * core * smoothstep(0.75, 1.0, sin(uTime * 0.6 + q.x * 0.9 - q.y * 0.5));
  outColor = vec4(min(1.0, light), prism, 0.0, 1.0);
}
