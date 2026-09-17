// WebGPU 版 Petals。
// 物理はコンピュートシェーダ、描画はインスタンス化した四角形の上で花びらの形を SDF で計算する。
// 背景(空のグラデーションとボケ光)もシェーダで描く。

const MAX = 8000;
const FLOATS = 12; // Particle の f32 数
const UNIFORM_BYTES = 96;
// アダプタを GC させない(解放されると mapAsync などの Promise 系 API が失敗する)
let keepAdapter: GPUAdapter | null = null;

const WGSL = /* wgsl */ `
struct Particle {
  pos: vec2f, vel: vec2f,
  rot: f32, spin: f32, tilt: f32, tiltSpeed: f32,
  size: f32, depth: f32, color: f32, phase: f32,
};
struct U {
  res: vec2f, time: f32, dt: f32,
  wind: vec2f, count: u32, seed: f32,
  bg0: vec4f, bg1: vec4f, tint: vec4f, dark: vec4f,
};
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read_write> particles: array<Particle>;
@group(0) @binding(2) var<storage, read> particlesRO: array<Particle>; // 頂点段は読み取り専用で参照する

// ---------- ノイズ ----------
fn hash3(p: vec3f) -> f32 {
  var q = fract(p * vec3f(0.1031, 0.1030, 0.0973));
  q += dot(q, q.yxz + 33.33);
  return fract((q.x + q.y) * q.z);
}
fn noise3(p: vec3f) -> f32 {
  let i = floor(p); let f = fract(p);
  let w = f * f * (3.0 - 2.0 * f);
  let a = mix(mix(hash3(i), hash3(i + vec3f(1,0,0)), w.x), mix(hash3(i + vec3f(0,1,0)), hash3(i + vec3f(1,1,0)), w.x), w.y);
  let b = mix(mix(hash3(i + vec3f(0,0,1)), hash3(i + vec3f(1,0,1)), w.x), mix(hash3(i + vec3f(0,1,1)), hash3(i + vec3f(1,1,1)), w.x), w.y);
  return mix(a, b, w.z);
}
fn hash1(x: f32) -> f32 { return fract(sin(x * 12.9898 + 78.233) * 43758.5453); }

// ---------- 物理 ----------
@compute @workgroup_size(64)
fn simulate(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x;
  if (i >= u.count) { return; }
  var p = particles[i];
  let d = p.depth;
  // 風の場: 2 つのノイズで渦を作る。奥ほどゆっくり
  let s = 0.0025;
  let n1 = noise3(vec3f(p.pos * s, u.time * 0.18)) - 0.5;
  let n2 = noise3(vec3f(p.pos.yx * s * 1.3 + 17.0, u.time * 0.14 + 3.0)) - 0.5;
  let flow = vec2f(n1, n2) * 160.0;
  let flutter = vec2f(sin(u.time * 2.1 + p.phase), cos(u.time * 1.7 + p.phase * 1.3)) * 10.0;
  let goal = vec2f(u.wind.x + flow.x + flutter.x, 34.0 + 46.0 * d + flow.y * 0.5 + flutter.y);
  p.vel = mix(p.vel, goal * d, 1.0 - exp(-u.dt * 1.8));
  p.pos += p.vel * u.dt;
  p.rot += (p.spin + n1 * 1.5) * u.dt;
  p.tilt += p.tiltSpeed * u.dt;
  let m = p.size * 3.0;
  if (p.pos.y > u.res.y + m || p.pos.x < -m * 6.0 || p.pos.x > u.res.x + m * 6.0) {
    let r = hash1(f32(i) * 0.731 + u.time);
    p.pos = vec2f(r * u.res.x, -m - hash1(r) * 40.0);
    p.vel = vec2f(0.0, 20.0 * d);
  }
  particles[i] = p;
}

// ---------- 背景 ----------
struct BgOut { @builtin(position) pos: vec4f, @location(0) uv: vec2f };
@vertex fn bgVert(@builtin(vertex_index) vi: u32) -> BgOut {
  var pts = array<vec2f, 3>(vec2f(-1, -1), vec2f(3, -1), vec2f(-1, 3));
  var o: BgOut;
  o.pos = vec4f(pts[vi], 0.0, 1.0);
  o.uv = pts[vi] * 0.5 + 0.5;
  return o;
}
@fragment fn bgFrag(i: BgOut) -> @location(0) vec4f {
  let uv = vec2f(i.uv.x, 1.0 - i.uv.y);
  var col = mix(u.bg0.rgb, u.bg1.rgb, smoothstep(0.0, 1.0, uv.y));
  // 左上からの柔らかい光
  let light = exp(-length((uv - vec2f(0.15, 0.05)) * vec2f(1.0, 1.4)) * 1.6);
  col = mix(col, mix(col, u.tint.rgb, 0.22), light * 0.35);
  // 左上から差す淡い光条(ゆっくり揺れる)
  let ray = uv.x * 0.8 + uv.y * 0.6;
  let rays = pow(0.5 + 0.5 * sin(ray * 22.0 + noise3(vec3f(ray * 6.0, uv.y * 2.0, u.time * 0.1)) * 3.0 - u.time * 0.15), 3.0);
  col += (u.tint.rgb * 0.35 + 0.65) * rays * 0.045 * light * (1.0 - 0.6 * u.dark.x) * (1.0 - uv.y);
  // ボケ光: ゆっくり漂う丸い光
  let asp = u.res.x / u.res.y;
  for (var k = 0; k < 9; k++) {
    let fk = f32(k);
    let c = vec2f(hash1(fk + 1.0) + sin(u.time * 0.05 + fk) * 0.08, hash1(fk + 9.0) + cos(u.time * 0.04 + fk * 1.7) * 0.06);
    let r = 0.06 + hash1(fk + 20.0) * 0.12;
    let dist = length((uv - c) * vec2f(asp, 1.0));
    let b = smoothstep(r, r * 0.55, dist) * (0.025 + 0.03 * hash1(fk + 31.0));
    col += u.tint.rgb * b * (0.6 + 0.4 * sin(u.time * 0.3 + fk));
  }
  // 周辺減光
  let v = smoothstep(1.35, 0.35, length((uv - 0.5) * vec2f(1.15, 1.0)));
  col = mix(col * (1.0 - 0.12 * u.dark.x) , col, v);
  // ディザで縞を消す
  col += (hash3(vec3f(i.pos.xy, u.time)) - 0.5) / 255.0;
  return vec4f(col, 1.0);
}

// ---------- 花びら ----------
struct POut {
  @builtin(position) pos: vec4f,
  @location(0) uv: vec2f,
  @location(1) depth: f32,
  @location(2) color: f32,
  @location(3) face: f32,
  @location(4) px: f32,
};
@vertex fn petalVert(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> POut {
  let p = particlesRO[ii];
  var corners = array<vec2f, 6>(vec2f(-1,-1), vec2f(1,-1), vec2f(-1,1), vec2f(-1,1), vec2f(1,-1), vec2f(1,1));
  let c = corners[vi];
  let face = cos(p.tilt);
  let sx = 0.28 + 0.72 * abs(face);
  let half = p.size * 1.25;
  let local = vec2f(c.x * sx, c.y) * half;
  let cs = cos(p.rot); let sn = sin(p.rot);
  let world = p.pos + vec2f(cs * local.x - sn * local.y, sn * local.x + cs * local.y);
  var o: POut;
  let ndc = world / u.res * 2.0 - 1.0;
  o.pos = vec4f(ndc.x, -ndc.y, 0.0, 1.0);
  o.uv = c;
  o.depth = p.depth;
  o.color = p.color;
  o.face = face;
  o.px = half * sx; // 1 uv 単位あたりの画素数(横)
  return o;
}
fn petalSdf(uv: vec2f) -> f32 {
  // 付け根(y=-1)が細く、先端(y=+1)に切れ込み
  let wy = mix(0.42, 1.0, smoothstep(-1.0, 0.35, uv.y));
  let e = length(vec2f(uv.x / (0.66 * wy), uv.y / 0.92)) - 1.0;
  let notch = length(uv - vec2f(0.0, 1.0)) - 0.24;
  return max(e, -notch);
}
fn palette(k: f32) -> vec3f {
  var cols = array<vec3f, 5>(
    vec3f(0.976, 0.788, 0.847), vec3f(0.961, 0.702, 0.784), vec3f(0.984, 0.851, 0.894),
    vec3f(0.957, 0.635, 0.737), vec3f(0.992, 0.914, 0.941));
  return cols[u32(k) % 5u];
}
@fragment fn petalFrag(i: POut) -> @location(0) vec4f {
  let sdf = petalSdf(i.uv);
  // 奥ほどぼける。ぼけ幅は uv 単位で指定し、画素数で正規化
  let blur = mix(0.42, 0.0, smoothstep(0.35, 1.0, i.depth));
  let aa = fwidth(sdf) * 1.2 + blur;
  var a = 1.0 - smoothstep(-aa * 0.5, aa * 0.5, sdf);
  // 色: 付け根が濃く先端が淡い
  var base = palette(i.color);
  base = mix(base, vec3f(1.0), 0.10 * sin(i.color * 7.0 + i.depth * 31.0)); // 個体差
  // ライトでは背景が淡いので、花びらを少し濃くして輪郭を出す
  // ライトでは少し濃く、ダークでは桃色を強めて灰色に見えないようにする
  base = mix(mix(base, u.tint.rgb, 0.18) * 0.96, mix(base, u.tint.rgb, 0.35), u.dark.x);
  let dark = base * 0.84;
  let light = mix(base, vec3f(1.0), mix(0.18, 0.08, u.dark.x));
  var col = mix(dark, light, smoothstep(-1.0, 1.0, i.uv.y));
  // 中央の筋と、縁の淡い光
  let vein = exp(-i.uv.x * i.uv.x * 38.0) * (1.0 - abs(i.uv.y)) * mix(0.22, 0.10, u.dark.x);
  let rim = smoothstep(-0.02, -0.28, sdf);
  col = mix(col + vein, col, rim * 0.0) + vein;
  col = mix(col * 1.06, col, rim);
  // 裏返るときは少し白く透ける
  let back = 1.0 - abs(i.face);
  col = mix(col, vec3f(1.0, 0.96, 0.97), back * 0.12);
  a *= mix(0.92, 0.72, back);
  // 奥行きで薄く
  a *= mix(0.5, 1.0, i.depth);
  // 淡い光暈(手前ほど)
  let halo = exp(-max(sdf, 0.0) * 5.0) * 0.08 * i.depth * u.dark.x; // ダークでは淡く光る
  // ライトでは手前の花びらの下に薄い落ち影
  let shadow = exp(-max(sdf, 0.0) * 3.0) * 0.10 * i.depth * (1.0 - u.dark.x) * (1.0 - a);
  let out = col * a + base * halo + u.tint.rgb * 0.45 * shadow;
  return vec4f(out, a + halo + shadow);
}
`;

