// マウスホイールの段階的なスクロールを、慣性のある滑らかな動きにする。
// ホイールの 1 段(大きな delta)だけを引き受け、トラックパッドの細かい入力は素通しにする。

const STIFFNESS = 11;   // 追従の速さ(1 秒あたり)。大きいほど機敏
const NOTCH_MIN = 30;   // これより小さい delta はトラックパッドとみなして触らない
const REDUCE = matchMedia('(prefers-reduced-motion: reduce)');

let target = 0, current = 0, raf = 0, last = 0, running = false, installed = false;

const max = () => document.documentElement.scrollHeight - innerHeight;

const step = (now: number) => {
  const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
  last = now;
  current += (target - current) * (1 - Math.exp(-STIFFNESS * dt));
  if (Math.abs(target - current) < 0.5) { current = target; running = false; }
  scrollTo(0, current);
  if (running) raf = requestAnimationFrame(step);
};

const onWheel = (e: WheelEvent) => {
  if (e.ctrlKey || e.defaultPrevented) return; // 拡大縮小や他の処理は邪魔しない
  let d = e.deltaY;
  if (e.deltaMode === 1) d *= 16; else if (e.deltaMode === 2) d *= innerHeight;
  if (Math.abs(d) < NOTCH_MIN) return; // トラックパッド
  // 入れ子のスクロール要素の中なら触らない
  for (let el = e.target as HTMLElement | null; el && el !== document.body; el = el.parentElement) {
    const o = getComputedStyle(el).overflowY;
    if ((o === 'auto' || o === 'scroll') && el.scrollHeight > el.clientHeight) return;
  }
  e.preventDefault();
  if (!running) { current = scrollY; target = current; }
  target = Math.max(0, Math.min(max(), target + d));
  if (!running) { running = true; last = performance.now(); raf = requestAnimationFrame(step); }
};

const sync = () => { if (!running) { current = target = scrollY; } };

export function installSmoothScroll() {
  if (installed || REDUCE.matches) return;
  installed = true;
  addEventListener('wheel', onWheel, { passive: false });
  addEventListener('scroll', sync, { passive: true });
  // ページ遷移で位置が変わったら追従を止めて合わせ直す
  document.addEventListener('astro:after-swap', () => { cancelAnimationFrame(raf); running = false; sync(); });
}
