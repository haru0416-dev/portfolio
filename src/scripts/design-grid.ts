// 遷移で head が差し替わると import した CSS は外れるため、html 直下の層に style として持たせる。
import css from '../styles/design-grid.css?inline';

// global.css の @theme と同じ値。段は 16px × 1.25ⁿ の n。
const TYPE_STEPS: [string, number][] = [
  ['xs', -1], ['sm', -0.5], ['base', 0], ['', 0.5], ['lg', 1], ['xl', 2], ['2xl', 3],
  ['3xl', 4], ['4xl', 5], ['5xl', 6], ['6xl', 7], ['7xl', 8],
];
const RADII = [4, 6, 8, 12, 16, 24, 32];
const UNIT = 8;
const KEY = 'design-grid';

let on = false;
let root: HTMLElement | undefined;
let legend: HTMLElement | undefined;
let card: HTMLElement | undefined;
let sizeObserver: ResizeObserver | undefined;
let frame = 0;

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent?: HTMLElement) => {
  const e = document.createElement(tag);
  e.className = cls;
  parent?.append(e);
  return e;
};
const px = (v: string) => Math.round(parseFloat(v) * 100) / 100;
const fmt = (v: number) => String(Math.round(v * 100) / 100);

/** 8px 単位で読めるか。4px は半単位として許す。 */
function units(v: number) {
  if (v === 0) return { text: '0', cls: '' };
  const u = v / UNIT;
  if (Number.isInteger(u)) return { text: `${fmt(v)}`, cls: 'dg-ok', title: `${u}u` };
  if (Number.isInteger(u * 2)) return { text: `${fmt(v)}`, cls: 'dg-half', title: `${u}u` };
  return { text: `${fmt(v)}`, cls: 'dg-off', title: '8px グリッド外' };
}

function typeStep(fs: number) {
  const n = Math.log(fs / 16) / Math.log(1.25);
  const hit = TYPE_STEPS.find(([, s]) => Math.abs(s - n) < 0.02);
  return { n, hit };
}

function build() {
  root = el('div', 'dg-root');
  root.setAttribute('aria-hidden', 'true');
  el('style', '', root).textContent = css;
  const grid = el('div', 'dg-grid', root);
  el('div', 'dg-col dg-col-l', grid);
  el('div', 'dg-col dg-col-r', grid);
  el('div', 'dg-col-label', grid);
  const fixed = el('div', 'dg-fixed', root);
  el('div', 'dg-margin', fixed);
  el('div', 'dg-padding', fixed);
  el('div', 'dg-content', fixed);
  // 数値カードは凡例より手前に出すため、層の外に置く。
  card = el('div', 'dg-card');
  card.setAttribute('aria-hidden', 'true');
  card.hidden = true;

  legend = el('aside', 'dg-legend');
  legend.setAttribute('aria-label', 'デザイングリッドの凡例');
  legend.innerHTML = `
    <details open>
      <summary><strong>Design grid</strong><span class="dg-hint"><kbd>G</kbd></span></summary>
      <dl>
        <dt>Grid</dt><dd>${UNIT}px。行送りと高さは 8 の倍数</dd>
        <dt>Type</dt><dd>16 × 1.25<sup>n</sup></dd>
      </dl>
      <ol class="dg-ladder">${TYPE_STEPS.map(([name, n]) => `<li data-n="${n}"><span>${name || '·'}</span>${fmt(16 * 1.25 ** n)}</li>`).join('')}</ol>
      <dl><dt>Radius</dt><dd><ol class="dg-radii">${RADII.map((r) => `<li data-r="${r}">${r}</li>`).join('')}</ol></dd></dl>
      <p class="dg-key"><span class="dg-ok">8n</span><span class="dg-half">4n</span><span class="dg-off">外れ</span><span class="dg-box"><i class="dg-sw dg-sw-m"></i>margin <i class="dg-sw dg-sw-p"></i>padding <i class="dg-sw dg-sw-c"></i>content</span></p>
    </details>
    <button type="button" class="dg-close" aria-label="グリッドを閉じる">×</button>`;
  // 狭い画面では本文を隠さないよう、畳んだ状態で出す。
  legend.querySelector('details')!.open = matchMedia('(min-width: 40rem)').matches;
  legend.querySelector('.dg-close')!.addEventListener('click', () => set(false));
  // body は遷移のたびに差し替わるため、html 直下に置いて残す。凡例は読み上げ対象に残すため、aria-hidden の外に置く。
  document.documentElement.append(root, legend, card);
}

