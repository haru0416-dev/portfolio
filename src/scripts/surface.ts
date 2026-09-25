import { runBackground, type BackgroundControl } from './background';
import { createCaustic } from './caustic-gl';
import { createParticles } from './particles';

const FPS = 30;

/**
 * ライトテーマの浅い海。水底に映る光の網は隣の canvas.caustic に WebGL で描き、漂う粒はこの Canvas に描く。
 * 網は名刺の裏と同じ見え方にしてある(caustic-gl.ts)。
 */
export function startSurface(canvas: HTMLCanvasElement): BackgroundControl {
  const glCanvas = canvas.parentElement?.querySelector<HTMLCanvasElement>('canvas.caustic') ?? null;
  return runBackground(canvas, { theme: 'light', fps: FPS }, (ctx) => {
    const caustic = glCanvas && createCaustic(glCanvas);
    const motes = createParticles({ color: 'rgb(72,64,112)', area: 20000, dir: -1, alpha: [0.1, 0.32] });
    let now = 0;
    return {
      resize(w, h) { caustic?.resize(w, h); motes.resize(w, h); },
      step(dt) { now += dt; motes.step(dt); },
      render() {
        caustic?.render(now, scrollY);
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        motes.render(ctx);
      },
      stop() { caustic?.clear(); },
      dispose() { caustic?.dispose(); },
    };
  });
}
