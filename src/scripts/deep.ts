import { runBackground, type BackgroundControl } from './background';

type Flake = { x: number; y: number; r: number; v: number; depth: number; phase: number; sprite: number; spin: number; angle: number };

// マリンスノーは丸い点ではなく、形の不揃いな綿くずにする。手前ほど大きく、ピントが外れてぼける。
const SPRITE = 32;
const SHAPES = 5;
const BLURS = [0, 1.2, 2.6];
function makeSprites(): HTMLCanvasElement[] {
  const sprites: HTMLCanvasElement[] = [];
  for (const blur of BLURS) {
    for (let n = 0; n < SHAPES; n++) {
      const c = document.createElement('canvas'); c.width = c.height = SPRITE;
      const g = c.getContext('2d')!;
      g.filter = blur ? `blur(${blur}px)` : 'none';
      g.fillStyle = 'rgb(226,232,236)';
      const lumps = 2 + ((n * 7) % 3);
      for (let k = 0; k < lumps; k++) {
        const a = (k / lumps) * 6.2832 + n;
        const d = k ? 2.2 : 0;
        g.beginPath(); g.ellipse(SPRITE / 2 + Math.cos(a) * d, SPRITE / 2 + Math.sin(a) * d, 3.2 - k * 0.5, 2.2 - k * 0.3, a, 0, 6.2832); g.fill();
      }
      sprites.push(c);
    }
  }
  return sprites;
}
type Bubble = { x: number; y: number; r: number; v: number; wob: number; phase: number; life: number };

export function startDeep(canvas: HTMLCanvasElement): BackgroundControl {
  return runBackground(canvas, { theme: 'dark', fps: 30, dpr: Math.min(devicePixelRatio || 1, 1.5), staticWhenReduced: true }, (ctx) => {
    let W = 0, H = 0, t = 0;
    let flakes: Flake[] = [];
    const bubbles: Bubble[] = [];
    let vent = { x: 0.5, until: 0, next: 3 };
    const sprites = makeSprites();

    const makeFlake = (anywhere: boolean): Flake => {
      // 奥の粒を多くし、手前の大きな粒はまれにする。
      const depth = Math.random() ** 1.8;
      const blur = depth > 0.8 ? 2 : depth > 0.55 ? 1 : 0;
      return {
        x: Math.random() * W, y: anywhere ? Math.random() * H : -12,
        r: 0.35 + depth * depth * 1.4, v: 3 + depth * 9, depth, phase: Math.random() * 6.28,
        sprite: blur * SHAPES + ((Math.random() * SHAPES) | 0), spin: (Math.random() - 0.5) * 0.6, angle: Math.random() * 6.28,
      };
    };

    return {
      resize(w, h) {
        W = w; H = h;
        const n = Math.round((W * H) / 14000);
        flakes = flakes.filter((f) => f.x <= W + 8 && f.y <= H + 8).slice(0, n);
        while (flakes.length < n) flakes.push(makeFlake(true));
      },
      step(dt) {
        t += dt;
        for (const f of flakes) {
          f.y += f.v * dt;
          f.x += Math.sin(t * 0.5 + f.phase) * 3 * dt;
          f.angle += f.spin * dt;
          if (f.y > H + 12) Object.assign(f, makeFlake(false));
        }
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
        for (const f of flakes) {
          // ぼけた手前の粒は面積が広いぶん薄くする。
          ctx.globalAlpha = (0.2 + f.depth * 0.5) * (f.sprite >= SHAPES * 2 ? 0.55 : 1);
          const size = SPRITE * f.r;
          ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.angle);
          ctx.drawImage(sprites[f.sprite], -size / 2, -size / 2, size, size);
          ctx.restore();
        }
        ctx.globalAlpha = 1;
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
