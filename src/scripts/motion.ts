// サイトの動きの共通部品。時間・ばね・距離はここだけに書き、各所はこの名前で使う。
// ページ遷移(View Transitions)と背景・Lab の描画ループは別の仕組みで動かしている(global.css、background.ts)。
import { animate, hover, inView, press, scroll, stagger, type AnimationOptions, type DOMKeyframesDefinition } from 'motion';

export const REDUCE = matchMedia('(prefers-reduced-motion: reduce)');
export const reduced = () => REDUCE.matches;

/** ばね。visualDuration は目で見て止まるまでの時間(秒)、bounce は行き過ぎの量。 */
export const SPRING = {
  /** 押す・離すなど、指に追いつく速い動き。 */
  snap: { type: 'spring', visualDuration: 0.18, bounce: 0.2 },
  /** ホバーで浮く・寄るなど、少し遊びのある動き。 */
  lift: { type: 'spring', visualDuration: 0.35, bounce: 0.3 },
  /** 現れるときの動き。行き過ぎない。 */
  enter: { type: 'spring', visualDuration: 0.5, bounce: 0 },
  /** ぷるんと弾む動き。 */
  jelly: { type: 'spring', visualDuration: 0.55, bounce: 0.55 },
} as const satisfies Record<string, AnimationOptions>;

export const EASE_OUT = [0.23, 1, 0.32, 1] as const;
/** 色や透明度だけを変える短い遷移。 */
export const FADE = { duration: 0.15, ease: 'easeOut' } as const satisfies AnimationOptions;
/** 動きを減らす設定のときに、位置を動かさず透明度だけで出し入れする長さ。 */
export const REDUCED_FADE = { duration: 0.2, ease: 'easeOut' } as const satisfies AnimationOptions;

/** 現れるときに下からずらす量。 */
export const RISE = 16;

/** 現れる演出をする要素。描く前に隠しておき、JS が来なければ global.css が 2 秒後に出す。 */
const ENTER = '.wm-char, .hero-lead, .reveal';

/** 演出の前に透明にしておく。ClientRouter の入れ替え直後(描く前)と、初回の読み込みで呼ぶ。 */
export function hideEntrances(root: ParentNode = document) {
  if (reduced()) return;
  root.querySelectorAll<HTMLElement>(ENTER).forEach((el) => { el.style.opacity = '0'; });
}

/** 見出しの文字と、ページの最初の段の要素を順に出す。 */
function enterHero() {
  const chars = [...document.querySelectorAll<HTMLElement>('.wm-char')];
  const leads = [...document.querySelectorAll<HTMLElement>('.hero-lead')];
  if (reduced()) {
    animate([...chars, ...leads], { opacity: 1 }, REDUCED_FADE);
    return;
  }
  animate(chars, { opacity: [0, 1], y: ['0.2em', '0em'] }, { ...SPRING.enter, opacity: { duration: 0.3 }, delay: stagger(0.045, { startDelay: 0.08 }) });
  // 文字が出そろうころから、下の段を上から順に出す。
  const start = 0.08 + chars.length * 0.045;
  animate(leads, { opacity: [0, 1], y: [RISE, 0] }, { ...SPRING.enter, opacity: { duration: 0.4 }, delay: stagger(0.07, { startDelay: Math.max(0.2, start) }) });
}

/** 画面に入った要素を出す。同じコマで入った要素は、上から少しずつずらして出す。 */
function enterOnView() {
  const items = [...document.querySelectorAll<HTMLElement>('.reveal')];
  if (reduced()) {
    animate(items, { opacity: 1 }, REDUCED_FADE);
    return () => {};
  }
  let batch: HTMLElement[] = [];
  let queued = 0;
  const flush = () => {
    queued = 0;
    const els = batch.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top || a.getBoundingClientRect().left - b.getBoundingClientRect().left);
    batch = [];
    animate(els, { opacity: [0, 1], y: [RISE, 0] }, { ...SPRING.enter, opacity: { duration: 0.35 }, delay: stagger(0.06) });
  };
  return inView(items, (el) => {
    batch.push(el as HTMLElement);
    queued ||= requestAnimationFrame(flush);
  }, { margin: '0px 0px -8% 0px', amount: 0.15 });
}

/** 押せる要素(.press)を、押している間だけ縮める。キーボードの Enter でも縮む。 */
function pressables() {
  return press('.press', (el) => {
    if (reduced()) return;
    animate(el, { scale: 0.95 }, SPRING.snap);
    return () => { animate(el, { scale: 1 }, SPRING.lift); };
  });
}

/** マウスで乗ったときだけの動き。指では hover が後から付いて残るので使わない。 */
const finePointer = matchMedia('(hover: hover) and (pointer: fine)');

