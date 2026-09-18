// 背景アニメーションの骨組み。テーマに応じて起動・停止し、リサイズ・タブの非表示・reduced-motion を面倒みる。
// 描画の中身(scene)だけを各ファイルが書く。
//
// 大きさは window の resize ではなく canvas 自身の大きさで決める。スマホではスクロール中にアドレスバーが縮んで
// innerHeight が変わり、そのたびに作り直すと波紋や粒が消えて一瞬止まって見えていた。背景は CSS で
// 大きいほうの画面の高さ(100lvh)に固定してあり、アドレスバーの出し入れでは canvas の大きさが変わらない。
import { isDark, onThemeChange } from './theme';

export type Scene = {
  /** canvas の寸法が決まったとき(初回と、画面の回転などで大きさが変わったとき)に呼ばれる。
      2 回目以降は今の状態をできるだけ引き継ぐこと(作り直すと動きが一瞬止まって見える) */
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

  let W = 0, H = 0, raf = 0, running = false, last = 0;
  const resize = () => {
    const w = Math.round(canvas.clientWidth), h = Math.round(canvas.clientHeight);
    if (!w || !h || (w === W && h === H)) return;
    W = w; H = h;
    canvas.width = W * dpr; canvas.height = H * dpr; // ここで中身が消えるので、動いていればすぐ描き直す
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
  const onVis = sync;
  const offTheme = onThemeChange(sync);
  // ResizeObserver は描画の直前に 1 フレーム 1 回だけ呼ばれるので、待たずに合わせる(待つと引き伸ばされた絵が見える)
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  document.addEventListener('visibilitychange', onVis);
  reduce.addEventListener('change', sync);
  resize();
  return { dispose() { stop(); offTheme(); observer.disconnect(); document.removeEventListener('visibilitychange', onVis); reduce.removeEventListener('change', sync); } };
}
