import { runBackground, type BackgroundControl } from './background';
import { createParticles } from './particles';

type Bubble = { x: number; y: number; r: number; v: number; wob: number; phase: number; life: number };

// 泡は輪郭線ではなく、縁が柔らかく光るガラス玉として描く。光は水面と同じく左上から当てる。
const BUBBLE = 64, BUBBLE_R = 30;
function makeBubble(): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = c.height = BUBBLE;
  const g = c.getContext('2d')!, m = BUBBLE / 2, R = BUBBLE_R;
  const rim = g.createRadialGradient(m, m, 0, m, m, R);
  rim.addColorStop(0, 'rgba(190,215,255,0.04)');
  rim.addColorStop(0.7, 'rgba(190,215,255,0.06)');
  rim.addColorStop(0.9, 'rgba(205,228,255,0.4)');
  rim.addColorStop(0.97, 'rgba(235,245,255,0.9)');
  rim.addColorStop(1, 'rgba(235,245,255,0)');
  g.fillStyle = rim; g.beginPath(); g.arc(m, m, R, 0, 6.2832); g.fill();
  g.lineCap = 'round';
  g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = R * 0.08;
  g.beginPath(); g.arc(m, m, R * 0.9, Math.PI * 1.05, Math.PI * 1.6); g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.28)'; g.lineWidth = R * 0.07;
  g.beginPath(); g.arc(m, m, R * 0.78, 0.25, 1.35); g.stroke();
  const hx = m - R * 0.42, hy = m - R * 0.42;
  const spec = g.createRadialGradient(hx, hy, 0, hx, hy, R * 0.22);
  spec.addColorStop(0, 'rgba(255,255,255,1)'); spec.addColorStop(1, 'rgba(255,255,255,0)');
  g.save(); g.translate(hx, hy); g.rotate(-Math.PI / 4); g.scale(1, 0.6); g.translate(-hx, -hy);
  g.fillStyle = spec; g.beginPath(); g.arc(hx, hy, R * 0.22, 0, 6.2832); g.fill(); g.restore();
  return c;
}

export function startDeep(canvas: HTMLCanvasElement): BackgroundControl {
  return runBackground(canvas, { theme: 'dark', fps: 30, dpr: Math.min(devicePixelRatio || 1, 1.5), staticWhenReduced: true }, (ctx) => {
    let W = 0, H = 0, t = 0;
    const bubbles: Bubble[] = [];
    let vent = { x: 0.5, until: 0, next: 3 };
    const bubbleSprite = makeBubble();
    const snow = createParticles({ color: 'rgb(226,232,236)', area: 14000, dir: 1, alpha: [0.2, 0.7] });

    return {
      resize(w, h) {
        W = w; H = h;
        snow.resize(w, h);
      },
      step(dt) {
        t += dt;
        snow.step(dt);
        if (t > vent.next) vent = { x: 0.15 + Math.random() * 0.7, until: t + 2 + Math.random() * 3, next: t + 9 + Math.random() * 12 };
        if (t < vent.until && Math.random() < dt * 6) {
          const r = 2 + Math.random() * Math.random() * 7;
          bubbles.push({ x: vent.x * W + (Math.random() - 0.5) * 14, y: H + r, r, v: 28 + r * 6, wob: 6 + Math.random() * 8, phase: Math.random() * 6.28, life: 1 });
        }
        for (let i = bubbles.length - 1; i >= 0; i--) {
          const b = bubbles[i];
          b.y -= b.v * dt;
          b.x += Math.sin(t * 2.2 + b.phase) * b.wob * dt;
          b.life = Math.min(1, (b.y - H * 0.08) / (H * 0.25));
          if (b.y < -b.r || b.life <= 0) bubbles.splice(i, 1);
        }
      },
      render() {
        ctx.clearRect(0, 0, W, H);
        snow.render(ctx);
        // 大きく縮めて描くため、高品質の縮小にして縁のギザつきを抑える。
        ctx.imageSmoothingQuality = 'high';
        for (const b of bubbles) {
          ctx.globalAlpha = 0.55 * b.life;
          const size = (b.r * BUBBLE) / BUBBLE_R;
          ctx.save(); ctx.translate(b.x, b.y);
          // 大きい泡は少し潰れ、上がりながら揺れる。
          if (b.r > 3.5) {
            const q = 0.03 + 0.05 * Math.sin(t * 7 + b.phase) * Math.min(1, (b.r - 3.5) / 4);
            ctx.scale(1 + q, 1 - q);
          }
          ctx.drawImage(bubbleSprite, -size / 2, -size / 2, size, size);
          ctx.restore();
        }
        ctx.globalAlpha = 1;
      },
    };
  });
}
