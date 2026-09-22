import { runBackground, type BackgroundControl } from './background';

const CELL = 4; // CSS px / セル
const DAMP = 0.966;
const FPS = 30;
const LIGHT = [-0.7, -0.7];
// 光の網: 動く点のボロノイ境界を明るくすると、水底の光の網のような不規則な網目になる。
const NET = 72; // CSS px / 網目 1 つ
const NET_DEPTH = 0.9; // 画面上端からこの割合までに網を描く

export function startSurface(canvas: HTMLCanvasElement): BackgroundControl {
  return runBackground(canvas, { theme: 'light', fps: FPS }, (ctx) => {
    let W = 0, H = 0, cw = 0, ch = 0;
    let cur = new Float32Array(0), prev = new Float32Array(0);
    let warpX = new Float64Array(0), warpY = new Float64Array(0);
    let gw = 0, gh = 0;
    let seedX = new Float64Array(0), seedY = new Float64Array(0), seedPhase = new Float64Array(0), seedSpeed = new Float64Array(0);
    let px = new Float64Array(0), py = new Float64Array(0);
    // 網はぼけた太い線なので、2 セルおきに計算して補間する。
    let netBuf = new Float32Array(0), nw = 0;
    let img: ImageData, off: HTMLCanvasElement, offCtx: CanvasRenderingContext2D;
    let soft: HTMLCanvasElement, softCtx: CanvasRenderingContext2D;
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
        warpX = new Float64Array(ch); warpY = new Float64Array(cw);
        // 網目の座標は 2 つずらし、揺らぎで端を越えても隣の点を配列の内側で参照できるようにする。
        gw = Math.ceil(W / NET) + 4; gh = Math.ceil((H * NET_DEPTH) / NET) + 4;
        seedX = new Float64Array(gw * gh); seedY = new Float64Array(gw * gh);
        seedPhase = new Float64Array(gw * gh); seedSpeed = new Float64Array(gw * gh);
        px = new Float64Array(gw * gh); py = new Float64Array(gw * gh);
        nw = (cw >> 1) + 1; netBuf = new Float32Array(nw * ((ch >> 1) + 1));
        for (let k = 0; k < gw * gh; k++) {
          seedX[k] = 0.2 + Math.random() * 0.6; seedY[k] = 0.2 + Math.random() * 0.6;
          seedPhase[k] = Math.random() * 6.2832; seedSpeed[k] = 0.6 + Math.random() * 0.8;
        }
        off = document.createElement('canvas'); off.width = cw; off.height = ch;
        offCtx = off.getContext('2d')!; img = offCtx.createImageData(cw, ch);
        // ぼかしは縮小したまま掛け、全画面での filter を避ける。
        soft = document.createElement('canvas'); soft.width = cw; soft.height = ch;
        softCtx = soft.getContext('2d')!; softCtx.filter = 'blur(0.4px)';
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
        const unit = CELL / NET;
        for (let k = 0; k < gw * gh; k++) {
          const a = tt * seedSpeed[k] + seedPhase[k];
          px[k] = (k % gw) + seedX[k] + 0.3 * Math.sin(a);
          py[k] = ((k / gw) | 0) + seedY[k] + 0.3 * Math.cos(a * 0.8);
        }
        // 境界を曲げて多角形らしさを消す。
        for (let y = 0; y < ch; y++) { const v = y * unit; warpX[y] = 0.22 * Math.sin(v * 1.7 + tt * 0.9) + 0.1 * Math.sin(v * 4.1 - tt * 1.3); }
        for (let x = 0; x < cw; x++) { const v = x * unit; warpY[x] = 0.22 * Math.sin(v * 1.3 - tt * 0.8) + 0.1 * Math.sin(v * 3.7 + tt * 1.1); }
        const netRows = ch * NET_DEPTH;
        for (let y = 0; y < ch; y += 2) {
          const u = y / netRows;
          if (u >= 1) break;
          const fade = 1 - u * u * (3 - 2 * u);
          const nrow = (y >> 1) * nw;
          for (let x = 0; x < cw; x += 2) {
            const fx = 2 + x * unit + warpX[y], fy = 2 + y * unit + warpY[x];
            const ix = Math.floor(fx), iy = Math.floor(fy);
            let f1 = 9, f2 = 9;
            for (let j = 0; j < 3; j++) {
              const k0 = (iy - 1 + j) * gw + ix - 1;
              for (let n = 0; n < 3; n++) {
                const k = k0 + n, dx = px[k] - fx, dy = py[k] - fy, dd = dx * dx + dy * dy;
                if (dd < f1) { f2 = f1; f1 = dd; } else if (dd < f2) f2 = dd;
              }
            }
            // 線の太さと明るさを場所ごとに揺らし、均一なタイル模様に見えないようにする。
            const vary = 0.5 + 0.5 * Math.sin(fx * 0.9 + warpY[x] * 3 + tt * 0.6) * Math.sin(fy * 1.1 - tt * 0.5);
            const c = Math.max(0, 1 - (Math.sqrt(f2) - Math.sqrt(f1)) / (0.12 + 0.12 * vary));
            netBuf[nrow + (x >> 1)] = c * c * c * (0.35 + 0.65 * vary) * fade * 0.42;
          }
        }
        for (let y = 1; y < ch - 1; y++) {
          const row = y * cw, inNet = y < netRows, nrow = (y >> 1) * nw, ty = (y & 1) * 0.5;
          for (let x = 1; x < cw - 1; x++) {
            const i = row + x, o = i * 4;
            const gx = cur[i + 1] - cur[i - 1], gy = cur[i + cw] - cur[i - cw];
            const s = (gx * LIGHT[0] + gy * LIGHT[1]) * 1.1;
            let net = 0;
            if (inNet) {
              const k = nrow + (x >> 1), tx = (x & 1) * 0.5;
              const top = netBuf[k] + (netBuf[k + 1] - netBuf[k]) * tx;
              const bottom = netBuf[k + nw] + (netBuf[k + nw + 1] - netBuf[k + nw]) * tx;
              net = top + (bottom - top) * ty;
            }
            const lit = Math.max(net, s * 0.75);
            if (lit > 0.01 && s >= -0.02) { d[o] = 255; d[o + 1] = 255; d[o + 2] = 255; d[o + 3] = Math.min(255, lit * 255); }
            else if (s < 0) { d[o] = 112; d[o + 1] = 128; d[o + 2] = 208; d[o + 3] = Math.min(255, -s * 255 * 0.5); }
            else d[o + 3] = 0;
          }
        }
        offCtx.putImageData(img, 0, 0);
        softCtx.clearRect(0, 0, cw, ch);
        softCtx.drawImage(off, 0, 0);
        ctx.clearRect(0, 0, W, H);
        ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(soft, 0, 0, W, H);
      },
    };
  });
}
