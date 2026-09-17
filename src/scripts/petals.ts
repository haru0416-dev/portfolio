// 桜の花びらが舞う。
// 描画効率のため、花びらは色×大きさ×奥行きごとに一度だけ描いてスプライトにし、毎フレームは転写だけ行う。

type Petal = {
  x: number; y: number;
  sprite: HTMLCanvasElement; half: number;
  rot: number; spin: number;          // 画面内の回転
  tilt: number; tiltSpeed: number;    // 軸回りの回転(横幅の伸縮で表す)
  vy: number; sway: number; swaySpeed: number; phase: number;
  depth: number;
};

const COLORS = ['#f9c9d8', '#f5b3c8', '#fbd9e4', '#f4a2bc', '#fde9f0'];
const LAYERS = [
  { depth: 0.55, blur: 1.6, alpha: 0.55 }, // 奥: 小さく、ぼけて、薄い
  { depth: 0.8, blur: 0.6, alpha: 0.8 },
  { depth: 1.0, blur: 0, alpha: 0.95 },    // 手前
];

/** 桜の花びら(先端に切れ込み)を一枚描く。基準サイズは半径 r */
function drawPetalPath(ctx: CanvasRenderingContext2D, r: number) {
  ctx.beginPath();
  ctx.moveTo(0, r);                                   // 付け根
  ctx.bezierCurveTo(r * 1.1, r * 0.6, r * 1.05, -r * 0.55, r * 0.42, -r * 0.92); // 右辺
  ctx.quadraticCurveTo(r * 0.2, -r * 1.02, 0, -r * 0.62);                         // 切れ込み
  ctx.quadraticCurveTo(-r * 0.2, -r * 1.02, -r * 0.42, -r * 0.92);
  ctx.bezierCurveTo(-r * 1.05, -r * 0.55, -r * 1.1, r * 0.6, 0, r);              // 左辺
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
  // 付け根が濃く、先端が淡いグラデーション
  const g = ctx.createLinearGradient(0, r, 0, -r);
  g.addColorStop(0, shade(color, -0.12));
  g.addColorStop(1, shade(color, 0.08));
  ctx.fillStyle = g;
  drawPetalPath(ctx, r);
  ctx.fill();
  // 中央の淡い筋
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = r * 0.08;
  ctx.beginPath(); ctx.moveTo(0, r * 0.85); ctx.quadraticCurveTo(r * 0.05, 0, 0, -r * 0.5); ctx.stroke();
  return c;
}

/** #rrggbb を明るく(+)/暗く(-)する */
function shade(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k))));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

export function startPetals(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d', { alpha: true })!;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dpr = Math.min(devicePixelRatio || 1, 2);

  let W = 0, H = 0, petals: Petal[] = [], raf = 0, visible = true, last = 0, t = 0;
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

  /** ゆっくり変わる風。二つの周期を重ねて単調にならないようにする */
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
      // 回転と、軸回りの傾きによる横幅の伸縮を 1 回の setTransform で済ませる
      const sx = 0.35 + 0.65 * Math.abs(Math.cos(p.tilt));
      const c = Math.cos(p.rot), s = Math.sin(p.rot);
      ctx.setTransform(c * sx * dpr, s * sx * dpr, -s * dpr, c * dpr, p.x * dpr, p.y * dpr);
      ctx.drawImage(p.sprite, -p.half, -p.half, p.half * 2, p.half * 2);
    }
  };

  const frame = (now: number) => {
    if (!visible) return;
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016); // タブ復帰時の飛びを防ぐ
    last = now;
    step(dt);
    raf = requestAnimationFrame(frame);
  };
  const start = () => { cancelAnimationFrame(raf); last = performance.now(); if (!reduce) raf = requestAnimationFrame(frame); };

  const resize = () => {
    const r = canvas.getBoundingClientRect();
    if (!r.width) return;
    const oldW = W, oldH = H;
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    const n = Math.min(160, Math.round((W * H) / 5500)); // 面積に応じた枚数
    if (oldW && petals.length) {
      // 位置を比例で保ち、枚数だけ合わせる
      for (const p of petals) { p.x *= W / oldW; p.y *= H / oldH; }
      while (petals.length < n) petals.push(make(false));
      petals.length = n;
    } else {
      petals = Array.from({ length: n }, () => make(false));
    }
    if (reduce) { for (let i = 0; i < 3; i++) step(0.5); }
  };

  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? start() : cancelAnimationFrame(raf); }).observe(canvas);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) last = performance.now(); });
  resize();
  start();
}
