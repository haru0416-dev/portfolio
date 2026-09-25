// ライトテーマの水底に映る光の網。見え方は名刺の裏(CardBack.astro)に合わせてある。
// 1 枚目で網の明るさだけを描き、2 枚目でそれを読み直して色と影を付ける。

import COMPOSE_FRAG from '../shaders/caustic-compose.frag.glsl';
import NET_FRAG from '../shaders/caustic-net.frag.glsl';
import VERT from '../shaders/caustic.vert.glsl';

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
