import { isDark, onThemeChange } from './theme';
import WGSL from '../shaders/petals.wgsl';
import type { PetalsControl } from './petals';

const MAX = 8000;
const FLOATS = 12; // Particle の f32 数
const UNIFORM_BYTES = 96;
// デバイスが生きている間はアダプタも保持する(mapAsync などの Promise 系 API のため)。
const deviceAdapters = new WeakMap<GPUDevice, GPUAdapter>();


function cssColor(name: string): [number, number, number] {
  // CSS の算出色は oklch などでも返るため、Canvas 2D 経由で sRGB の数値に変換する。
  const el = document.createElement('span');
  el.style.color = `var(${name})`;
  document.body.append(el);
  const computed = getComputedStyle(el).color;
  el.remove();
  const c = document.createElement('canvas'); c.width = c.height = 1;
  const x = c.getContext('2d')!;
  x.fillStyle = computed; x.fillRect(0, 0, 1, 1);
  const [r, g, b] = x.getImageData(0, 0, 1, 1).data;
  return [r / 255, g / 255, b / 255];
}

function createRenderer(device: GPUDevice, module: GPUShaderModule, format: GPUTextureFormat, dpr: number) {
  const uniform = device.createBuffer({ size: UNIFORM_BYTES, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const storage = device.createBuffer({ size: MAX * FLOATS * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
  // 同一パスで storage と read-only-storage を併用できないため、用途別に束ねる。
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
  const data = new Float32Array(MAX * FLOATS);
  const depths = new Float64Array(MAX);
  const st = { W: 0, H: 0, count: 0, t: 0 };

  const colors = () => {
    const bg0 = cssColor('--paper'), bg1 = cssColor('--paper-2'), tint = cssColor('--accent');
    const dark = isDark() ? 1 : 0;
    uf.set([...bg0, 1], 8); uf.set([...bg1, 1], 12); uf.set([...tint, 1], 16); uf.set([dark, 0, 0, 0], 20);
  };

  // 半透明の合成順を保つため、奥から手前に並べる。
  const seed = (W: number, H: number, sizeMul = 1) => {
    st.W = W; st.H = H;
    st.count = Math.min(MAX, Math.round((W * H) / (1000 * dpr * dpr * sizeMul * sizeMul)));
    for (let i = 0; i < MAX; i++) depths[i] = 0.3 + 0.7 * Math.pow(Math.random(), 1.1);
    depths.sort();
    for (let i = 0; i < MAX; i++) {
      const d = depths[i], o = i * FLOATS;
      data[o] = Math.random() * W; data[o + 1] = Math.random() * H * 1.2 - H * 0.2;
      data[o + 2] = 0; data[o + 3] = 20 * d;
      data[o + 4] = Math.random() * Math.PI * 2; data[o + 5] = (Math.random() - 0.5) * 0.7;
      data[o + 6] = Math.random() * Math.PI * 2; data[o + 7] = 1.2 + Math.random() * 2.2;
      data[o + 8] = (16 + Math.random() * 28) * d * dpr * sizeMul; data[o + 9] = d;
      data[o + 10] = (Math.random() * 5) | 0; data[o + 11] = Math.random() * Math.PI * 2;
    }
    device.queue.writeBuffer(storage, 0, data, 0, st.count * FLOATS);
  };

  /** dt は秒。 */
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
  let device: GPUDevice | undefined;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return null;
    device = await adapter.requestDevice();
    deviceAdapters.set(device, adapter);
    device.onuncapturederror = (e) => console.error('[petals-gpu]', e.error.message);
    const module = device.createShaderModule({ code: WGSL });
    const info = await module.getCompilationInfo();
    for (const m of info.messages) if (m.type === 'error') {
      console.error('[petals-gpu] WGSL', m.lineNum, m.message);
      device.destroy(); deviceAdapters.delete(device);
      return null;
    }
    return { device, module };
  } catch (error) {
    if (device) { device.destroy(); deviceAdapters.delete(device); }
    console.error('[petals-gpu]', error);
    return null;
  }
}

export async function startPetalsGPU(canvas: HTMLCanvasElement): Promise<({ count: number } & PetalsControl) | null> {
  const gpu = await makeDevice();
  if (!gpu) return null;
  const { device, module } = gpu;
  let dispose = () => { device.destroy(); deviceAdapters.delete(device); };
  try {
    const ctx = canvas.getContext('webgpu');
    if (!ctx) { dispose(); return null; }
    const format = navigator.gpu.getPreferredCanvasFormat();
    const reduce = matchMedia('(prefers-reduced-motion: reduce)');
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const r = createRenderer(device, module, format, dpr);

    let raf = 0, visible = true, paused = false, disposed = false, last = 0;
    const render = (dt: number) => {
      if (disposed || !r.st.W || !r.st.H) return;
      device.queue.submit([r.encodeFrame(dt, ctx.getCurrentTexture().createView()).finish()]);
    };
    const frame = (now: number) => {
      if (disposed || reduce.matches || paused || !visible || document.hidden) return;
      const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
      last = now;
      render(dt);
      raf = requestAnimationFrame(frame);
    };
    const start = () => { cancelAnimationFrame(raf); last = performance.now(); if (!disposed && !reduce.matches && !paused && visible && !document.hidden) raf = requestAnimationFrame(frame); };

    const resize = () => {
      if (disposed) return;
      const b = canvas.getBoundingClientRect();
      const W = Math.round(b.width * dpr), H = Math.round(b.height * dpr);
      if (!W || !H || (W === r.st.W && H === r.st.H)) return;
      canvas.width = W; canvas.height = H;
      ctx.configure({ device, format, alphaMode: 'opaque' });
      r.seed(W, H);
      if (reduce.matches) {
        for (let i = 0; i < 90; i++) device.queue.submit([r.encodeFrame(1 / 30).finish()]);
        render(1 / 30);
      } else render(0);
    };

    let offTheme: (() => void) | undefined;
    let capture: ((steps?: number, sizeMul?: number) => Promise<string>) | undefined;
    const debugWindow = window as Window & { __petalsCapture?: typeof capture };
    const ro = new ResizeObserver(resize);
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; start(); });
    const onMotion = () => { if (disposed) return; start(); if (reduce.matches) render(0); };
    dispose = () => {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(raf); offTheme?.(); ro.disconnect(); io.disconnect();
      document.removeEventListener('visibilitychange', start); reduce.removeEventListener('change', onMotion);
      if (capture && debugWindow.__petalsCapture === capture) delete debugWindow.__petalsCapture;
      ctx.unconfigure(); device.destroy(); deviceAdapters.delete(device);
    };
    offTheme = onThemeChange(() => {
      if (disposed) return;
      r.colors();
      if (reduce.matches || paused || !visible || document.hidden) render(0);
    });
    ro.observe(canvas); io.observe(canvas);
    document.addEventListener('visibilitychange', start);
    reduce.addEventListener('change', onMotion);
    resize();
    start();
    if (location.search.includes('debug')) {
      capture = async (steps = 240, sizeMul = 1): Promise<string> => {
        if (disposed) throw new Error('petals disposed');
        const g2 = await makeDevice();
        if (!g2) throw new Error('no device');
        try {
          if (disposed) throw new Error('petals disposed');
          const W = canvas.width, H = canvas.height;
          const r2 = createRenderer(g2.device, g2.module, 'rgba8unorm', dpr);
          r2.seed(W, H, sizeMul);
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
          buf.unmap();
          const c = document.createElement('canvas'); c.width = W; c.height = H;
          c.getContext('2d')!.putImageData(img, 0, 0);
          return c.toDataURL('image/png');
        } finally {
          g2.device.destroy(); deviceAdapters.delete(g2.device);
        }
      };
      debugWindow.__petalsCapture = capture;
    }
    return {
      count: r.st.count,
      pause() { paused = true; cancelAnimationFrame(raf); },
      resume() { paused = false; start(); },
      dispose,
    };
  } catch (error) {
    dispose();
    console.error('[petals-gpu]', error);
    return null;
  }
}
