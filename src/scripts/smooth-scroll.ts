const STIFFNESS = 11; // 秒の逆数
const NOTCH_MIN = 30; // 小さい delta はトラックパッドとみなし、ホイールだけ補間する。
const REDUCE = matchMedia('(prefers-reduced-motion: reduce)');
const SCROLL_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End', ' ', 'Tab'];

let target = 0, current = 0, written = 0, raf = 0, last = 0, running = false, installed = false;

const stop = () => {
  cancelAnimationFrame(raf);
  running = false;
  current = target = written = scrollY;
};

const step = (now: number) => {
  if (scrollY !== written) { stop(); return; }
  const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
  last = now;
  current += (target - current) * (1 - Math.exp(-STIFFNESS * dt));
  if (Math.abs(target - current) < 0.5) { current = target; running = false; }
  scrollTo(0, current);
  written = scrollY; // ブラウザによる丸め・端での制限を反映する
  if (running) raf = requestAnimationFrame(step);
};

const onWheel = (e: WheelEvent) => {
  if (REDUCE.matches || e.ctrlKey || e.shiftKey || e.defaultPrevented || Math.abs(e.deltaX) > Math.abs(e.deltaY)) { stop(); return; }
  let d = e.deltaY;
  if (e.deltaMode === 1) d *= 16; else if (e.deltaMode === 2) d *= innerHeight;
  if (Math.abs(d) < NOTCH_MIN) { stop(); return; }
  for (let el = e.target as HTMLElement | null; el && el !== document.body; el = el.parentElement) {
    const o = getComputedStyle(el).overflowY;
    if ((o === 'auto' || o === 'scroll') && el.scrollHeight > el.clientHeight) { stop(); return; }
  }
  e.preventDefault();
  if (!running || scrollY !== written) stop();
  target = Math.max(0, Math.min(document.documentElement.scrollHeight - innerHeight, target + d));
  if (!running) { running = true; last = performance.now(); raf = requestAnimationFrame(step); }
};

const sync = () => { if (!running || scrollY !== written) stop(); };
const onKey = (e: KeyboardEvent) => {
  if (SCROLL_KEYS.includes(e.key)) stop();
};

export function installSmoothScroll() {
  if (installed) return;
  installed = true;
  addEventListener('wheel', onWheel, { passive: false });
  addEventListener('scroll', sync, { passive: true });
  addEventListener('keydown', onKey, { capture: true });
  addEventListener('pointerdown', stop, { passive: true, capture: true });
  addEventListener('touchstart', stop, { passive: true, capture: true });
  addEventListener('resize', stop, { passive: true });
  REDUCE.addEventListener('change', stop);
  document.addEventListener('astro:after-swap', stop);
}
