// 背景アニメーションの骨組み。テーマに応じて起動・停止し、リサイズ・タブの非表示・reduced-motion を面倒みる。
// 描画の中身(scene)だけを各ファイルが書く。
import { isDark, onThemeChange } from './theme';

export type Scene = {
  /** canvas の寸法が決まったとき(初回とリサイズ後)に呼ばれる */
  resize(w: number, h: number): void;
  /** 1 コマ分。dt は秒 */
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

  let W = 0, H = 0, raf = 0, timer = 0, running = false, last = 0;
  const resize = () => {
    W = innerWidth; H = innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    scene.resize(W, H);
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
  const onResize = () => { clearTimeout(timer); timer = window.setTimeout(resize, 150); };
  const onVis = sync;
  const offTheme = onThemeChange(sync);
  addEventListener('resize', onResize);
  document.addEventListener('visibilitychange', onVis);
  reduce.addEventListener('change', sync);
  resize();
  return { dispose() { stop(); offTheme(); removeEventListener('resize', onResize); document.removeEventListener('visibilitychange', onVis); reduce.removeEventListener('change', sync); clearTimeout(timer); } };
}
