#version 300 es
// 2 枚目: 網を読み直して色と影を付ける。出力は乗算済みアルファ。
precision highp float;
in vec2 vUv;
uniform sampler2D uNet;
uniform vec2 uRes;
out vec4 outColor;

const vec3 WARM = vec3(255.0, 249.0, 236.0) / 255.0;
const vec3 COOL = vec3(228.0, 247.0, 252.0) / 255.0;
const vec3 SHADE = vec3(52.0, 104.0, 142.0) / 255.0;

vec2 net2(vec2 p) { return texture(uNet, vec2(p.x, uRes.y - p.y) / uRes).rg; }
float net(vec2 p) { return net2(p).r; }

void main() {
  vec2 p = vec2(vUv.x, 1.0 - vUv.y) * uRes;
  vec2 uv = p / uRes;
  float depth = clamp(length(p) / length(uRes), 0.0, 1.0);
  vec2 away = normalize(p + 1.0) * (0.8 + 0.8 * depth);
  vec2 here = net2(p);
  float lg = here.r, prism = here.g;
  vec3 lit = prism > 0.004 ? mix(vec3(lg), vec3(net(p - away), lg, net(p + away)), prism * 0.6) : vec3(lg);
  // 影は右下へ遠くずらして広くぼかす。近いと線に沿った濃い縁になる。
  vec2 off = vec2(1.0) * (12.0 + 14.0 * depth);
  float sh = (net(p - off) + net(p - off * 1.2 + vec2(3.0, -3.0)) + net(p - off * 0.8 + vec2(-3.0, 3.0)) + net(p - off * 1.4)) * 0.25;
  float fall = max(0.0, sh - lg) * 0.12;
  // 明るい地の上では、目の内側を沈めないと光の網に見えない。
  float cell = 0.035 * (1.0 - 0.7 * depth) * max(0.0, 1.0 - lg * 5.0);
  float shade = max(fall, cell);

  float a = max(lit.r, max(lit.g, lit.b));
  float dark = shade * (1.0 - a);
  float tone = min(1.0, uv.x * 0.45 + uv.y * 0.55);
  vec3 col = mix(WARM, COOL, tone) * lit + SHADE * dark;
  outColor = vec4(col, a + dark);
}
