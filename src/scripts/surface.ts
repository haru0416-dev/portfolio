// 水面(ライトの背景)。低解像度の高さ場で 2D 波動方程式を解き、雨粒の波紋を物理として広げる。
// 描画は高さの勾配から「左上から光が当たった水面」の明暗を作り、拡大時の補間で滑らかに見せる。

const CELL = 4;          // 1 セルが画面の何 px か(小さいほど精細で重い)
const DAMP = 0.978;      // 減衰(1 に近いほど長く残る)。短命にして小さな環で消す
const FPS = 30;          // 更新頻度。背景なので 30 で十分
const LIGHT = [-0.7, -0.7]; // 光の向き(左上)

export type SurfaceControl = { dispose(): void };

export function startSurface(canvas: HTMLCanvasElement): SurfaceControl {
  const ctx = canvas.getContext('2d', { alpha: true })!;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mq = matchMedia('(prefers-color-scheme: dark)');

  let W = 0, H = 0, cw = 0, ch = 0;
  let cur = new Float32Array(0), prev = new Float32Array(0);
  let img: ImageData | null = null;
  let off: HTMLCanvasElement | null = null, offCtx: CanvasRenderingContext2D | null = null;
  let raf = 0, timer = 0, running = false, last = 0, nextDrop = 0;

  const isLight = () => getComputedStyle(document.documentElement).colorScheme !== 'dark';

  const resize = () => {
    W = innerWidth; H = innerHeight;
    canvas.width = W; canvas.height = H;
    cw = Math.ceil(W / CELL); ch = Math.ceil(H / CELL);
    cur = new Float32Array(cw * ch); prev = new Float32Array(cw * ch);
    off = document.createElement('canvas'); off.width = cw; off.height = ch;
    offCtx = off.getContext('2d')!;
    img = offCtx.createImageData(cw, ch);
  };

  /** 雨粒。一気に押し込むと濃い点が出るので、数フレームに分けてなだらかに。
      形は中心がくぼみ、縁がわずかに盛り上がる(着水のクレーター) */
  type Drop = { x: number; y: number; r: number; amp: number; left: number; total: number };
  const drops: Drop[] = [];
  const drop = (x: number, y: number, r: number, amp: number, frames = 4) => { drops.push({ x, y, r, amp, left: frames, total: frames }); };
  const applyDrops = () => {
    for (let k = drops.length - 1; k >= 0; k--) {
      const p = drops[k]; const a = p.amp / p.total;
      for (let j = -p.r; j <= p.r; j++) for (let i = -p.r; i <= p.r; i++) {
        const d = Math.hypot(i, j) / p.r; if (d > 1) continue;
        const xx = p.x + i, yy = p.y + j; if (xx < 1 || yy < 1 || xx >= cw - 1 || yy >= ch - 1) continue;
        // 中心 -1、d=0.7 付近で +0.35 の縁、外で 0 に戻る
        const profile = -Math.exp(-d * d * 4) + 0.5 * Math.exp(-((d - 0.72) * (d - 0.72)) * 14) * (1 - d);
        cur[yy * cw + xx] += a * profile;
      }
      if (--p.left <= 0) drops.splice(k, 1);
    }
  };

  const step = () => {
    // 2D 波動方程式の差分: 新 = 隣 4 つの平均 × 2 − 前 、に減衰
    for (let y = 1; y < ch - 1; y++) {
      const row = y * cw;
      for (let x = 1; x < cw - 1; x++) {
        const i = row + x;
        prev[i] = ((cur[i - 1] + cur[i + 1] + cur[i - cw] + cur[i + cw]) * 0.5 - prev[i]) * DAMP;
      }
    }
    const t = prev; prev = cur; cur = t;
  };

  const render = () => {
    if (!img || !offCtx || !off) return;
    const d = img.data;
    // 水の色(青)と光(白)。勾配の向きで明暗を分ける
    for (let y = 1; y < ch - 1; y++) {
      for (let x = 1; x < cw - 1; x++) {
        const i = y * cw + x;
        const gx = cur[i + 1] - cur[i - 1], gy = cur[i + cw] - cur[i - cw];
        const s = (gx * LIGHT[0] + gy * LIGHT[1]) * 1.3; // 光に向く斜面は明るく、背く斜面は暗く
        const o = i * 4;
        if (s > 0) { d[o] = 255; d[o + 1] = 255; d[o + 2] = 255; d[o + 3] = Math.min(255, s * 255 * 0.75); }
        else       { d[o] = 112; d[o + 1] = 128; d[o + 2] = 208; d[o + 3] = Math.min(255, -s * 255 * 0.5); } // 配色の薄紫に寄せた青
      }
    }
    offCtx.putImageData(img, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.filter = 'blur(1.5px)'; // 差分法の格子状のざらつきを消す
    ctx.drawImage(off, 0, 0, W, H);
    ctx.filter = 'none';
  };

  const frame = (now: number) => {
    if (!running) return;
    if (now - last >= 1000 / FPS) {
      last = now;
      if (now >= nextDrop) {
        // ときどき雨粒。大きいものは稀に
        const big = Math.random() < 0.18;
        drop(2 + (Math.random() * (cw - 4)) | 0, 2 + (Math.random() * (ch - 4)) | 0, big ? 5 : 4, big ? 5 : 3, big ? 6 : 4);
        nextDrop = now + 2200 + Math.random() * 3300;
      }
      applyDrops(); step(); render();
    }
    raf = requestAnimationFrame(frame);
  };

  const start = () => { if (running || reduce || !isLight() || document.hidden) return; running = true; last = 0; nextDrop = performance.now() + 400; raf = requestAnimationFrame(frame); };
  const stop = () => { running = false; cancelAnimationFrame(raf); ctx.clearRect(0, 0, W, H); };
  const sync = () => { isLight() ? start() : stop(); };

  const onResize = () => { clearTimeout(timer); timer = window.setTimeout(resize, 150); };
  const onVis = () => { document.hidden ? stop() : sync(); };
  const mo = new MutationObserver(sync);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  mq.addEventListener('change', sync);
  addEventListener('resize', onResize);
  document.addEventListener('visibilitychange', onVis);
  resize();
  // 最初に数滴落としておく
  drop(2 + (Math.random() * (cw - 4)) | 0, 2 + (Math.random() * (ch - 4)) | 0, 4, 3, 4);
  sync();

  return { dispose() { stop(); mo.disconnect(); mq.removeEventListener('change', sync); removeEventListener('resize', onResize); document.removeEventListener('visibilitychange', onVis); } };
}
