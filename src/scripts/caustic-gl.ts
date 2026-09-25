// ライトテーマの水底に映る光の網。見え方は名刺の裏(CardBack.astro)に合わせてある。
// 1 枚目で網の明るさだけを描き、2 枚目でそれを読み直して色と影を付ける。

/** 網目 1 つの大きさ(CSS px)。浅い左上での大きさで、深いほど大きくなる。 */
const NET = 84;

const VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

// 網の明るさ。座標は CSS px、上が 0。
const NET_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
uniform vec2 uRes;
uniform float uTime;
out vec4 outColor;

const float NET = ${NET.toFixed(1)};
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
}`;

// 網に色を付けて重ねる。出力は乗算済みアルファ。
const COMPOSE_FRAG = `#version 300 es
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
}`;

export type Caustic = {
  resize(w: number, h: number): void;
  render(time: number): void;
  clear(): void;
  dispose(): void;
};

/** 結果は問い合わせない。リンク直後に成否を問い合わせると、コンパイルが終わるまでメインスレッドが止まる(数百 ms の環境がある)。 */
function compile(gl: WebGL2RenderingContext, vs: string, fs: string) {
  const prog = gl.createProgram()!;
  for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]] as const) {
    const sh = gl.createShader(type)!;
    gl.shaderSource(sh, src); gl.compileShader(sh);
    gl.attachShader(prog, sh);
  }
  gl.bindAttribLocation(prog, 0, 'aPos');
  gl.linkProgram(prog);
  return prog;
}

/** WebGL2 がない環境と、ソフトウェア描画の環境では null。CPU で描くと 1 コマに 100ms を超え、ページ全体が重くなる。 */
export function createCaustic(canvas: HTMLCanvasElement): Caustic | null {
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, failIfMajorPerformanceCaveat: true });
  if (!gl) return null;
  // ソフトウェア描画を許す起動設定では、上の指定だけでは弾かれない。描画器の名前でも確かめる。
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  const renderer = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
  if (/SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(renderer)) {
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return null;
  }
  const netProg = compile(gl, VERT, NET_FRAG);
  const composeProg = compile(gl, VERT, COMPOSE_FRAG);
  // 並列コンパイルが使えれば止まらずに終わりを確かめ、終わるまで描かない。使えなければ最初に描くときに一度だけ待つ。
  const parallel = gl.getExtension('KHR_parallel_shader_compile');
  let state: 'compiling' | 'ready' | 'failed' = 'compiling';
  let u: Record<'netRes' | 'time' | 'composeRes' | 'net', WebGLUniformLocation | null>;
  const progs = [netProg, composeProg];
  const checkReady = () => {
    if (state !== 'compiling') return state === 'ready';
    if (parallel && !progs.every((p) => gl.getProgramParameter(p, parallel.COMPLETION_STATUS_KHR))) return false;
    if (!progs.every((p) => gl.getProgramParameter(p, gl.LINK_STATUS))) {
      // 一度作った WebGL の Canvas は遷移のあとに白く塗られることがあるので隠す。
      state = 'failed';
      canvas.hidden = true;
      return false;
    }
    const loc = (prog: WebGLProgram, name: string) => gl.getUniformLocation(prog, name);
    u = {
      netRes: loc(netProg, 'uRes'), time: loc(netProg, 'uTime'),
      composeRes: loc(composeProg, 'uRes'), net: loc(composeProg, 'uNet'),
    };
    state = 'ready';
    return true;
  };
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const tex = gl.createTexture();
  const fbo = gl.createFramebuffer();
  let W = 0, H = 0, dpr = 1;

  return {
    resize(w, h) {
      // 高い倍率では描く点の数が増えすぎるため 1.5 倍で止める。
      dpr = Math.min(1.5, devicePixelRatio || 1);
      W = w; H = h;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG8, canvas.width, canvas.height, 0, gl.RG, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    },
    render(time) {
      if (!W || !H || !checkReady()) return;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.useProgram(netProg);
      gl.uniform2f(u.netRes, W, H); gl.uniform1f(u.time, time);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.useProgram(composeProg);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(u.net, 0); gl.uniform2f(u.composeRes, W, H);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    clear() {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    },
    dispose() {
      gl.deleteProgram(netProg); gl.deleteProgram(composeProg);
      gl.deleteBuffer(buf); gl.deleteTexture(tex); gl.deleteFramebuffer(fbo);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}