function hovers() {
  if (!finePointer.matches) return () => {};
  const stops = [
    // シールを持ち上げる。外枠(.sticker-hit)があるときは外枠で受け、中のシールを動かす。
    hover('.sticker-hit, .sticker-lift:not(.sticker-hit > .sticker-lift)', (el) => {
      if (reduced()) return;
      const sticker = el.matches('.sticker-hit') ? el.querySelector<HTMLElement>('.sticker-lift') : el as HTMLElement;
      if (!sticker) return;
      sticker.classList.add('is-lifted');
      animate(sticker, { rotate: 5, y: -4 }, SPRING.lift);
      return () => { sticker.classList.remove('is-lifted'); animate(sticker, { rotate: 0, y: 0 }, SPRING.lift); };
    }),
    // 作品と実験のカードは、表紙を少し寄せる。
    hover('.work-card:not(.work-hero)', (el) => {
      const cover = el.querySelector<HTMLElement>('.cover');
      if (!cover || reduced()) return;
      animate(cover, { scale: 1.04 }, SPRING.lift);
      return () => { animate(cover, { scale: 1 }, SPRING.lift); };
    }),
  ];
  return () => stops.forEach((stop) => stop());
}

/** スクロールに合わせて動かす。CSS のスクロールタイムラインがないブラウザでも動く。 */
function scrollLinked() {
  const stops: VoidFunction[] = [];
  // 記事の読み進み。動きを減らす設定でも、どこまで読んだかを示すので残す。
  const bar = document.querySelector<HTMLElement>('.read-progress');
  const post = document.querySelector<HTMLElement>('[data-post-body]');
  if (bar && post) {
    bar.hidden = false;
    const offset = ['start start', 'end end'] as const;
    stops.push(scroll(animate(bar, { scaleX: [0, 1] }, { ease: 'linear' }), { target: post, offset: [...offset] }));
    // 読み終えたら、バーを一度だけ光らせる。少し戻ってからまた読み終えたら、もう一度光る。
    const glow = bar.querySelector<HTMLElement>('.read-progress-glow');
    let done = false;
    if (glow) stops.push(scroll((p: number) => {
      if (p < 0.97) { done = false; return; }
      if (done || p < 0.999) return;
      done = true;
      if (reduced()) animate(glow, { opacity: [0, 0.8, 0] }, { duration: 0.6 });
      else animate(glow, { opacity: [0, 1, 0], scaleY: [1, 3, 1] }, { duration: 0.9, ease: 'easeOut', times: [0, 0.2, 1] });
    }, { target: post, offset: [...offset] }));
  }
  if (reduced()) return () => stops.forEach((stop) => stop());
  // トップの見出しの塊は、最初の 480px で少し上へ逃がして薄くする。
  const lead = document.querySelector<HTMLElement>('.parallax');
  if (lead) {
    stops.push(scroll((_: number, info: { y: { current: number } }) => {
      const t = Math.min(1, info.y.current / 480);
      lead.style.transform = `translateY(${-24 * t}px)`;
      lead.style.opacity = String(1 - 0.4 * t);
    }));
  }
  // 背景の太陽は、1 画面ぶんで上へ抜けて消える。
  const sun = document.querySelector<HTMLElement>('.sea .sun');
  if (sun) {
    stops.push(scroll((_: number, info: { y: { current: number } }) => {
      const t = Math.min(1, info.y.current / innerHeight);
      sun.style.transform = `translateY(${-40 * t}vh)`;
      sun.style.opacity = String(1 - t);
    }));
  }
  return () => stops.forEach((stop) => stop());
}

/** 作品と実験のカードを、カーソルのある側へ少し傾ける。押したらすぐ平らに戻し、ページ遷移の撮影に傾きを残さない。 */
function tilts() {
  if (!finePointer.matches) return () => {};
  const ac = new AbortController();
  const MAX = 5;
  document.querySelectorAll<HTMLElement>('.work-card:not(.work-hero)').forEach((card) => {
    const on = <K extends keyof HTMLElementEventMap>(type: K, fn: (e: HTMLElementEventMap[K]) => void) => card.addEventListener(type, fn, { signal: ac.signal });
    on('pointermove', (e) => {
      if (e.pointerType !== 'mouse' || reduced()) return;
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
      animate(card, { rotateY: px * MAX * 2, rotateX: -py * MAX * 2, transformPerspective: 900 }, SPRING.lift);
    });
    const flat = (fast: boolean) => animate(card, { rotateX: 0, rotateY: 0 }, fast ? { duration: 0.08 } : SPRING.lift);
    on('pointerleave', () => flat(false));
    on('pointerdown', () => flat(true));
  });
  return () => ac.abort();
}

/** 1 つだけ選べるチップの列([data-chip-group])で、選んだ面を押したチップへ滑らせる。
 *  aria-pressed の変化を見張るので、各ページのスクリプトは今までどおり属性を付け替えるだけでよい。
 *  一覧の絞り込みの View Transition の最中([data-morphing])は、遷移が面を動かすので、ここではすぐ置く。 */
