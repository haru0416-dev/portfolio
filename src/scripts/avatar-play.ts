// 見出しのイラストの仕掛け。つつくとぷるんと弾んで泡と魚が昇り、撫でると揺れてハートと音符が出る。
// 撫でるのは、マウスなら左右にこする往復、タッチなら長押し(指で撫でるとスクロールと区別できない)。

const REDUCE = matchMedia('(prefers-reduced-motion: reduce)');
/** 撫でていると判断する、左右の往復の回数と、その間の時間(ms)。 */
const RUBS = 3, RUB_WINDOW = 900, RUB_MIN = 12;
const HOLD = 450;
const PET_EVERY = 280;

const BUBBLE = `<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="8.6" fill="oklch(92% .04 220 / .18)" stroke="white" stroke-opacity=".85" stroke-width="1.4"/><ellipse cx="7" cy="6.8" rx="2.4" ry="1.5" transform="rotate(-40 7 6.8)" fill="white" opacity=".9"/></svg>`;
const FISH = `<svg viewBox="0 0 24 16"><path d="M3 8c3-5 10-6 15-2l4-3v10l-4-3c-5 4-12 3-15-2z" fill="oklch(78% .1 245)"/><circle cx="7.5" cy="7" r="1.3" fill="white"/></svg>`;
const HEART = `<svg viewBox="0 0 20 18"><path d="M10 17S1 11.2 1 5.6A4.6 4.6 0 0 1 10 3.4a4.6 4.6 0 0 1 9 2.2C19 11.2 10 17 10 17z" fill="var(--accent)" stroke="white" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
const NOTE = `<svg viewBox="0 0 16 20"><path d="M6 15.5V3l9-2v12" fill="none" stroke="oklch(70% .12 245)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><ellipse cx="4" cy="15.8" rx="3.2" ry="2.5" fill="oklch(70% .12 245)"/><ellipse cx="13" cy="13.6" rx="3.2" ry="2.5" fill="oklch(70% .12 245)"/></svg>`;

let layer: HTMLElement | null = null;
const fxLayer = () => {
  if (!layer?.isConnected) {
    layer = document.createElement('div');
    layer.className = 'avatar-fx';
    layer.setAttribute('aria-hidden', 'true');
    document.body.append(layer);
  }
  return layer;
};

/** (x, y) から昇って消える小さな絵を 1 つ出す。 */
function emit(svg: string, x: number, y: number, size: number, rise: number, drift: number, duration: number, delay = 0) {
  const el = document.createElement('span');
  el.className = 'avatar-fx-item';
  el.innerHTML = svg;
  Object.assign(el.style, { left: `${x - size / 2}px`, top: `${y - size / 2}px`, width: `${size}px`, height: `${size}px` });
  fxLayer().append(el);
  const sway = (Math.random() - 0.5) * 16;
  el.animate([
    { transform: 'translate(0, 0) scale(.6)', opacity: 0 },
    { transform: `translate(${sway}px, ${-rise * 0.25}px) scale(1)`, opacity: 1, offset: 0.15 },
    { transform: `translate(${drift - sway}px, ${-rise * 0.7}px) scale(1)`, opacity: 1, offset: 0.7 },
    { transform: `translate(${drift}px, ${-rise}px) scale(.9)`, opacity: 0 },
  ], { duration, delay, easing: 'cubic-bezier(.3,.6,.4,1)', fill: 'both' }).finished.then(() => el.remove(), () => el.remove());
}

