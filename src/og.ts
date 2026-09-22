import { Renderer } from '@takumi-rs/core';
import { fromHtml } from '@takumi-rs/helpers/html';
import { googleFonts, subsetFonts, type FontSubset } from '@takumi-rs/helpers';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { SITE } from './site';
import { THEME_COLOR } from './palette';
import { formatDate } from './date';

const W = 1200, H = 630;
export const OG_SIZE = { width: W, height: H } as const;

const U = 24;
const L = {
  margin: 4 * U, card: 1.5 * U, radius: 1.5 * U,
  small: U, logo: 1.5 * U, titleSizes: [81, 66, 54, 44], lineHeight: 4 / 3, maxLines: 3,
  gap: { band: 2 * U, tags: 1.5 * U, footer: U, icon: U },
  titleIcon: 0.8, // インクの高さ / 文字サイズ
};
const C = { ink: '#ece9f2', ink2: '#c0bbca', muted: '#958ea2', accent: '#fe89b7', line: '#352f40' };
const PAPER = THEME_COLOR.dark;
const BG = [
  `background-color:${PAPER}`,
  'background-image:' + [
    'linear-gradient(to bottom, rgba(0,94,125,0) 25%, rgba(0,94,125,.18))',
    `linear-gradient(to bottom, rgba(21,18,28,0), ${PAPER} 65%)`,
    'repeating-linear-gradient(104deg, transparent 0 16%, rgba(101,186,225,.16) 20%, transparent 24% 40%)',
  ].join(','),
].join(';');

