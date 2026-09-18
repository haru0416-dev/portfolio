import { runBackground, type BackgroundControl } from './background';

const CELL = 4; // CSS px / セル
const DAMP = 0.966;
const FPS = 30;
const LIGHT = [-0.7, -0.7];

export function startSurface(canvas: HTMLCanvasElement): BackgroundControl {
  return runBackground(canvas, { theme: 'light', fps: FPS }, (ctx) => {
    let W = 0, H = 0, cw = 0, ch = 0;
    let cur = new Float32Array(0), prev = new Float32Array(0);
    let xPhase = new Float64Array(0), xRipple = new Float64Array(0);
    let img: ImageData, off: HTMLCanvasElement, offCtx: CanvasRenderingContext2D;
    let nextDrop = 0, now = 0;

    type Drop = { x: number; y: number; r: number; amp: number; left: number; total: number };
    const drops: Drop[] = [];
    const drop = (r: number, amp: number, frames: number) => {
      drops.push({ x: 2 + (Math.random() * (cw - 4)) | 0, y: 2 + (Math.random() * (ch - 4)) | 0, r, amp, left: frames, total: frames });
    };
    const applyDrops = () => {
      for (let k = drops.length - 1; k >= 0; k--) {
        const p = drops[k]; const a = p.amp / p.total;
        for (let j = -p.r; j <= p.r; j++) for (let i = -p.r; i <= p.r; i++) {
          const d = Math.hypot(i, j) / p.r; if (d > 1) continue;
          const xx = p.x + i, yy = p.y + j; if (xx < 1 || yy < 1 || xx >= cw - 1 || yy >= ch - 1) continue;
          const profile = -Math.exp(-d * d * 4) + 0.5 * Math.exp(-((d - 0.72) * (d - 0.72)) * 14) * (1 - d);
          cur[yy * cw + xx] += a * profile;
        }
        if (--p.left <= 0) drops.splice(k, 1);
      }
    };

    return {
      resize(w, h) {
        const first = cw === 0, ocw = cw, och = ch, ocur = cur, oprev = prev;
        W = w; H = h; cw = Math.ceil(W / CELL); ch = Math.ceil(H / CELL);
        cur = new Float32Array(cw * ch); prev = new Float32Array(cw * ch);
        for (let y = 0; y < Math.min(ch, och); y++) {
          cur.set(ocur.subarray(y * ocw, y * ocw + Math.min(cw, ocw)), y * cw);
          prev.set(oprev.subarray(y * ocw, y * ocw + Math.min(cw, ocw)), y * cw);
        }
        xPhase = new Float64Array(cw); xRipple = new Float64Array(cw);
        off = document.createElement('canvas'); off.width = cw; off.height = ch;
        offCtx = off.getContext('2d')!; img = offCtx.createImageData(cw, ch);
        for (const p of drops) { p.x = Math.min(p.x, cw - 3); p.y = Math.min(p.y, ch - 3); }
        if (first) { drop(4, 3, 4); nextDrop = 0.4; }
      },
      step(dt) {
        now += dt;
        if (now >= nextDrop) {
          const big = Math.random() < 0.18;
          drop(big ? 4 : 3, big ? 3.2 : 2, big ? 6 : 4);
          nextDrop = now + 2.2 + Math.random() * 3.3;
        }
        applyDrops();
        // 2D 波動方程式の差分: 新 = 隣 4 つの平均 × 2 − 前、に減衰
        for (let y = 1; y < ch - 1; y++) {
          const row = y * cw;
          for (let x = 1; x < cw - 1; x++) {
            const i = row + x;
            prev[i] = ((cur[i - 1] + cur[i + 1] + cur[i - cw] + cur[i + cw]) * 0.5 - prev[i]) * DAMP;
          }
        }
        const t = prev; prev = cur; cur = t;
      },
      render() {
        const d = img.data, tt = now * 0.25;
        for (let x = 1; x < cw - 1; x++) {
          xPhase[x] = x * 0.21 + tt * 1.7;
          xRipple[x] = Math.sin(x * 0.11 - tt * 0.7);
        }
        for (let y = 1; y < ch - 1; y++) {
          const fade = Math.max(0, 1 - y / (ch * 0.55));
          const row = y * cw;
          const yRipple = fade > 0 ? Math.sin(y * 0.13 + tt) : 0;
          const yPhase = y * 0.17 - tt * 1.3;
          for (let x = 1; x < cw - 1; x++) {
            const i = row + x, o = i * 4;
            const gx = cur[i + 1] - cur[i - 1], gy = cur[i + cw] - cur[i - cw];
            const s = (gx * LIGHT[0] + gy * LIGHT[1]) * 1.1;
            let net = 0;
            if (fade > 0) {
              const cx = Math.sin(xPhase[x] + yRipple) + Math.sin(yPhase + xRipple[x]);
              net = Math.max(0, cx - 1.3) * fade * 0.4;
            }
            if (net > 0.02 && s <= 0.02) { d[o] = 255; d[o + 1] = 255; d[o + 2] = 255; d[o + 3] = Math.min(255, net * 255); }
            else if (s > 0) { d[o] = 255; d[o + 1] = 255; d[o + 2] = 255; d[o + 3] = Math.min(255, s * 255 * 0.75); }
            else { d[o] = 112; d[o + 1] = 128; d[o + 2] = 208; d[o + 3] = Math.min(255, -s * 255 * 0.5); }
          }
        }
        offCtx.putImageData(img, 0, 0);
        ctx.clearRect(0, 0, W, H);
        ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
        ctx.filter = 'blur(1.5px)';
        ctx.drawImage(off, 0, 0, W, H);
        ctx.filter = 'none';
      },
    };
  });
}
