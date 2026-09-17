// 桜の花びらが舞う。クリックで風が吹く。
export function startPetals(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')!;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const N = 110;
  const COLORS = ['#f9c5d5', '#f6a8c1', '#fbd7e3', '#f28bb0', '#fde8ef'];

  type Petal = {
    x: number; y: number; r: number; rot: number; spin: number;
    vy: number; sway: number; phase: number; color: string; depth: number;
  };
  let W = 0, H = 0, petals: Petal[] = [], raf = 0, visible = true, t = 0;
  let wind = 0; // 右向きの風の強さ。時間で減衰する

  const make = (fromTop: boolean): Petal => {
    const depth = 0.5 + Math.random();
    return {
      x: Math.random() * W, y: fromTop ? -20 : Math.random() * H,
      r: (7 + Math.random() * 7) * depth, rot: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.06, vy: (0.5 + Math.random() * 0.8) * depth,
      sway: 0.6 + Math.random() * 0.8, phase: Math.random() * Math.PI * 2,
      color: COLORS[(Math.random() * COLORS.length) | 0], depth,
    };
  };

  const petal = (p: Petal) => {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.scale(1, 0.7 + 0.3 * Math.sin(t * 0.03 + p.phase)); // ひらひら
    ctx.fillStyle = p.color;
    ctx.globalAlpha = 0.55 + 0.45 * Math.min(1, p.depth);
    ctx.beginPath();
    // 花びら: 先が少し割れた雫の形
    ctx.moveTo(0, -p.r);
    ctx.bezierCurveTo(p.r, -p.r, p.r, p.r * 0.6, 0, p.r);
    ctx.bezierCurveTo(-p.r, p.r * 0.6, -p.r, -p.r, 0, -p.r);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.arc(0, -p.r * 0.35, p.r * 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };

  const step = () => {
    t++;
    wind *= 0.985;
    ctx.clearRect(0, 0, W, H);
    for (const p of petals) {
      p.y += p.vy;
      p.x += Math.sin(t * 0.02 * p.sway + p.phase) * 0.6 * p.depth + wind * p.depth;
      p.rot += p.spin + wind * 0.01;
      if (p.y > H + 20 || p.x < -30 || p.x > W + 30) Object.assign(p, make(true));
      petal(p);
    }
  };

  const resize = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const r = canvas.getBoundingClientRect();
    W = r.width; H = r.height;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    petals = Array.from({ length: N }, () => make(false));
    if (reduce) { ctx.clearRect(0, 0, W, H); petals.forEach(petal); }
  };

  const loop = () => { if (!visible) return; step(); raf = requestAnimationFrame(loop); };
  const start = () => { cancelAnimationFrame(raf); if (!reduce) raf = requestAnimationFrame(loop); };

  canvas.addEventListener('click', (e) => {
    const r = canvas.getBoundingClientRect();
    wind += (e.clientX - r.left < W / 2 ? 1 : -1) * 6; // クリックした側から風が吹く
    if (reduce) { for (let i = 0; i < 60; i++) step(); }
  });
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? start() : cancelAnimationFrame(raf); }).observe(canvas);
  addEventListener('resize', resize);
  resize();
  start();
}