// ビルドごとに絵が変わらないよう、乱数列を固定する。
function rng(seed: number) {
  return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function sea() {
  const r = rng(20260917);
  const parts: string[] = [];
  for (let i = 0; i < 90; i++) {
    const depth = r(), x = r() * W, y = r() * H, rad = (0.6 + depth * 1.6) * 1.6, a = 0.12 + depth * 0.45;
    parts.push(`<div style="position:absolute;left:${(x - rad).toFixed(1)}px;top:${(y - rad).toFixed(1)}px;width:${(rad * 2).toFixed(1)}px;height:${(rad * 2).toFixed(1)}px;border-radius:50%;background-color:rgba(220,230,255,${a.toFixed(2)})"></div>`);
    if (depth > 0.6) { const h = rad * 2.4; parts.push(`<div style="position:absolute;left:${(x - h).toFixed(1)}px;top:${(y - h).toFixed(1)}px;width:${(h * 2).toFixed(1)}px;height:${(h * 2).toFixed(1)}px;border-radius:50%;background-color:rgba(220,230,255,${(a * 0.18).toFixed(3)})"></div>`); }
  }
  const vx = W * 0.82;
  for (let i = 0; i < 7; i++) {
    const rad = 3 + r() * r() * 9, y = H - 40 - i * 62 - r() * 30, x = vx + Math.sin(i * 1.7) * 14, life = Math.min(1, (y - H * 0.08) / (H * 0.25)), a = 0.55 * life;
    parts.push(`<div style="position:absolute;left:${(x - rad).toFixed(1)}px;top:${(y - rad).toFixed(1)}px;width:${(rad * 2).toFixed(1)}px;height:${(rad * 2).toFixed(1)}px;border-radius:50%;border:${Math.max(0.8, rad * 0.12).toFixed(1)}px solid rgba(200,220,255,${(a * 0.7).toFixed(2)})"></div>`);
    const hr = Math.max(0.8, rad * 0.22);
    parts.push(`<div style="position:absolute;left:${(x - rad * 0.35 - hr).toFixed(1)}px;top:${(y - rad * 0.35 - hr).toFixed(1)}px;width:${(hr * 2).toFixed(1)}px;height:${(hr * 2).toFixed(1)}px;border-radius:50%;background-color:rgba(255,255,255,${a.toFixed(2)})"></div>`);
  }
  return parts.join('');
}

const sprout = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${C.accent}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9.536V7a4 4 0 0 1 4-4h1.5a.5.5 0 0 1 .5.5V5a4 4 0 0 1-4 4 4 4 0 0 0-4 4c0 2 1 3 1 5a5 5 0 0 1-1 3"/><path d="M4 9a5 5 0 0 1 8 4 5 5 0 0 1-8-4M5 21h14"/></svg>`,
)}`;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// Takumi は auto-phrase 未対応のため、改行可能な文節間にゼロ幅スペースを入れる。
const segmenter = new Intl.Segmenter('ja', { granularity: 'word' });
const attached = /^[\p{Script=Hiragana}ー々、。，．・：；！？」』）】\]\)\s]/u;
function phrases(text: string): string {
  let out = '';
  for (const { segment, index } of segmenter.segment(text)) {
    const compound = /\p{Script=Han}$/u.test(out) && /^\p{Script=Han}/u.test(segment);
    if (index > 0 && !attached.test(segment) && !compound && !/\s$/.test(out)) out += '\u200b';
    out += segment;
  }
  return out;
}

const renderer = new Renderer();
let fontList: Promise<FontSubset[]> | undefined;
const registered = new Map<string, Promise<unknown>>();

let kana: Promise<unknown> | undefined;

async function prepare(html: string) {
  const { node, css } = fromHtml(html);
  // ビルド後は dist/ で動くため、import.meta.url ではなく作業ディレクトリを基準にする。
  kana ??= readFile(join(process.cwd(), 'public/fonts/zen-maru-kana-700.woff2'))
    .then((data) => renderer.registerFont({ name: 'Zen Maru Kana', weight: 700, data }));
  await kana;
  fontList ??= googleFonts([
    { name: 'Zen Maru Gothic', weight: 700 },
    { name: 'Fredoka', weight: 600 },
    { name: 'Nunito', weight: 700 },
  ]);
  await Promise.all(subsetFonts({ fonts: await fontList, source: node }).map((f) => {
    if (!registered.has(f.key)) {
      registered.set(f.key, f.data().then((data) => renderer.registerFont({
        name: f.name, subsetOf: f.subsetOf, subsetRank: f.subsetRank, weight: f.weight, style: f.style, data,
      })));
    }
    return registered.get(f.key);
  }));
  return { node, css };
}

type Box = { left: number; top: number; right: number; bottom: number };

/** 白背景が前提。薄いアンチエイリアスの縁は計測から除く。 */
export async function inkBox(html: string): Promise<Box | null> {
  const { node, css } = await prepare(html);
  const px = await renderer.render(node, { width: W, height: H, css, lang: 'ja', format: 'raw' });
  let l = W, t = H, r = -1, b = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (765 - px[i] - px[i + 1] - px[i + 2] > 190) {
        if (x < l) l = x;
        if (x > r) r = x;
        if (y < t) t = y;
        if (y > b) b = y;
      }
    }
  }
  return r < 0 ? null : { left: l, top: t, right: r + 1, bottom: b + 1 };
}

async function lineWidths(html: string) {
  const { node, css } = await prepare(`<div style="display:flex;width:${W}px;height:${H}px">${html}</div>`);
  const measured = await renderer.measure(node, { width: W, height: H, css });
  const lines = new Map<number, [number, number]>();
  const walk = (node: typeof measured) => {
    for (const run of node.runs) {
      if (!run.text.trim()) continue;
      const y = Math.round(run.y), [left, right] = lines.get(y) ?? [Infinity, -Infinity];
      lines.set(y, [Math.min(left, run.x), Math.max(right, run.x + run.width)]);
    }
    node.children.forEach(walk);
  };
  walk(measured);
  return [...lines.values()].map(([left, right]) => right - left);
}

type El = {
  key: string; x: number; y: number; w?: number;
  kind?: 'text' | 'img' | 'rule';
  style?: string; content?: string; color?: string; src?: string; size?: number;
};

function page(els: El[], only?: string) {
  const hide = (key: string) => only !== undefined && only !== key;
  const body = els.map((e) => {
    const pos = `position:absolute;left:${e.x}px;top:${e.y}px;${e.w ? `width:${e.w}px;` : ''}`;
    switch (e.kind) {
      case 'img':
        return `<img src="${e.src}" width="${e.size}" height="${e.size}" style="${pos}${hide(e.key) ? 'opacity:0' : ''}" />`;
      case 'rule':
        return `<div style="${pos}height:0;border-top:2px dashed ${hide(e.key) ? 'transparent' : only ? '#000' : C.line}"></div>`;
      default: {
        // 子の色指定が残ると、非計測要素を透明にできない。
        const content = only ? (e.content ?? '').replace(/color:#[0-9a-f]{6}/gi, 'color:inherit') : e.content;
        return `<div style="${pos}display:flex;${e.style};color:${hide(e.key) ? 'transparent' : only ? '#000' : e.color}">${content}</div>`;
      }
    }
  }).join('');
  const card = `<div style="position:absolute;left:${L.card}px;top:${L.card}px;width:${W - 2 * L.card}px;height:${H - 2 * L.card}px;border:2px solid ${hide('card') ? 'transparent' : only ? '#000' : C.line};border-radius:${L.radius}px"></div>`;
  return `<div style="display:flex;position:relative;width:${W}px;height:${H}px;${only ? 'background-color:#fff' : BG};font-family:Nunito,'Zen Maru Gothic';font-weight:700">${only ? '' : sea()}${card}${body}</div>`;
}

const probes = new Map<string, Promise<Box>>();
function probe(e: El): Promise<Box> {
  const key = JSON.stringify({ ...e, x: 0, y: 0 });
  if (!probes.has(key)) {
    probes.set(key, inkBox(page([{ ...e, x: 100, y: 100 }], e.key)).then((b) => {
      if (!b) throw new Error(`OG image: "${e.key}" has no ink`);
      return { left: b.left - 100, top: b.top - 100, right: b.right - 100, bottom: b.bottom - 100 };
    }));
  }
  return probes.get(key)!;
}

export interface CardImage {
  eyebrow: string;
  title: string;
  tags: string[];
  icon?: string;
}

export const postEyebrow = (date: Date) => `BLOG · ${formatDate(date).replaceAll('-', '.')}`;

export async function lucideIcon(name: string) {
  const path = join(process.cwd(), 'node_modules/lucide-static/icons', `${name}.svg`);
  const svg = await readFile(path, 'utf8').catch((err: NodeJS.ErrnoException) => {
    if (err.code === 'ENOENT') throw new Error(`lucide-static に ${name}.svg がありません。src/data/icon-names.ts の名前とパッケージがずれています。`, { cause: err });
    throw err;
  });
  return `data:image/svg+xml,${encodeURIComponent(svg.replace(/<!--.*?-->/s, '').replaceAll('currentColor', C.accent))}`;
}

export async function layoutCard({ eyebrow, title, tags, icon }: CardImage) {
  const M = L.margin, R = W - M, B = H - M;
  const els: El[] = [];
  const place = async (e: Omit<El, 'x' | 'y'>, at: (o: Box) => [number, number]) => {
    const o = await probe({ ...e, x: 0, y: 0 });
    const [x, y] = at(o);
    els.push({ ...e, x, y });
    return o;
  };

  const eb = await place(
    { key: 'eyebrow', style: `font-size:${L.small}px;letter-spacing:${L.small / 6}px;white-space:nowrap`, content: esc(eyebrow), color: C.muted },
    (o) => [M - o.left, M - o.top],
  );
  const eyebrowBottom = M + (eb.bottom - eb.top);

  const logoEl = { key: 'logo', style: `font-family:Fredoka;font-weight:600;font-size:${L.logo}px;white-space:nowrap`, content: `${esc(SITE.name)}<span style="color:${C.accent}">.</span>`, color: C.ink };
  const logo = await probe({ ...logoEl, x: 0, y: 0 });
  const s0 = await probe({ key: 'sprout', kind: 'img', src: sprout, size: 100, x: 0, y: 0 });
  const sp = await place({ key: 'sprout', kind: 'img', src: sprout, size: Math.round(100 * (logo.bottom - logo.top) / (s0.bottom - s0.top)) }, (o) => [M - o.left, B - o.bottom]);
  els.push({ ...logoEl, x: M + (sp.right - sp.left) + L.gap.icon - logo.left, y: B - logo.bottom });
  await place({ key: 'domain', style: `font-size:${L.small}px;white-space:nowrap`, content: 'haru0416.dev', color: C.ink2 }, (o) => [R - o.right, B - o.bottom]);
  const ruleY = B - (logo.bottom - logo.top) - L.gap.footer - 2;
  await place({ key: 'rule', kind: 'rule', w: R - M }, (o) => [M - o.left, ruleY - o.top]);

  const mid = (eyebrowBottom + ruleY) / 2;
  const fullW = R - M;
  const i0 = icon ? await probe({ key: 'icon', kind: 'img', src: icon, size: 100, x: 0, y: 0 }) : null;
  const bandH = ruleY - eyebrowBottom - 2 * L.gap.band;
  const tagsEl = { key: 'tags', style: `font-size:${L.small}px;gap:${L.small / 2}px;flex-wrap:wrap`, content: tags.map((t) => `<span>#${esc(t)}</span>`).join(''), color: C.muted, w: fullW };
  const tg = tags.length ? await probe({ ...tagsEl, x: 0, y: 0 }) : null;
  const tagsH = tg ? L.gap.tags + (tg.bottom - tg.top) : 0;

  const content = esc(phrases(title));
  let chosen: { e: El; o: Box } | undefined;
  let iconW = 0;
  for (const size of L.titleSizes) {
    const style = `display:block;font-family:'Zen Maru Kana','Zen Maru Gothic';font-size:${size}px;line-height:${Math.round(size * L.lineHeight)}px;word-break:keep-all`;
    iconW = i0 ? Math.round(size * L.titleIcon * (i0.right - i0.left) / (i0.bottom - i0.top)) + L.gap.icon : 0;
    const tw = fullW - iconW;
    const at = (w: number) => lineWidths(`<div style="width:${w}px;${style}">${content}</div>`);
    const lines = (await at(tw)).length;
    let lo = Math.floor(tw / lines), hi = tw;
    while (hi - lo > 4) {
      const w = (lo + hi) >> 1;
      if ((await at(w)).length > lines) lo = w; else hi = w;
    }
    const widths = await at(hi);
    const e: El = { key: 'title', style, content, color: C.ink, w: hi, x: 0, y: 0 };
    chosen = { e, o: await probe(e) };
    const even = Math.min(...widths) >= Math.max(...widths) / 2;
    if (lines <= L.maxLines && even && chosen.o.bottom - chosen.o.top + tagsH <= bandH) break;
  }
  const { e: te, o: to } = chosen!;
  const top = mid - (to.bottom - to.top + tagsH) / 2;
  els.push({ ...te, x: M + iconW - to.left, y: top - to.top });
  if (tg) els.push({ ...tagsEl, x: M - tg.left, y: top + (to.bottom - to.top) + L.gap.tags - tg.top });

  if (icon && i0) {
    const size = parseInt(te.style!.match(/font-size:(\d+)/)![1]);
    const lh = Math.round(size * L.lineHeight);
    const cy = top - to.top + lh / 2;
    await place({ key: 'icon', kind: 'img', src: icon, size: Math.round(100 * size * L.titleIcon / (i0.bottom - i0.top)) }, (o) => [M - o.left, cy - (o.top + o.bottom) / 2]);
  }

  return { html: (only?: string) => page(els, only) };
}