/** 本文の列の端と、文書全体の高さを測り直す。 */
function measure() {
  if (!root) return;
  // html の scrollHeight は重ねた層自身を含んで縮まなくなるため、body で測る。
  root.style.height = `${document.body.offsetHeight}px`;
  const main = document.querySelector('main');
  const label = root.querySelector<HTMLElement>('.dg-col-label')!;
  if (!main) return;
  const r = main.getBoundingClientRect();
  const cs = getComputedStyle(main);
  const left = r.left + scrollX + parseFloat(cs.paddingLeft);
  const right = r.right + scrollX - parseFloat(cs.paddingRight);
  root.style.setProperty('--dg-l', `${left}px`);
  root.style.setProperty('--dg-r', `${right}px`);
  const w = right - left;
  label.textContent = `${fmt(w)}px${w % UNIT === 0 ? ` = ${w / UNIT}u` : ''} · 余白 ${fmt(parseFloat(cs.paddingLeft))}`;
}

function inspect(target: Element | null) {
  if (!root) return;
  const fixed = root.querySelector<HTMLElement>('.dg-fixed')!;
  const skip = !target || target === document.documentElement || target === document.body || !!target.closest('.dg-root, .dg-legend, .sea');
  fixed.classList.toggle('dg-active', !skip);
  card!.hidden = skip;
  document.querySelectorAll('.dg-legend [data-hit]').forEach((e) => e.removeAttribute('data-hit'));
  if (skip) return;

  const e = target as HTMLElement;
  const cs = getComputedStyle(e);
  const r = e.getBoundingClientRect();
  const m = ['Top', 'Right', 'Bottom', 'Left'].map((s) => Math.max(0, px(cs[`margin${s}` as 'marginTop'])));
  const p = ['Top', 'Right', 'Bottom', 'Left'].map((s) => px(cs[`padding${s}` as 'paddingTop']));
  const b = ['Top', 'Right', 'Bottom', 'Left'].map((s) => px(cs[`border${s}Width` as 'borderTopWidth']));
  const place = (box: HTMLElement, x: number, y: number, w: number, h: number, widths?: number[]) => {
    Object.assign(box.style, { left: `${x}px`, top: `${y}px`, width: `${Math.max(0, w)}px`, height: `${Math.max(0, h)}px` });
    if (widths) box.style.borderWidth = widths.map((v) => `${v}px`).join(' ');
  };
  const [marginBox, padBox, contentBox] = [...fixed.children] as HTMLElement[];
  place(marginBox, r.left - m[3], r.top - m[0], r.width + m[1] + m[3], r.height + m[0] + m[2], m);
  place(padBox, r.left + b[3], r.top + b[0], r.width - b[1] - b[3], r.height - b[0] - b[2], p);
  place(contentBox, r.left + b[3] + p[3], r.top + b[0] + p[0], r.width - b[1] - b[3] - p[1] - p[3], r.height - b[0] - b[2] - p[0] - p[2]);

  const chip = (v: number) => { const u = units(v); return `<span class="${u.cls}"${u.title ? ` title="${u.title}"` : ''}>${u.text}</span>`; };
  const sides = (vals: number[]) => vals.every((v) => v === vals[0]) ? chip(vals[0]) : vals.map(chip).join(' ');
  const rows: string[] = [];
  const name = e.tagName.toLowerCase() + [...e.classList].filter((c) => !c.startsWith('astro-')).slice(0, 3).map((c) => `.${c}`).join('');
  rows.push(`<div class="dg-name">${name.replace(/</g, '&lt;')}</div>`);
  rows.push(`<div><b>size</b>${chip(Math.round(r.width * 100) / 100)} × ${chip(Math.round(r.height * 100) / 100)}</div>`);
  if ([...e.childNodes].some((c) => c.nodeType === Node.TEXT_NODE && c.textContent!.trim())) {
    const fs = px(cs.fontSize);
    const { n, hit } = typeStep(fs);
    const step = hit ? `${hit[0] ? hit[0] + ' · ' : ''}1.25<sup>${fmt(n)}</sup>` : '<span class="dg-off">スケール外</span>';
    const lh = px(cs.lineHeight);
    rows.push(`<div><b>font</b>${fmt(fs)}px <small>${step}</small></div>`);
    if (!Number.isNaN(lh)) rows.push(`<div><b>line</b>${chip(lh)} <small>×${fmt(lh / fs)}</small></div>`);
    const ls = px(cs.letterSpacing);
    if (ls) rows.push(`<div><b>track</b>${fmt(ls / fs)}em</div>`);
    if (hit) document.querySelector(`.dg-ladder [data-n="${hit[1]}"]`)?.setAttribute('data-hit', '');
  }
  if (p.some(Boolean)) rows.push(`<div><b>pad</b>${sides(p)}</div>`);
  if (m.some(Boolean)) rows.push(`<div><b>margin</b>${sides(m)}</div>`);
  const gap = [px(cs.rowGap), px(cs.columnGap)].filter((v) => v > 0);
  if (gap.length && /flex|grid/.test(cs.display)) rows.push(`<div><b>gap</b>${[...new Set(gap)].map(chip).join(' ')}</div>`);
  const rad = px(cs.borderTopLeftRadius);
  if (rad > 0) {
    const pill = rad >= Math.min(r.width, r.height) / 2;
    rows.push(`<div><b>radius</b>${pill ? '全丸' : RADII.includes(rad) ? `${rad}` : `<span class="dg-off">${fmt(rad)}</span>`}${cs.getPropertyValue('corner-shape').includes('squircle') ? ' <small>squircle</small>' : ''}</div>`);
    if (!pill) document.querySelector(`.dg-radii [data-r="${rad}"]`)?.setAttribute('data-hit', '');
  }
  card!.innerHTML = rows.join('');
  // 要素の下に置き、画面からはみ出すときは上に回す。
  const cw = card!.offsetWidth, ch = card!.offsetHeight;
  let x = Math.min(Math.max(8, r.left), innerWidth - cw - 8);
  let y = r.bottom + m[2] + 8;
  if (y + ch > innerHeight - 8) y = Math.max(8, r.top - m[0] - ch - 8);
  card!.style.transform = `translate(${x}px, ${y}px)`;
}

