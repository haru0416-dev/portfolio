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
    stops.push(scroll(animate(bar, { scaleX: [0, 1] }, { ease: 'linear' }), { target: post, offset: ['start start', 'end end'] }));
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
    const stops = [enterOnView(), pressables(), hovers(), scrollLinked()];
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