export async function layoutSite() {
  const M = L.margin, R = W - M, B = H - M;
  const els: El[] = [];
  const place = async (e: Omit<El, 'x' | 'y'>, at: (o: Box) => [number, number]) => {
    const o = await probe({ ...e, x: 0, y: 0 });
    const [x, y] = at(o);
    els.push({ ...e, x, y });
    return o;
  };
  const eb = await place(
    { key: 'eyebrow', style: `font-size:${L.small}px;letter-spacing:${L.small / 6}px;white-space:nowrap`, content: 'NOTES &amp; EXPERIMENTS', color: C.muted },
    (o) => [M - o.left, M - o.top],
  );
  const eyebrowBottom = M + (eb.bottom - eb.top);

  const dom = await place({ key: 'domain', style: `font-size:${L.logo}px;white-space:nowrap`, content: 'haru0416.dev', color: C.ink2 }, (o) => [M - o.left, B - o.bottom]);
  await place({ key: 'nav', style: `font-size:${L.small}px;white-space:nowrap`, content: 'Blog · Works · Lab', color: C.muted }, (o) => [R - o.right, B - o.bottom]);
  const ruleY = B - (dom.bottom - dom.top) - L.gap.footer - 2;
  await place({ key: 'rule', kind: 'rule', w: R - M }, (o) => [M - o.left, ruleY - o.top]);

  const mid = (eyebrowBottom + ruleY) / 2;
  const markEl = { key: 'logo', style: `font-family:Fredoka;font-weight:600;font-size:160px;line-height:1;letter-spacing:-4px;white-space:nowrap`, content: `${esc(SITE.name)}<span style="color:${C.accent}">.</span>`, color: C.ink };
  const mark = await probe({ ...markEl, x: 0, y: 0 });
  const leadEl = { key: 'lead', style: `font-size:36px;white-space:nowrap`, content: 'Rust / TypeScript', color: C.ink2 };
  const lead = await probe({ ...leadEl, x: 0, y: 0 });
  const markH = mark.bottom - mark.top, leadH = lead.bottom - lead.top;
  const top = mid - (markH + U + leadH) / 2;
  const s0 = await probe({ key: 'sprout', kind: 'img', src: sprout, size: 100, x: 0, y: 0 });
  const sp = await place({ key: 'sprout', kind: 'img', src: sprout, size: Math.round(100 * markH / (s0.bottom - s0.top)) }, (o) => [M - o.left, top - o.top]);
  els.push({ ...markEl, x: M + (sp.right - sp.left) + U - mark.left, y: top - mark.top });
  els.push({ ...leadEl, x: M - lead.left, y: top + markH + U - lead.top });
  return { html: (only?: string) => page(els, only) };
}

export async function renderSiteImage(): Promise<Buffer> {
  const { html } = await layoutSite();
  const { node, css } = await prepare(html());
  return renderer.render(node, { ...OG_SIZE, css, lang: 'ja' });
}

export async function renderCardImage(card: CardImage): Promise<Buffer> {
  const { html } = await layoutCard(card);
  const { node, css } = await prepare(html());
  return renderer.render(node, { ...OG_SIZE, css, lang: 'ja' });
}
