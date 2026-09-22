const SPRITE = 32;
const SHAPES = 5;
const BLURS = [0, 1.2, 2.6];

type Particle = { x: number; y: number; r: number; v: number; depth: number; phase: number; sprite: number; spin: number; angle: number };
export type ParticleOptions = {
  color: string;
  /** 画面の何 px² に 1 粒置くか。 */
  area: number;
  /** 1 で沈み、-1 で昇る。 */
  dir: 1 | -1;
  /** 奥の粒と手前の粒の不透明度。 */
  alpha: [number, number];
};

function makeSprites(color: string): HTMLCanvasElement[] {
  const sprites: HTMLCanvasElement[] = [];
  for (const blur of BLURS) {
    for (let n = 0; n < SHAPES; n++) {
      const c = document.createElement('canvas'); c.width = c.height = SPRITE;
      const g = c.getContext('2d')!;
      g.filter = blur ? `blur(${blur}px)` : 'none';
      g.fillStyle = color;
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

export function createParticles(opts: ParticleOptions) {
  const sprites = makeSprites(opts.color);
  let W = 0, H = 0, t = 0;
  let items: Particle[] = [];
  const make = (anywhere: boolean): Particle => {
    // 奥の粒を多くし、手前の大きな粒はまれにする。
    const depth = Math.random() ** 1.8;
    const blur = depth > 0.8 ? 2 : depth > 0.55 ? 1 : 0;
    return {
      x: Math.random() * W, y: anywhere ? Math.random() * H : opts.dir > 0 ? -12 : H + 12,
      r: 0.35 + depth * depth * 1.4, v: 3 + depth * 9, depth, phase: Math.random() * 6.28,
      sprite: blur * SHAPES + ((Math.random() * SHAPES) | 0), spin: (Math.random() - 0.5) * 0.6, angle: Math.random() * 6.28,
    };
  };
  return {
    resize(w: number, h: number) {
      W = w; H = h;
      const n = Math.round((W * H) / opts.area);
      items = items.filter((p) => p.x <= W + 8 && p.y <= H + 12).slice(0, n);
      while (items.length < n) items.push(make(true));
    },
    step(dt: number) {
      t += dt;
      for (const p of items) {
        p.y += p.v * opts.dir * dt;
        p.x += Math.sin(t * 0.5 + p.phase) * 3 * dt;
        p.angle += p.spin * dt;
        if (p.y > H + 12 || p.y < -12) Object.assign(p, make(false));
      }
    },
    render(ctx: CanvasRenderingContext2D) {
      const [far, near] = opts.alpha;
      for (const p of items) {
        // ぼけた手前の粒は面積が広いぶん薄くする。
        ctx.globalAlpha = (far + p.depth * (near - far)) * (p.sprite >= SHAPES * 2 ? 0.55 : 1);
        const size = SPRITE * p.r;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.angle);
        ctx.drawImage(sprites[p.sprite], -size / 2, -size / 2, size, size);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    },
  };
}