let lastTarget: Element | null = null;
const onMove = (ev: PointerEvent) => {
  if (ev.pointerType !== 'mouse') return;
  lastTarget = document.elementFromPoint(ev.clientX, ev.clientY);
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => inspect(lastTarget));
};
const onScroll = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => inspect(lastTarget)); };
const onLeave = () => { lastTarget = null; inspect(null); };
const onSwap = () => { observe(); measure(); onLeave(); syncButtons(); };

function observe() {
  sizeObserver?.disconnect();
  sizeObserver = new ResizeObserver(measure);
  sizeObserver.observe(document.body);
}

function syncButtons() {
  document.querySelectorAll('[data-grid-toggle]').forEach((b) => b.setAttribute('aria-pressed', String(on)));
}

function set(next: boolean) {
  on = next;
  try { next ? sessionStorage.setItem(KEY, '1') : sessionStorage.removeItem(KEY); } catch {}
  if (next) {
    if (!root) build();
    root!.hidden = legend!.hidden = false;
    document.documentElement.classList.add('dg-on');
    observe();
    measure();
    addEventListener('pointermove', onMove, { passive: true });
    addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('pointerleave', onLeave);
    addEventListener('resize', measure);
  } else {
    if (root) root.hidden = legend!.hidden = card!.hidden = true;
    document.documentElement.classList.remove('dg-on');
    sizeObserver?.disconnect();
    removeEventListener('pointermove', onMove);
    removeEventListener('scroll', onScroll);
    document.removeEventListener('pointerleave', onLeave);
    removeEventListener('resize', measure);
    lastTarget = null;
  }
  syncButtons();
}

export const toggleDesignGrid = () => set(!on);
export const showDesignGrid = () => set(true);
document.addEventListener('astro:after-swap', () => { if (on) onSwap(); else syncButtons(); });
