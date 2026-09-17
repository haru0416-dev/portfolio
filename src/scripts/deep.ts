// 深海(ダークの背景)。ゆっくり沈むマリンスノーと、海底から立ち上る泡の列。光の帯は CSS(global.css の .rays)。
// Canvas 2D、30fps、ダークのときだけ動く。

const FPS = 30;
import { isDark, onThemeChange } from './theme';

type Flake = { x: number; y: number; r: number; v: number; depth: number; phase: number };
type Bubble = { x: number; y: number; r: number; v: number; wob: number; phase: number; life: number };
type Vent = { x: number; until: number; next: number };

export type DeepControl = { dispose(): void };

export function startDeep(canvas: HTMLCanvasElement): DeepControl {
  const ctx = canvas.getContext('2d', { alpha: true })!;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dpr = Math.min(devicePixelRatio || 1, 1.5);

  let W = 0, H = 0, raf = 0, timer = 0, running = false, last = 0, t = 0;
  let flakes: Flake[] = [], bubbles: Bubble[] = [];
  let vent: Vent = { x: 0.5, until: 0, next: 3 };


  const resize = () => {
    W = innerWidth; H = innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.round((W * H) / 14000); // 1280×800 で 70 粒ほど
    flakes = Array.from({ length: n }, () => makeFlake(true));
  };
  const makeFlake = (anywhere: boolean): Flake => {
    const depth = Math.random();
    return { x: Math.random() * W, y: anywhere ? Math.random() * H : -6, r: 0.6 + depth * 1.6, v: 4 + depth * 10, depth, phase: Math.random() * 6.28 };
  };

  const step = (dt: number) => {
    t += dt;
    for (const f of flakes) {
      f.y += f.v * dt;                                    // 沈む
      f.x += Math.sin(t * 0.5 + f.phase) * 3 * dt;        // わずかに揺れる
      if (f.y > H + 8) Object.assign(f, makeFlake(false));
    }
    // 泡の噴出: ときどき場所を変えて、数秒間まとめて出す
    if (t > vent.next) { vent = { x: 0.15 + Math.random() * 0.7, until: t + 2 + Math.random() * 3, next: t + 9 + Math.random() * 12 }; }
    if (t < vent.until && Math.random() < dt * 6) {
      const r = 2 + Math.random() * Math.random() * 7;   // 小さい泡が多く、大きい泡は稀
      bubbles.push({ x: vent.x * W + (Math.random() - 0.5) * 14, y: H + r, r, v: 28 + r * 6, wob: 6 + Math.random() * 8, phase: Math.random() * 6.28, life: 1 });
    }
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i];
      b.y -= b.v * dt;                                     // 大きい泡ほど速い
      b.x += Math.sin(t * 2.2 + b.phase) * b.wob * dt;     // 揺れながら
      b.life = Math.min(1, (b.y - H * 0.08) / (H * 0.25)); // 上で薄れる
      if (b.y < -b.r || b.life <= 0) bubbles.splice(i, 1);
    }
  };

  const render = () => {
    ctx.clearRect(0, 0, W, H);
    // マリンスノー: 奥は小さくぼけて薄く、手前は明るく
    for (const f of flakes) {
      const a = 0.12 + f.depth * 0.45;
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 6.2832);
      ctx.fillStyle = `rgba(220,230,255,${a})`; ctx.fill();
      if (f.depth > 0.6) { ctx.beginPath(); ctx.arc(f.x, f.y, f.r * 2.4, 0, 6.2832); ctx.fillStyle = `rgba(220,230,255,${a * 0.18})`; ctx.fill(); }
    }
    // 泡: 輪郭と、光を受ける側の小さなハイライト、反対側のわずかな影
    for (const b of bubbles) {
      const a = 0.55 * b.life;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 6.2832);
      ctx.strokeStyle = `rgba(200,220,255,${a * 0.7})`; ctx.lineWidth = Math.max(0.6, b.r * 0.12); ctx.stroke();
      ctx.beginPath(); ctx.arc(b.x - b.r * 0.35, b.y - b.r * 0.35, Math.max(0.6, b.r * 0.22), 0, 6.2832);
      ctx.fillStyle = `rgba(255,255,255,${a})`; ctx.fill();
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.85, 0.3, 1.9);
      ctx.strokeStyle = `rgba(255,255,255,${a * 0.25})`; ctx.lineWidth = Math.max(0.5, b.r * 0.1); ctx.stroke();
    }
  };

  const frame = (now: number) => {
    if (!running) return;
    if (now - last >= 1000 / FPS) {
      const dt = Math.min(0.1, last ? (now - last) / 1000 : 1 / FPS); last = now;
      step(dt); render();
    }
    raf = requestAnimationFrame(frame);
  };
  const start = () => { if (running || reduce || !isDark() || document.hidden) return; running = true; last = 0; raf = requestAnimationFrame(frame); };
  const stop = () => { running = false; cancelAnimationFrame(raf); ctx.clearRect(0, 0, W, H); };
  const sync = () => { isDark() ? start() : stop(); };
  const onResize = () => { clearTimeout(timer); timer = window.setTimeout(resize, 150); };
  const onVis = () => { document.hidden ? stop() : sync(); };
  const offTheme = onThemeChange(sync);
  addEventListener('resize', onResize);
  document.addEventListener('visibilitychange', onVis);
  resize();
  if (reduce) { step(0); render(); } // 静止画だけ
  sync();
  return { dispose() { stop(); offTheme(); removeEventListener('resize', onResize); document.removeEventListener('visibilitychange', onVis); } };
}
