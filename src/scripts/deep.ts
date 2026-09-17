// 深海(ダークの背景)。ゆっくり沈むマリンスノーと、海底から立ち上る泡の列。光の帯は CSS(global.css の .rays)。
import { runBackground, type BackgroundControl } from './background';

type Flake = { x: number; y: number; r: number; v: number; depth: number; phase: number };
type Bubble = { x: number; y: number; r: number; v: number; wob: number; phase: number; life: number };

export function startDeep(canvas: HTMLCanvasElement): BackgroundControl {
  return runBackground(canvas, { theme: 'dark', fps: 30, dpr: Math.min(devicePixelRatio || 1, 1.5), staticWhenReduced: true }, (ctx) => {
    let W = 0, H = 0, t = 0;
    let flakes: Flake[] = [];
    const bubbles: Bubble[] = [];
    let vent = { x: 0.5, until: 0, next: 3 }; // 泡の噴出口: 場所と、出し続ける時刻、次に場所を変える時刻

    const makeFlake = (anywhere: boolean): Flake => {
      const depth = Math.random();
      return { x: Math.random() * W, y: anywhere ? Math.random() * H : -6, r: 0.6 + depth * 1.6, v: 4 + depth * 10, depth, phase: Math.random() * 6.28 };
    };

    return {
      resize(w, h) {
        W = w; H = h;
        flakes = Array.from({ length: Math.round((W * H) / 14000) }, () => makeFlake(true)); // 1280×800 で 70 粒ほど
      },
      step(dt) {
        t += dt;
        for (const f of flakes) {
          f.y += f.v * dt;                              // 沈む
          f.x += Math.sin(t * 0.5 + f.phase) * 3 * dt;  // わずかに揺れる
          if (f.y > H + 8) Object.assign(f, makeFlake(false));
        }
        if (t > vent.next) vent = { x: 0.15 + Math.random() * 0.7, until: t + 2 + Math.random() * 3, next: t + 9 + Math.random() * 12 };
        if (t < vent.until && Math.random() < dt * 6) {
          const r = 2 + Math.random() * Math.random() * 7; // 小さい泡が多く、大きい泡は稀
          bubbles.push({ x: vent.x * W + (Math.random() - 0.5) * 14, y: H + r, r, v: 28 + r * 6, wob: 6 + Math.random() * 8, phase: Math.random() * 6.28, life: 1 });
        }
        for (let i = bubbles.length - 1; i >= 0; i--) {
          const b = bubbles[i];
          b.y -= b.v * dt;                                   // 大きい泡ほど速い
          b.x += Math.sin(t * 2.2 + b.phase) * b.wob * dt;   // 揺れながら
          b.life = Math.min(1, (b.y - H * 0.08) / (H * 0.25)); // 上で薄れる
          if (b.y < -b.r || b.life <= 0) bubbles.splice(i, 1);
        }
      },
      render() {
        ctx.clearRect(0, 0, W, H);
        // マリンスノー: 奥は小さく薄く、手前は明るく淡い光暈つき
        for (const f of flakes) {
          const a = 0.12 + f.depth * 0.45;
          ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 6.2832); ctx.fillStyle = `rgba(220,230,255,${a})`; ctx.fill();
          if (f.depth > 0.6) { ctx.beginPath(); ctx.arc(f.x, f.y, f.r * 2.4, 0, 6.2832); ctx.fillStyle = `rgba(220,230,255,${a * 0.18})`; ctx.fill(); }
        }
        // 泡: 輪郭と、光を受ける側のハイライト、反対側のわずかな縁
        for (const b of bubbles) {
          const a = 0.55 * b.life;
          ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 6.2832);
          ctx.strokeStyle = `rgba(200,220,255,${a * 0.7})`; ctx.lineWidth = Math.max(0.6, b.r * 0.12); ctx.stroke();
          ctx.beginPath(); ctx.arc(b.x - b.r * 0.35, b.y - b.r * 0.35, Math.max(0.6, b.r * 0.22), 0, 6.2832);
          ctx.fillStyle = `rgba(255,255,255,${a})`; ctx.fill();
          ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.85, 0.3, 1.9);
          ctx.strokeStyle = `rgba(255,255,255,${a * 0.25})`; ctx.lineWidth = Math.max(0.5, b.r * 0.1); ctx.stroke();
        }
      },
    };
  });
}