export function startAvatarPlay(root: HTMLElement): () => void {
  const art = root.querySelector('img')!;
  const ac = new AbortController();
  const on = <K extends keyof HTMLElementEventMap>(type: K, fn: (e: HTMLElementEventMap[K]) => void) =>
    root.addEventListener(type, fn, { signal: ac.signal });

  const poke = (x: number, y: number) => {
    art.animate([
      { scale: '1 1' }, { scale: '1.12 .86' }, { scale: '.92 1.1' }, { scale: '1.05 .96' }, { scale: '.98 1.02' }, { scale: '1 1' },
    ], { duration: 620, easing: 'ease-out' });
    for (let i = 0; i < 6; i++) emit(BUBBLE, x + (Math.random() - 0.5) * 40, y + (Math.random() - 0.5) * 20, 8 + Math.random() * 12, 70 + Math.random() * 70, (Math.random() - 0.5) * 30, 1000 + Math.random() * 500, i * 50);
    const fishes = 1 + (Math.random() < 0.5 ? 1 : 0);
    for (let i = 0; i < fishes; i++) {
      const dir = Math.random() < 0.5 ? -1 : 1;
      emit(FISH, x + dir * 10, y, 18 + Math.random() * 6, 60 + Math.random() * 40, dir * (40 + Math.random() * 30), 1300, 80 + i * 120);
    }
  };

  let lastPet = 0, wiggle: Animation | null = null, petUntil = 0;
  const pet = (x: number, y: number) => {
    const now = performance.now();
    petUntil = now + 400;
    if (!wiggle) {
      wiggle = art.animate([{ rotate: '0deg' }, { rotate: '-4deg' }, { rotate: '0deg' }, { rotate: '4deg' }, { rotate: '0deg' }], { duration: 360, iterations: Infinity });
      const stop = () => { if (performance.now() < petUntil) return void requestAnimationFrame(stop); wiggle?.cancel(); wiggle = null; };
      requestAnimationFrame(stop);
    }
    if (now - lastPet < PET_EVERY) return;
    lastPet = now;
    emit(Math.random() < 0.6 ? HEART : NOTE, x + (Math.random() - 0.5) * 30, y - 10, 14 + Math.random() * 6, 60 + Math.random() * 30, (Math.random() - 0.5) * 40, 1100);
  };

  // マウス: 左右の往復を数える。
  let lastX = 0, dir = 0, run = 0, turns: number[] = [];
  on('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || REDUCE.matches) return;
    const dx = e.clientX - lastX;
    lastX = e.clientX;
    if (!dx) return;
    const d = Math.sign(dx);
    if (d === dir) { run += Math.abs(dx); return; }
    if (run >= RUB_MIN) turns.push(e.timeStamp);
    dir = d; run = Math.abs(dx);
    turns = turns.filter((t) => e.timeStamp - t < RUB_WINDOW);
    if (turns.length >= RUBS || performance.now() < petUntil) pet(e.clientX, e.clientY);
  });
  on('pointerleave', () => { turns = []; });

  // タッチ: 長押しで撫でる。押している間はハートを出し続ける。
  let holdTimer = 0, holdFrame = 0, holding = false, petted = false, touchPoint = { x: 0, y: 0 };
  const petLoop = () => { if (!holding) return; pet(touchPoint.x, touchPoint.y); holdFrame = requestAnimationFrame(petLoop); };
  on('pointerdown', (e) => {
    petted = false;
    if (e.pointerType === 'mouse' || REDUCE.matches) return;
    touchPoint = { x: e.clientX, y: e.clientY };
    holdTimer = window.setTimeout(() => { holding = petted = true; petLoop(); }, HOLD);
  });
  const release = () => { clearTimeout(holdTimer); cancelAnimationFrame(holdFrame); holding = false; };
  on('pointerup', release);
  on('pointercancel', release);
  on('pointermove', (e) => { if (e.pointerType !== 'mouse' && Math.hypot(e.clientX - touchPoint.x, e.clientY - touchPoint.y) > 10 && !holding) clearTimeout(holdTimer); });
  on('contextmenu', (e) => e.preventDefault());

  on('click', (e) => {
    if (REDUCE.matches || petted) return;
    poke(e.clientX, e.clientY);
  });

  return () => { ac.abort(); release(); wiggle?.cancel(); };
}
