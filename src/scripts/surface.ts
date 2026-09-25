import { runBackground, type BackgroundControl } from './background';
import { createCaustic, type Caustic } from './caustic-gl';
import { createParticles } from './particles';

const FPS = 30;

/**
 * ライトテーマの浅い海。水底に映る光の網は隣の canvas.caustic に WebGL で描き、漂う粒はこの Canvas に描く。
 * 網は名刺の裏と同じ見え方にしてある(caustic-gl.ts)。
 */
export function startSurface(canvas: HTMLCanvasElement): BackgroundControl {
  const glCanvas = canvas.parentElement?.querySelector<HTMLCanvasElement>('canvas.caustic') ?? null;
  return runBackground(canvas, { theme: 'light', fps: FPS }, (ctx) => {
    const motes = createParticles({ color: 'rgb(72,64,112)', area: 20000, dir: -1, alpha: [0.1, 0.32] });
    let now = 0, W = 0, H = 0;
    // 網の準備(WebGL とシェーダー)は重いので、ページを表示し終えて手が空いてから始める。それまでは粒だけを描く。
    let caustic: Caustic | null = null, disposed = false;
    const idle = (fn: () => void) => ('requestIdleCallback' in globalThis ? requestIdleCallback(fn, { timeout: 1500 }) : setTimeout(fn, 300));
    if (glCanvas) idle(() => {
      if (disposed) return;
      caustic = createCaustic(glCanvas);
      // 網を描かない環境では Canvas ごと隠す。一度作って捨てた WebGL の Canvas は、テーマ切り替えの遷移のあとに白く塗られることがある。
      if (!caustic) glCanvas.hidden = true;
      else if (W && H) caustic.resize(W, H);
    });
    return {
      resize(w, h) { W = w; H = h; caustic?.resize(w, h); motes.resize(w, h); },
      step(dt) { now += dt; motes.step(dt); },
      render() {
        caustic?.render(now, scrollY);
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        motes.render(ctx);
      },
      stop() { caustic?.clear(); },
      dispose() { disposed = true; caustic?.dispose(); },
    };
  });
}
