import { runBackground, type BackgroundControl } from './background';
import { createCaustic, type Caustic } from './caustic-gl';
import { createParticles } from './particles';

const FPS = 30;
/** スクロールが止まってから網の描き直しを再開するまで(ms)。 */
const SCROLL_REST = 200;
/** 網は粒の 2 コマに 1 回だけ描き直す(毎秒 15 コマ)。ゆっくりとしか動かないので見た目は変わらず、GPU の仕事が半分になる。 */
const NET_EVERY = 2;

/** ライトテーマの浅い海。光の網は隣の canvas.caustic に WebGL で、漂う粒はこの Canvas に描く。 */
export function startSurface(canvas: HTMLCanvasElement): BackgroundControl {
  const glCanvas = canvas.parentElement?.querySelector<HTMLCanvasElement>('canvas.caustic') ?? null;
  return runBackground(canvas, { theme: 'light', fps: FPS }, (ctx) => {
    const motes = createParticles({ color: 'rgb(72,64,112)', area: 20000, dir: -1, alpha: [0.1, 0.32] });
    let netTime = 0, W = 0, H = 0;
    // スクロール中は網を描き直さず、GPU をスクロールの描画に空ける。網はゆっくりしか動かないので止めても目立たない。
    // スクロールが起きてからでは、たまっていた網の描画を待つ出始めのコマが重くなるので、ホイール・タッチ・キーの時点で止める。
    // 網の時計も止め、再開したときに止めていた分だけ網が跳ばないようにする。
    let scrolledAt = -Infinity, frame = 0;
    const onScroll = () => { scrolledAt = performance.now(); };
    const SCROLL_INTENT = ['scroll', 'wheel', 'touchstart', 'keydown'] as const;
    for (const type of SCROLL_INTENT) addEventListener(type, onScroll, { passive: true });
    // WebGL とシェーダーの準備は重いので、手が空いてから始める。それまでは粒だけを描く。
    let caustic: Caustic | null = null, disposed = false;
    const idle = (fn: () => void) => ('requestIdleCallback' in globalThis ? requestIdleCallback(fn, { timeout: 1500 }) : setTimeout(fn, 300));
    if (glCanvas) idle(() => {
      if (disposed) return;
      caustic = createCaustic(glCanvas);
      // 一度作って捨てた WebGL の Canvas は、テーマ切り替えの遷移のあとに白く塗られることがあるので隠す。
      if (!caustic) glCanvas.hidden = true;
      else if (W && H) caustic.resize(W, H);
    });
    return {
      // 大きさを変えると網の Canvas は空になる。スクロール中で描き直しを止めていても、ここではすぐ描く。
      resize(w, h) { W = w; H = h; caustic?.resize(w, h); caustic?.render(netTime); motes.resize(w, h); },
      step(dt) {
        if (performance.now() - scrolledAt > SCROLL_REST) netTime += dt;
        motes.step(dt);
      },
      render() {
        if (++frame % NET_EVERY === 0 && performance.now() - scrolledAt > SCROLL_REST) caustic?.render(netTime);
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        motes.render(ctx);
      },
      stop() { caustic?.clear(); },
      dispose() { disposed = true; caustic?.dispose(); for (const type of SCROLL_INTENT) removeEventListener(type, onScroll); },
    };
  });
}
