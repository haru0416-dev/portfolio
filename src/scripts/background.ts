// アドレスバーの伸縮で背景を再初期化しないよう、window ではなく 100lvh の canvas 自体を測る。
import { isDark, onThemeChange } from './theme';

export type Scene = {
  resize(w: number, h: number): void;
  /** dt は秒。 */
  step(dt: number): void;
  render(): void;
  /** 動き始めたとき(表示するテーマになったときなど)。 */
  start?(): void;
  /** 止めたときに、2D の Canvas 以外に描いたものを消す。 */
  stop?(): void;
  dispose?(): void;
};
export type BackgroundControl = { dispose(): void };

export function runBackground(canvas: HTMLCanvasElement, opts: { theme: 'light' | 'dark'; fps: number; dpr?: number; staticWhenReduced?: boolean }, make: (ctx: CanvasRenderingContext2D) => Scene): BackgroundControl {
  let ctx: CanvasRenderingContext2D | undefined;
  let scene: Scene | undefined;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const dpr = opts.dpr ?? 1;
  const active = () => (opts.theme === 'dark') === isDark();

  let W = 0, H = 0, raf = 0, running = false, last = 0, disposed = false;
  const resize = () => {
    const w = Math.round(canvas.clientWidth), h = Math.round(canvas.clientHeight);
    if (!w || !h || (w === W && h === H)) return false;
    W = w; H = h;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    scene!.resize(W, H);
    return true;
  };
  const frame = (now: number) => {
    if (!running) return;
    if (now - last >= 1000 / opts.fps) {
      const dt = Math.min(0.1, last ? (now - last) / 1000 : 1 / opts.fps); last = now;
      scene!.step(dt); scene!.render();
    }
    raf = requestAnimationFrame(frame);
  };
  const start = () => { if (running || reduce.matches || !active() || document.hidden) return; running = true; last = 0; scene?.start?.(); raf = requestAnimationFrame(frame); };
  const stop = () => { running = false; cancelAnimationFrame(raf); ctx?.clearRect(0, 0, W, H); scene?.stop?.(); };
  const sync = () => {
    if (disposed) return;
    if (!active() || document.hidden || (reduce.matches && !opts.staticWhenReduced)) {
      stop();
      return;
    }
    // 非表示テーマや動きを減らす設定では、オフスクリーン画像も 2D context も作らない。
    if (!scene) {
      ctx = canvas.getContext('2d', { alpha: true })!;
      scene = make(ctx);
    }
    // 表示するテーマだけバッファを確保する。切り替え時に最新の寸法を反映する。
    const resized = resize();
    if (!W || !H) return;
    if (reduce.matches) {
      stop();
      scene.step(0); scene.render();
    } else {
      if (resized && running) scene.render();
      start();
    }
  };
  const offTheme = onThemeChange(sync);
  const observer = new ResizeObserver(sync);
  observer.observe(canvas);
  document.addEventListener('visibilitychange', sync);
  reduce.addEventListener('change', sync);
  sync();
  return { dispose() { disposed = true; stop(); scene?.dispose?.(); offTheme(); observer.disconnect(); document.removeEventListener('visibilitychange', sync); reduce.removeEventListener('change', sync); } };
}
