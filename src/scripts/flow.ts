// ノイズのベクトル場に粒子を流す描画。Lab の作品とトップの紋章で共用する。
export type FlowOptions = {
  particles?: number;
  scale?: number;
  step?: number;
  /** この回数描いたら止める(0 なら止めない) */
  frames?: number;
  alpha?: number;
  circle?: boolean;
  /** 1 フレームに描く回数(大きいほど早く描き上がる) */
  speed?: number;
};

export function startFlow(canvas: HTMLCanvasElement, opts: FlowOptions = {}) {
  const ctx = canvas.getContext('2d')!;
  const { particles = 1400, scale = 0.004, step = 1.6, frames = 0, alpha = 0.35, circle = false, speed = 1 } = opts;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name);

  let seed = Math.random() * 1e9;
  const hash = (x: number, y: number) => {
    let h = (x * 374761393 + y * 668265263 + seed) | 0;
    h = ((h ^ (h >>> 13)) * 1274126177) | 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const smooth = (t: number) => t * t * (3 - 2 * t);
  const noise = (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = smooth(x - xi), yf = smooth(y - yi);
    const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  };

  type P = { x: number; y: number; life: number };
  let W = 0, H = 0, ps: P[] = [], drawn = 0, raf = 0, visible = true;

  const spawn = (): P => ({ x: Math.random() * W, y: Math.random() * H, life: 60 + Math.random() * 200 });

  const clear = () => {
    ctx.fillStyle = css('--paper');
    ctx.fillRect(0, 0, W, H);
  };
  const reset = () => {
    ps = Array.from({ length: particles }, spawn);
    drawn = 0;
    clear();
    if (circle) {
      ctx.beginPath(); ctx.arc(W / 2, H / 2, Math.min(W, H) / 2, 0, Math.PI * 2); ctx.clip();
      clear();
    }
    schedule();
  };
  const resize = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const r = canvas.getBoundingClientRect();
    W = r.width; H = r.height;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    reset();
  };

  const tick = () => {
    const accent = css('--accent'), bg = css('--paper');
    ctx.fillStyle = bg; ctx.globalAlpha = 0.04; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = accent; ctx.lineWidth = 1; ctx.globalAlpha = alpha;
    ctx.beginPath();
    for (const p of ps) {
      const a = noise(p.x * scale, p.y * scale) * Math.PI * 4;
      const nx = p.x + Math.cos(a) * step, ny = p.y + Math.sin(a) * step;
      ctx.moveTo(p.x, p.y); ctx.lineTo(nx, ny);
      p.x = nx; p.y = ny; p.life--;
      if (p.life <= 0 || p.x < 0 || p.y < 0 || p.x > W || p.y > H) Object.assign(p, spawn());
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
    drawn++;
  };

  // 動きを減らす設定なら一気に描いて静止画にする。frames 指定があればそこで止める。
  const schedule = () => {
    cancelAnimationFrame(raf);
    if (reduce) { for (let i = 0; i < Math.max(frames, 240); i++) tick(); return; }
    const loop = () => {
      if (!visible) return;
      for (let i = 0; i < speed; i++) tick();
      if (frames && drawn >= frames) return;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
  };

  canvas.addEventListener('click', () => { seed = Math.random() * 1e9; reset(); });
  new MutationObserver(reset).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible && !(frames && drawn >= frames)) schedule(); else cancelAnimationFrame(raf);
  }).observe(canvas);
  addEventListener('resize', resize);
  resize();
}
