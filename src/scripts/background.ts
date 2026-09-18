// アドレスバーの伸縮で背景を再初期化しないよう、window ではなく 100lvh の canvas 自体を測る。
import { isDark, onThemeChange } from './theme';

export type Scene = {
  resize(w: number, h: number): void;
  /** dt は秒。 */
  step(dt: number): void;
  render(): void;
};
export type BackgroundControl = { dispose(): void };

export function runBackground(canvas: HTMLCanvasElement, opts: { theme: 'light' | 'dark'; fps: number; dpr?: number; staticWhenReduced?: boolean }, make: (ctx: CanvasRenderingContext2D) => Scene): BackgroundControl {
  const ctx = canvas.getContext('2d', { alpha: true })!;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const dpr = opts.dpr ?? 1;
  const scene = make(ctx);
  const active = () => (opts.theme === 'dark') === isDark();

  let W = 0, H = 0, raf = 0, running = false, last = 0;
  const resize = () => {
    const w = Math.round(canvas.clientWidth), h = Math.round(canvas.clientHeight);
    if (!w || !h || (w === W && h === H)) return;
    W = w; H = h;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    scene.resize(W, H);
    if (running) scene.render();
    sync();
  };
  const frame = (now: number) => {
    if (!running) return;
    if (now - last >= 1000 / opts.fps) {
      const dt = Math.min(0.1, last ? (now - last) / 1000 : 1 / opts.fps); last = now;
      scene.step(dt); scene.render();
    }
    raf = requestAnimationFrame(frame);
  };
  const start = () => { if (running || reduce.matches || !active() || document.hidden) return; running = true; last = 0; raf = requestAnimationFrame(frame); };
  const stop = () => { running = false; cancelAnimationFrame(raf); ctx.clearRect(0, 0, W, H); };
  const sync = () => {
    if (reduce.matches || !active() || document.hidden) {
      stop();
      if (reduce.matches && opts.staticWhenReduced && active()) { scene.step(0); scene.render(); }
    } else {
      start();
    }
  };
  const offTheme = onThemeChange(sync);
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  document.addEventListener('visibilitychange', sync);
  reduce.addEventListener('change', sync);
  resize();
  return { dispose() { stop(); offTheme(); observer.disconnect(); document.removeEventListener('visibilitychange', sync); reduce.removeEventListener('change', sync); } };
}