function cssColor(name: string): [number, number, number] {
  const el = document.createElement('span');
  el.style.color = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  document.body.appendChild(el);
  const m = getComputedStyle(el).color.match(/[\d.]+/g)!;
  el.remove();
  return [+m[0] / 255, +m[1] / 255, +m[2] / 255];
}

type Renderer = ReturnType<typeof createRenderer>;

/** デバイスに対してパイプラインとバッファを組み立てる。Canvas でもオフスクリーンでも同じ */
function createRenderer(device: GPUDevice, module: GPUShaderModule, format: GPUTextureFormat, dpr: number) {
  const uniform = device.createBuffer({ size: UNIFORM_BYTES, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const storage = device.createBuffer({ size: MAX * FLOATS * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
  // 計算用(読み書き)と描画用(読み取り専用)でバインドグループを分ける。
  // 同じバッファを 1 つのパス内で両方の用途に束ねると検証エラーになる。
  const cLayout = device.createBindGroupLayout({ entries: [
    { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
    { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
  ] });
  const rLayout = device.createBindGroupLayout({ entries: [
    { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
    { binding: 2, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
  ] });
  const cBind = device.createBindGroup({ layout: cLayout, entries: [{ binding: 0, resource: { buffer: uniform } }, { binding: 1, resource: { buffer: storage } }] });
  const rBind = device.createBindGroup({ layout: rLayout, entries: [{ binding: 0, resource: { buffer: uniform } }, { binding: 2, resource: { buffer: storage } }] });
  const cpl = device.createPipelineLayout({ bindGroupLayouts: [cLayout] });
  const pl = device.createPipelineLayout({ bindGroupLayouts: [rLayout] });
  const compute = device.createComputePipeline({ layout: cpl, compute: { module, entryPoint: 'simulate' } });
  const bgPipe = device.createRenderPipeline({
    layout: pl, vertex: { module, entryPoint: 'bgVert' },
    fragment: { module, entryPoint: 'bgFrag', targets: [{ format }] }, primitive: { topology: 'triangle-list' },
  });
  const petalPipe = device.createRenderPipeline({
    layout: pl, vertex: { module, entryPoint: 'petalVert' },
    fragment: { module, entryPoint: 'petalFrag', targets: [{ format, blend: {
      color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
      alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
    } }] }, primitive: { topology: 'triangle-list' },
  });

  const uf = new Float32Array(UNIFORM_BYTES / 4);
  const uu = new Uint32Array(uf.buffer);
  const st = { W: 0, H: 0, count: 0, t: 0 };

  const colors = () => {
    const bg0 = cssColor('--paper'), bg1 = cssColor('--paper-2'), tint = cssColor('--accent');
    const dark = document.documentElement.classList.contains('dark') ? 1 : 0;
    uf.set([...bg0, 1], 8); uf.set([...bg1, 1], 12); uf.set([...tint, 1], 16); uf.set([dark, 0, 0, 0], 20);
  };

  /** 画面サイズを決めて花びらを撒く。奥から手前の順に並べる(半透明の重なりが自然になる) */
  const seed = (W: number, H: number) => {
    st.W = W; st.H = H;
    st.count = Math.min(MAX, Math.round((W * H) / (900 * dpr * dpr)));
    const data = new Float32Array(MAX * FLOATS);
    const depths = Array.from({ length: MAX }, () => 0.3 + 0.7 * Math.pow(Math.random(), 1.25)).sort((a, b) => a - b);
    for (let i = 0; i < MAX; i++) {
      const d = depths[i], o = i * FLOATS;
      data[o] = Math.random() * W; data[o + 1] = Math.random() * H * 1.2 - H * 0.2;
      data[o + 2] = 0; data[o + 3] = 20 * d;
      data[o + 4] = Math.random() * Math.PI * 2; data[o + 5] = (Math.random() - 0.5) * 1.6;
      data[o + 6] = Math.random() * Math.PI * 2; data[o + 7] = 1.2 + Math.random() * 2.2;
      data[o + 8] = (14 + Math.random() * 20) * d * dpr; data[o + 9] = d;
      data[o + 10] = (Math.random() * 5) | 0; data[o + 11] = Math.random() * Math.PI * 2;
    }
    device.queue.writeBuffer(storage, 0, data);
  };

  /** 1 ステップ進めて view に描く。view が無ければ物理だけ進める。コマンドはまだ送信しない */
  const encodeFrame = (dt: number, view?: GPUTextureView) => {
    st.t += dt;
    uf[0] = st.W; uf[1] = st.H; uf[2] = st.t; uf[3] = dt;
    uf[4] = (40 * Math.sin(st.t * 0.23) + 25 * Math.sin(st.t * 0.61 + 1.3)) * dpr; uf[5] = 0;
    uu[6] = st.count; uf[7] = 0;
    device.queue.writeBuffer(uniform, 0, uf);
    const enc = device.createCommandEncoder();
    const cp = enc.beginComputePass();
    cp.setPipeline(compute); cp.setBindGroup(0, cBind); cp.dispatchWorkgroups(Math.ceil(st.count / 64)); cp.end();
    if (view) {
      const rp = enc.beginRenderPass({ colorAttachments: [{ view, loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 1 } }] });
      rp.setPipeline(bgPipe); rp.setBindGroup(0, rBind); rp.draw(3);
      rp.setPipeline(petalPipe); rp.setBindGroup(0, rBind); rp.draw(6, st.count);
      rp.end();
    }
    return enc;
  };

  colors();
  return { st, colors, seed, encodeFrame };
}

async function makeDevice(): Promise<{ device: GPUDevice; module: GPUShaderModule } | null> {
  if (!('gpu' in navigator)) return null;
  const adapter = await navigator.gpu.requestAdapter().catch(() => null);
  if (!adapter) return null;
  keepAdapter = adapter;
  const device = await adapter.requestDevice();
  device.onuncapturederror = (e) => console.error('[petals-gpu]', e.error.message);
  const module = device.createShaderModule({ code: WGSL });
  const info = await module.getCompilationInfo();
  for (const m of info.messages) if (m.type === 'error') { console.error('[petals-gpu] WGSL', m.lineNum, m.message); return null; }
  return { device, module };
}

export async function startPetalsGPU(canvas: HTMLCanvasElement): Promise<{ count: number } | null> {
  const gpu = await makeDevice();
  if (!gpu) return null;
  const { device, module } = gpu;
  const ctx = canvas.getContext('webgpu');
  if (!ctx) return null;
  const format = navigator.gpu.getPreferredCanvasFormat();
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const r = createRenderer(device, module, format, dpr);

  let raf = 0, visible = true, last = 0;
  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    device.queue.submit([r.encodeFrame(dt, ctx.getCurrentTexture().createView()).finish()]);
    if (!reduce && visible) raf = requestAnimationFrame(frame);
  };
  const start = () => { cancelAnimationFrame(raf); last = performance.now(); if (!reduce) raf = requestAnimationFrame(frame); };

  const resize = () => {
    const b = canvas.getBoundingClientRect();
    if (!b.width) return;
    canvas.width = Math.round(b.width * dpr); canvas.height = Math.round(b.height * dpr);
    ctx.configure({ device, format, alphaMode: 'opaque' });
    r.seed(canvas.width, canvas.height);
    if (reduce) {
      for (let i = 0; i < 90; i++) device.queue.submit([r.encodeFrame(1 / 30).finish()]);
      device.queue.submit([r.encodeFrame(1 / 30, ctx.getCurrentTexture().createView()).finish()]);
    }
  };

  new MutationObserver(r.colors).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? start() : cancelAnimationFrame(raf); }).observe(canvas);
  resize();
  start();

  // ?debug のときだけ: 別デバイスで同じ描画をオフスクリーンに行い、画素を PNG で返す(GPU のない検証環境用)
  if (location.search.includes('debug')) {
    (window as any).__petalsCapture = async (steps = 240): Promise<string> => {
      const g2 = await makeDevice();
      if (!g2) throw new Error('no device');
      const W = canvas.width, H = canvas.height;
      const r2 = createRenderer(g2.device, g2.module, 'rgba8unorm', dpr);
      r2.seed(W, H);
      for (let i = 0; i < steps; i++) g2.device.queue.submit([r2.encodeFrame(1 / 60).finish()]);
      const tex = g2.device.createTexture({ size: [W, H], format: 'rgba8unorm', usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC });
      const bpr = Math.ceil((W * 4) / 256) * 256;
      const buf = g2.device.createBuffer({ size: bpr * H, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
      const enc = r2.encodeFrame(1 / 60, tex.createView());
      enc.copyTextureToBuffer({ texture: tex }, { buffer: buf, bytesPerRow: bpr }, [W, H]);
      g2.device.queue.submit([enc.finish()]);
      await g2.device.queue.onSubmittedWorkDone();
      await buf.mapAsync(GPUMapMode.READ);
      const src = new Uint8Array(buf.getMappedRange());
      const img = new ImageData(W, H);
      for (let y = 0; y < H; y++) img.data.set(src.subarray(y * bpr, y * bpr + W * 4), y * W * 4);
      for (let i = 3; i < img.data.length; i += 4) img.data[i] = 255;
      buf.unmap(); tex.destroy();
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      c.getContext('2d')!.putImageData(img, 0, 0);
      return c.toDataURL('image/png');
    };
  }
  return { count: r.st.count };
}