function chipIndicators() {
  const stops: VoidFunction[] = [];
  document.querySelectorAll<HTMLElement>('[data-chip-group]').forEach((group) => {
    const pill = document.createElement('span');
    pill.className = 'chip-indicator';
    pill.setAttribute('aria-hidden', 'true');
    group.prepend(pill);
    group.classList.add('has-indicator');
    let first = true;
    const place = (instant = false) => {
      const chip = group.querySelector<HTMLElement>('.chip[aria-pressed="true"]');
      if (!chip) { animate(pill, { opacity: 0 }, FADE); return; }
      const to = { x: chip.offsetLeft, y: chip.offsetTop, width: chip.offsetWidth, height: chip.offsetHeight, opacity: 1 };
      const now = first || instant || reduced() || group.closest('[data-morphing]');
      first = false;
      animate(pill, to, now ? { duration: 0 } : SPRING.lift);
    };
    place();
    const watch = new MutationObserver(() => place());
    watch.observe(group, { subtree: true, attributeFilter: ['aria-pressed'] });
    const resized = new ResizeObserver(() => place(true));
    resized.observe(group);
    stops.push(() => { watch.disconnect(); resized.disconnect(); pill.remove(); group.classList.remove('has-indicator'); });
  });
  return () => stops.forEach((stop) => stop());
}

/** 大事なボタン([data-magnetic])を、乗せたカーソルの方へ少しだけ寄せる。 */
function magnets() {
  if (!finePointer.matches) return () => {};
  const ac = new AbortController();
  document.querySelectorAll<HTMLElement>('[data-magnetic]').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse' || reduced()) return;
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      animate(el, { x: Math.max(-6, Math.min(6, dx * 0.2)), y: Math.max(-4, Math.min(4, dy * 0.3)) }, SPRING.lift);
    }, { signal: ac.signal });
    el.addEventListener('pointerleave', () => { animate(el, { x: 0, y: 0 }, SPRING.jelly); }, { signal: ac.signal });
  });
  return () => ac.abort();
}

/** 読み始めたらヘッダーを 8px 低くし、ページの上へ戻ったら元に戻す。高さは変えず、
 *  --header-shrink の分だけ上へずらす(global.css)。記事の読み進みバーとテーマの選択肢も同じだけ上がる。 */
const SHRINK = 8;
function headerShrink() {
  const root = document.documentElement;
  if (reduced()) { root.style.removeProperty('--header-shrink'); return () => {}; }
  let shrunk = false;
  const set = (on: boolean, instant = false) => {
    if (on === shrunk) return;
    shrunk = on;
    animate(root, { '--header-shrink': `${on ? SHRINK : 0}px` } as DOMKeyframesDefinition, instant ? { duration: 0 } : { ...SPRING.lift, bounce: 0 });
  };
  root.style.setProperty('--header-shrink', '0px');
  set(scrollY > 48, true);
  // 行き来しやすいよう、縮めるのと戻すのとで線をずらす。
  return scroll((_: number, info: { y: { current: number } }) => {
    const y = info.y.current;
    if (y > 48) set(true);
    else if (y < 16) set(false);
  });
}

/** 数字を、前の値から新しい値までばねで数え上げる。読み上げには最後の値だけを渡す。 */
export function countTo(from: number, to: number, render: (n: number) => void) {
  if (reduced() || from === to) { render(to); return; }
  animate(from, to, { ...SPRING.enter, visualDuration: 0.45, onUpdate: (v) => render(Math.round(v)) });
}

/** 要素を出す。位置を少し下からずらし、動きを減らす設定では透明度だけにする。 */
export function show(el: Element | Element[], keyframes: DOMKeyframesDefinition = { opacity: [0, 1], y: [8, 0] }) {
  return reduced() ? animate(el, { opacity: [0, 1] }, REDUCED_FADE) : animate(el, keyframes, { ...SPRING.enter, visualDuration: 0.3, opacity: { duration: 0.2 } });
}

/** 要素を消す。終わってから呼び出し元が hidden などを付ける。 */
export function hide(el: Element | Element[], keyframes: DOMKeyframesDefinition = { opacity: 0, y: -4 }) {
  return reduced() ? animate(el, { opacity: 0 }, REDUCED_FADE) : animate(el, keyframes, { duration: 0.12, ease: 'easeIn' });
}

let installed = false;
/** サイト全体の動きを組み立てる。Base.astro から 1 回だけ呼ぶ。 */
export function installMotion() {
  if (installed) return;
  installed = true;
  const setup = () => {
    enterHero();
    const stops = [enterOnView(), pressables(), hovers(), scrollLinked(), tilts(), chipIndicators(), magnets(), headerShrink()];
    return () => stops.forEach((stop) => stop());
  };
  // 初回の astro:page-load は画像やフォントを読み終えた load のあとに来るので、待たずにすぐ始める。
  // モジュールのスクリプトは HTML を読み終えてから動くので、要素はそろっている。
  hideEntrances();
  // 描く前に隠したので、global.css の「JS が来なかったときの保険」を外す。
  document.documentElement.removeAttribute('data-motion');
  let cleanup: (() => void) | void = setup();
  let initial = true;
  // ClientRouter の入れ替え直後、新しいページが描かれる前に隠す。
  document.addEventListener('astro:after-swap', () => hideEntrances());
  document.addEventListener('astro:page-load', () => {
    if (initial) { initial = false; return; }
    cleanup?.(); cleanup = setup();
  });
  document.addEventListener('astro:before-swap', () => { initial = false; cleanup?.(); cleanup = undefined; });
}
