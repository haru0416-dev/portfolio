export type DitherOptions = { palette: PaletteName };
export type PaletteName = 'violet' | 'sakura' | 'mono';
export type DitherControl = { set(opts: Partial<DitherOptions>): void; pause(): void; resume(): void; dispose(): void };

/** 1 ピクセルの大きさ(CSS px)。 */
const PIXEL = 2;
/** Bayer 2×2 の閾値を -0.5〜0.5 に正規化したもの。 */
const BAYER2 = [0, 2, 3, 1].map((v) => (v + 0.5) / 4 - 0.5);

type RGB = [number, number, number];
const hex = (s: string): RGB => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];

/** 先頭が空、次が惑星の暗部・明部、縁、星の順。 */
export const PALETTES: Record<PaletteName, { label: string; colors: RGB[] }> = {
  violet: { label: 'Violet', colors: ['#05050a', '#3b1d6e', '#9b6ff5', '#52c8ff', '#f4f4ff'].map(hex) },
  sakura: { label: 'Sakura', colors: ['#171320', '#5a2c4a', '#f27ba7', '#9be0d0', '#fff6f9'].map(hex) },
  mono:   { label: 'Mono',   colors: ['#000000', '#ffffff'].map(hex) },
};

const hash = (x: number, y: number) => {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const smooth = (t: number) => t * t * (3 - 2 * t);
function noise(x: number, y: number) {
  const xi = Math.floor(x), yi = Math.floor(y), tx = smooth(x - xi), ty = smooth(y - yi);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
}
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (a: number, b: number, v: number) => smooth(clamp01((v - a) / (b - a)));

export function startDither(canvas: HTMLCanvasElement, initial: DitherOptions): DitherControl {
  const ctx = canvas.getContext('2d', { alpha: false })!;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const opts: DitherOptions = { ...initial };
  let W = 0, H = 0, img: ImageData | null = null, raf = 0, running = false, paused = false, last = 0, t = 0;
  // geometry は 3 値ずつ: 惑星は [法線 Z, 経度, 縁]、星は [-1, 速度, 位相]。
  let xs = new Float64Array(0), ys = new Float64Array(0), geometry = new Float64Array(0);
  let pixels = new Uint32Array(0), count = 0;
  let backgroundR = -1, backgroundG = -1, backgroundB = -1;

  const resize = () => {
    const w = Math.floor(canvas.clientWidth / PIXEL), h = Math.floor(canvas.clientHeight / PIXEL);
    if (!w || !h || (w === W && h === H)) return false;
    W = w; H = h; canvas.width = W; canvas.height = H;
    img = ctx.createImageData(W, H);
    backgroundR = backgroundG = backgroundB = -1;
    xs = new Float64Array(W); ys = new Float64Array(H);
    pixels = new Uint32Array(W * H); geometry = new Float64Array(W * H * 3); count = 0;
    // Float32 にすると色の量子化の境界が変わって絵が変わるため、Float64 で持つ。
    const cx = W * 1.18, cy = -H * 0.42, R = H * 1.15;
    for (let x = 0; x < W; x++) xs[x] = (x + 0.5 - cx) / R;
    for (let y = 0; y < H; y++) {
      const dy = ys[y] = (y + 0.5 - cy) / R;
      for (let x = 0; x < W; x++) {
        const dx = xs[x], d = Math.hypot(dx, dy), j = count * 3;
        if (d < 1) {
          const nz = Math.sqrt(1 - d * d);
          geometry[j] = nz;
          geometry[j + 1] = Math.atan2(dx, nz) * 3;
          geometry[j + 2] = smoothstep(0.965, 0.995, d);
        } else {
          const density = 0.006 + 0.09 * smoothstep(1.4, 1.02, d), h1 = hash(x, y);
          if (h1 >= density) continue;
          geometry[j] = -1;
          geometry[j + 1] = 1.5 + hash(y, x) * 2;
          geometry[j + 2] = h1 * 40;
        }
        pixels[count++] = y * W + x;
      }
    }
    render();
    return true;
  };

  const render = () => {
    if (!img) return;
    const data = img.data;
    const pal = PALETTES[opts.palette].colors;
    const spread = pal.length === 2 ? 0.9 : 0.4;
    const lx = -0.55 + Math.cos(t * 0.1) * 0.2, ly = 0.45 + Math.sin(t * 0.07) * 0.15, lz = 0.7;
    const ln = Math.hypot(lx, ly, lz);
    const bg = pal[0], dark = pal.length === 2 ? pal[0] : pal[1], light = pal.length === 2 ? pal[1] : pal[2];
    const rim = pal.length === 2 ? pal[1] : pal[3], star = pal.length === 2 ? pal[1] : pal[4];
    // 何もない空は常にパレットの先頭色。サイズや色が変わるときだけ塗る。
    if (backgroundR !== bg[0] || backgroundG !== bg[1] || backgroundB !== bg[2]) {
      for (let i = 0; i < data.length; i += 4) {
        data[i] = bg[0]; data[i + 1] = bg[1]; data[i + 2] = bg[2]; data[i + 3] = 255;
      }
      [backgroundR, backgroundG, backgroundB] = bg;
    }
    for (let p = 0; p < count; p++) {
      const pixel = pixels[p], x = pixel % W, y = Math.floor(pixel / W), i = pixel * 4, j = p * 3;
      const nz = geometry[j];
      let r = bg[0], g = bg[1], b = bg[2];
      if (nz >= 0) {
        const dx = xs[x], dy = ys[y];
        const shade = clamp01((dx * lx + dy * ly + nz * lz) / ln);
        const u = geometry[j + 1] + t * 0.02, v = dy * 4;
        const tex = noise(u * 2, v * 2) * 0.6 + noise(u * 5, v * 5) * 0.4;
        const k = clamp01(Math.pow(shade, 0.8) * (0.45 + tex * 0.6));
        r = dark[0] + (light[0] - dark[0]) * k; g = dark[1] + (light[1] - dark[1]) * k; b = dark[2] + (light[2] - dark[2]) * k;
        const edge = geometry[j + 2] * (0.5 + shade * 0.5);
        r += (rim[0] - r) * edge; g += (rim[1] - g) * edge; b += (rim[2] - b) * edge;
      } else {
        const tw = 0.55 + 0.45 * Math.sin(t * geometry[j + 1] + geometry[j + 2]);
        r += (star[0] - r) * tw; g += (star[1] - g) * tw; b += (star[2] - b) * tw;
      }
      const off = BAYER2[(y & 1) * 2 + (x & 1)] * 255 * spread;
      const rr = r + off, gg = g + off, bb = b + off;
      let best = 0, bestD = Infinity;
      for (let p = 0; p < pal.length; p++) {
        const c = pal[p], dd = (rr - c[0]) ** 2 + (gg - c[1]) ** 2 + (bb - c[2]) ** 2;
        if (dd < bestD) { bestD = dd; best = p; }
      }
      const c = pal[best];
      data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2];
    }
    ctx.putImageData(img, 0, 0);
  };

  const frame = (now: number) => {
    if (!running) return;
    if (now - last >= 1000 / 24) {
      const dt = Math.min(0.1, last ? (now - last) / 1000 : 1 / 24); last = now;
      t += dt; render();
    }
    raf = requestAnimationFrame(frame);
  };
  const start = () => { if (running || paused || reduce.matches || document.hidden) return; running = true; last = 0; raf = requestAnimationFrame(frame); };
  const stop = () => { running = false; cancelAnimationFrame(raf); };
  const sync = () => { if (paused || reduce.matches || document.hidden) stop(); else start(); };

  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  document.addEventListener('visibilitychange', sync);
  reduce.addEventListener('change', sync);
  resize(); sync();

  return {
    set(next) { Object.assign(opts, next); render(); },
    pause() { paused = true; sync(); },
    resume() { paused = false; sync(); },
    dispose() { stop(); observer.disconnect(); document.removeEventListener('visibilitychange', sync); reduce.removeEventListener('change', sync); },
  };
}
