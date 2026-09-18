type Petal = {
  x: number; y: number;
  sprite: HTMLCanvasElement; half: number;
  rot: number; spin: number;
  tilt: number; tiltSpeed: number;
  vy: number; sway: number; swaySpeed: number; phase: number;
  depth: number;
};

const COLORS = ['#f9c9d8', '#f5b3c8', '#fbd9e4', '#f4a2bc', '#fde9f0'];
const LAYERS = [
  { depth: 0.55, blur: 1.6, alpha: 0.55 },
  { depth: 0.8, blur: 0.6, alpha: 0.8 },
  { depth: 1.0, blur: 0, alpha: 0.95 },
];

function drawPetalPath(ctx: CanvasRenderingContext2D, r: number) {
  ctx.beginPath();
  ctx.moveTo(0, r);
  ctx.bezierCurveTo(r * 1.1, r * 0.6, r * 1.05, -r * 0.55, r * 0.42, -r * 0.92);
  ctx.quadraticCurveTo(r * 0.2, -r * 1.02, 0, -r * 0.62);
  ctx.quadraticCurveTo(-r * 0.2, -r * 1.02, -r * 0.42, -r * 0.92);
  ctx.bezierCurveTo(-r * 1.05, -r * 0.55, -r * 1.1, r * 0.6, 0, r);
  ctx.closePath();
}

function makeSprite(color: string, r: number, blur: number, alpha: number, dpr: number) {
  const pad = Math.ceil(blur * 3 + 2);
  const size = Math.ceil((r * 2.3 + pad * 2) * dpr);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, size / 2 / dpr, size / 2 / dpr);
  if (blur) ctx.filter = `blur(${blur}px)`;
  ctx.globalAlpha = alpha;
  const g = ctx.createLinearGradient(0, r, 0, -r);
  g.addColorStop(0, shade(color, -0.12));
  g.addColorStop(1, shade(color, 0.08));
  ctx.fillStyle = g;
  drawPetalPath(ctx, r);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = r * 0.08;
  ctx.beginPath(); ctx.moveTo(0, r * 0.85); ctx.quadraticCurveTo(r * 0.05, 0, 0, -r * 0.5); ctx.stroke();
  return c;
}

/** hex は #rrggbb のみ。 */
function shade(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k))));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

export type PetalsControl = { pause(): void; resume(): void; dispose(): void };

export function startPetals(canvas: HTMLCanvasElement): PetalsControl {
  const ctx = canvas.getContext('2d', { alpha: true })!;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const dpr = Math.min(devicePixelRatio || 1, 2);

  let W = 0, H = 0, petals: Petal[] = [], raf = 0, visible = true, paused = false, last = 0, t = 0;
  const sprites = new Map<string, HTMLCanvasElement>();
  const sprite = (color: string, r: number, layer: (typeof LAYERS)[number]) => {
    const key = `${color}/${r}/${layer.depth}`;
    let s = sprites.get(key);
    if (!s) { s = makeSprite(color, r, layer.blur, layer.alpha, dpr); sprites.set(key, s); }
    return s;
  };

  const make = (fromTop: boolean): Petal => {
    const layer = LAYERS[(Math.random() * LAYERS.length) | 0];
    const r = [8, 10, 12][(Math.random() * 3) | 0] * layer.depth;
    const s = sprite(COLORS[(Math.random() * COLORS.length) | 0], r, layer);
    return {
      x: Math.random() * W, y: fromTop ? -r * 3 : Math.random() * H,
      sprite: s, half: s.width / dpr / 2,
      rot: Math.random() * Math.PI * 2, spin: (Math.random() - 0.5) * 1.2,
      tilt: Math.random() * Math.PI * 2, tiltSpeed: 1.5 + Math.random() * 2,
      vy: (28 + Math.random() * 30) * layer.depth,
      sway: 14 + Math.random() * 16, swaySpeed: 0.8 + Math.random() * 0.8, phase: Math.random() * Math.PI * 2,
      depth: layer.depth,
    };
  };

  const wind = (time: number) => 10 * Math.sin(time * 0.23) + 6 * Math.sin(time * 0.61 + 1.3);

  const step = (dt: number) => {
    t += dt;
    const w = wind(t);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    for (const p of petals) {
      p.y += p.vy * dt;
      p.x += (Math.sin(t * p.swaySpeed + p.phase) * p.sway + w) * p.depth * dt;
      p.rot += p.spin * dt;
      p.tilt += p.tiltSpeed * dt;
      if (p.y > H + p.half * 2 || p.x < -p.half * 4 || p.x > W + p.half * 4) Object.assign(p, make(true));
      const sx = 0.35 + 0.65 * Math.abs(Math.cos(p.tilt));
      const c = Math.cos(p.rot), s = Math.sin(p.rot);
      ctx.setTransform(c * sx * dpr, s * sx * dpr, -s * dpr, c * dpr, p.x * dpr, p.y * dpr);
      ctx.drawImage(p.sprite, -p.half, -p.half, p.half * 2, p.half * 2);
    }
  };

  const frame = (now: number) => {
    if (reduce.matches || paused || !visible || document.hidden) return;
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016); // タブ復帰時の飛びを防ぐ
    last = now;
    step(dt);
    raf = requestAnimationFrame(frame);
  };
  const start = () => { cancelAnimationFrame(raf); last = performance.now(); if (!reduce.matches && !paused && visible && !document.hidden) raf = requestAnimationFrame(frame); };

  const resize = () => {
    const r = canvas.getBoundingClientRect();
    if (!r.width) return;
    const oldW = W, oldH = H;
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    const n = Math.min(160, Math.round((W * H) / 5500));
    if (oldW && petals.length) {
      for (const p of petals) { p.x *= W / oldW; p.y *= H / oldH; }
      while (petals.length < n) petals.push(make(false));
      petals.length = n;
    } else {
      petals = Array.from({ length: n }, () => make(false));
    }
    if (reduce.matches && !oldW) { for (let i = 0; i < 3; i++) step(0.5); }
    else step(0);
  };

  const ro = new ResizeObserver(resize); ro.observe(canvas);
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; start(); }); io.observe(canvas);
  const onMotion = () => { start(); if (reduce.matches) step(0); };
  document.addEventListener('visibilitychange', start);
  reduce.addEventListener('change', onMotion);
  resize();
  start();
  return {
    pause() { paused = true; cancelAnimationFrame(raf); },
    resume() { paused = false; start(); },
    dispose() { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); document.removeEventListener('visibilitychange', start); reduce.removeEventListener('change', onMotion); },
  };
}
