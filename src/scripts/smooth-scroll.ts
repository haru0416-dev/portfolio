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

type HistoryState = Record<string, unknown> & { index?: number; scrollX?: number; scrollY?: number };

/**
 * Astro はスクロールが止まるたびに、位置を replaceState で保存する。replaceState のたびに Navigation API の navigate が起き、
 * Cloudflare Web Analytics(SPA の計測)はそれを 1 回の閲覧として送るため、スクロールするたびに計測が増える。
 * 位置だけを変える保存は書き込まずに履歴の項目(index)ごとに持っておき、history.state には持っている値を重ねて見せる。
 * 書き込むのは、次へ進む直前・ページを離れる/隠れるとき・戻る/進むで移ったとき。
 * popstate は Astro の処理が先に動くことがあるため、持っている値は今の項目の index と一致するときだけ見せる。
 */
function deferScrollSaves() {
  const stateGetter = Object.getOwnPropertyDescriptor(History.prototype, 'state')!.get!;
  const stored = () => stateGetter.call(history) as HistoryState | null;
  const replace = history.replaceState.bind(history), push = history.pushState.bind(history);
  const scrolls = new Map<number, { scrollX: unknown; scrollY: unknown }>();
  const withScroll = () => {
    const state = stored();
    const scroll = typeof state?.index === 'number' ? scrolls.get(state.index) : undefined;
    return state && scroll ? { ...state, ...scroll } : state;
  };
  const flush = () => {
    const state = stored();
    if (typeof state?.index !== 'number' || !scrolls.has(state.index)) return;
    const merged = withScroll();
    scrolls.delete(state.index);
    replace(merged, '');
  };
  const onlyScroll = (next: HistoryState, current: HistoryState) => {
    const keys = new Set([...Object.keys(next), ...Object.keys(current)]);
    keys.delete('scrollX'); keys.delete('scrollY');
    return [...keys].every((k) => next[k] === current[k]);
  };
  Object.defineProperty(history, 'state', { configurable: true, get: withScroll });
  history.replaceState = (state: unknown, unused: string, url?: string | URL | null) => {
    const current = stored();
    if (url == null && current && typeof current.index === 'number' && state && typeof state === 'object' && onlyScroll(state as HistoryState, current)) {
      const { scrollX, scrollY } = state as HistoryState;
      scrolls.set(current.index, { scrollX, scrollY });
      return;
    }
    flush();
    replace(state, unused, url);
  };
  history.pushState = (...args: Parameters<History['pushState']>) => { flush(); push(...args); };
  addEventListener('popstate', flush);
  // 再読み込みでは pagehide の中の書き込みが捨てられる。beforeunload の中なら残る。
  addEventListener('beforeunload', flush);
  addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
}

export function installSmoothScroll() {
  if (installed) return;
  installed = true;
  deferScrollSaves();
  addEventListener('wheel', onWheel, { passive: false });
  addEventListener('scroll', sync, { passive: true });
  addEventListener('keydown', onKey, { capture: true });
  addEventListener('pointerdown', stop, { passive: true, capture: true });
  addEventListener('touchstart', stop, { passive: true, capture: true });
  addEventListener('resize', stop, { passive: true });
  REDUCE.addEventListener('change', stop);
  document.addEventListener('astro:after-swap', stop);
}
