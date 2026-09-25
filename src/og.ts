import { Renderer } from '@takumi-rs/core';
import { fromHtml } from '@takumi-rs/helpers/html';
import { googleFonts, subsetFonts, type FontSubset } from '@takumi-rs/helpers';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { SITE } from './site';
import { THEME_COLOR, oklchToHex, oklchToRgb, HUE } from './palette';
import { dotted, formatDate } from './date';
import { RAYS } from './data/sea';

const W = 1200, H = 630;

const U = 24;
const L = {
  // 外枠の余白と角丸はサイトの角丸の段(最大 32px)と 8px グリッドに合わせる。
  margin: 4 * U, card: 32, radius: 32,
  small: U, logo: 1.5 * U, titleSizes: [81, 66, 54, 44], lineHeight: 4 / 3, maxLines: 3,
  gap: { band: 40, tags: U, footer: U, icon: U },
  titleIcon: 0.8, // インクの高さ / 文字サイズ
  // サイトの .eyebrow と .tag(12.8px の文字で高さ 24px)を、24px の文字に合わせて拡大した札。
  chip: { h: 40, px: 16, radius: 12, gap: 16, tracking: 0.12 },
};
// global.css のダークテーマと同じ値から作る。
const C = {
  ink: oklchToHex(94, 0.012, HUE), ink2: oklchToHex(80, 0.022, HUE), muted: oklchToHex(66, 0.03, HUE),
  line: oklchToHex(32, 0.03, HUE), rule: oklchToHex(45, 0.04, HUE), paper2: oklchToHex(25, 0.028, HUE),
  accent: oklchToHex(77, 0.15, 356),
};
// サイトの和文見出しと同じく、かなは詰めた生成フォント、英字は Fredoka、漢字は Zen Maru Gothic で描く。
const DISPLAY_JP = `font-family:'Zen Maru Kana',Fredoka,'Zen Maru Gothic';font-weight:600`;
const chip = (text: string, tracking = 0) =>
  `<span style="display:flex;align-items:center;height:${L.chip.h}px;padding:0 ${L.chip.px}px;border-radius:${L.chip.radius}px;background-color:${C.paper2};border:2px solid ${C.line};letter-spacing:${tracking}em">${text}</span>`;
const PAPER = THEME_COLOR.dark;
const rgba = (l: number, c: number, h: number, a: number) => `rgba(${oklchToRgb(l, c, h).join(',')},${a})`;
// global.css の .sea(ダーク)を 1200×630 の画面として描く。vmax は 12px。
const SEA_H = 225;
const BG = [
  `background-color:${PAPER}`,
  `background-image:linear-gradient(to bottom, ${rgba(45, 0.09, SEA_H, 0)} 25%, ${rgba(45, 0.09, SEA_H, 0.18)})`,
].join(';');
// .sea .ray。揺れの途中(傾き 14°、濃さは a × 0.35〜0.75 の中間)で止めた形。
const RAYS_HTML = RAYS.map(({ x, w, a }) => {
  const ray = rgba(75, 0.1, SEA_H, 0.18);
  return `<div style="position:absolute;left:${(W * x) / 100}px;top:${-0.05 * H}px;width:${Math.max((W * w) / 100, 56)}px;height:${0.8 * H}px;background-image:linear-gradient(to right, transparent, ${ray} 35%, ${ray} 65%, transparent);mask-image:linear-gradient(to bottom, black 10%, transparent);transform-origin:top;transform:skewX(14deg);opacity:${(a * 0.55).toFixed(3)}"></div>`;
}).join('');
// .sea .sun。左上(12%, -6%)を中心に 2 / 5 / 22 / 50vmax で広がる光。
const SUN_R = 600;
const SUN_HTML = `<div style="position:absolute;left:${W * 0.12 - SUN_R}px;top:${-0.06 * H - SUN_R}px;width:${SUN_R * 2}px;height:${SUN_R * 2}px;background-image:radial-gradient(circle, ${rgba(90, 0.04, 220, 0.3)} 0px, ${rgba(90, 0.04, 220, 0.3)} 24px, ${rgba(70, 0.08, 220, 0.12)} 60px, ${rgba(55, 0.07, 225, 0.05)} 264px, transparent 600px)"></div>`;

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
  return SUN_HTML + RAYS_HTML + parts.join('');
}

const SEA = sea();

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
async function inkBox(html: string): Promise<Box | null> {
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
  // フォントが混ざると同じ行でも run の上端がずれるため、縦の中心が run の高さの半分以内なら同じ行とみなす。
  const runs: { cy: number; h: number; left: number; right: number }[] = [];
  const walk = (node: typeof measured) => {
    for (const run of node.runs) if (run.text.trim()) runs.push({ cy: run.y + run.height / 2, h: run.height, left: run.x, right: run.x + run.width });
    node.children.forEach(walk);
  };
  walk(measured);
  const lines: { cy: number; h: number; left: number; right: number }[] = [];
  for (const run of runs.sort((a, b) => a.cy - b.cy)) {
    const line = lines.at(-1);
    if (line && Math.abs(run.cy - line.cy) < Math.min(run.h, line.h) / 2) {
      line.left = Math.min(line.left, run.left);
      line.right = Math.max(line.right, run.right);
    } else lines.push({ ...run });
  }
  return lines.map((l) => l.right - l.left);
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
        return `<div style="${pos}height:0;border-top:2px dotted ${hide(e.key) ? 'transparent' : only ? '#000' : C.rule}"></div>`;
      default: {
        // 子の色指定が残ると、非計測要素を透明にできない。
        const content = only ? (e.content ?? '').replace(/color:#[0-9a-f]{6}/gi, 'color:inherit') : e.content;
        return `<div style="${pos}display:flex;${e.style};color:${hide(e.key) ? 'transparent' : only ? '#000' : e.color}">${content}</div>`;
      }
    }
  }).join('');
  const card = `<div style="position:absolute;left:${L.card}px;top:${L.card}px;width:${W - 2 * L.card}px;height:${H - 2 * L.card}px;border:2px solid ${hide('card') ? 'transparent' : only ? '#000' : C.line};border-radius:${L.radius}px"></div>`;
  return `<div style="display:flex;position:relative;width:${W}px;height:${H}px;${only ? 'background-color:#fff' : BG};font-family:Nunito,'Zen Maru Gothic';font-weight:700">${only ? '' : SEA}${card}${body}</div>`;
}

const probes = new Map<string, Promise<Box>>();
const MAX_PROBES = 64;
function probe(e: El): Promise<Box> {
  const key = JSON.stringify({ ...e, x: 0, y: 0 });
  if (!probes.has(key)) {
    if (probes.size >= MAX_PROBES) probes.delete(probes.keys().next().value!);
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
  /** 題名の末尾にアクセント色で続ける文字。サイトの「haru.」の点に使う。 */
  titleAccent?: string;
  tags: string[];
  icon?: string;
}

export const postEyebrow = (date: Date) => `BLOG · ${dotted(formatDate(date))}`;

export async function lucideIcon(name: string) {
  const path = join(process.cwd(), 'node_modules/lucide-static/icons', `${name}.svg`);
  const svg = await readFile(path, 'utf8').catch((err: NodeJS.ErrnoException) => {
    if (err.code === 'ENOENT') throw new Error(`lucide-static に ${name}.svg がありません。src/data/icon-names.ts の名前とパッケージがずれています。`, { cause: err });
    throw err;
  });
  return `data:image/svg+xml,${encodeURIComponent(svg.replace(/<!--.*?-->/s, '').replaceAll('currentColor', C.accent))}`;
}

type Place = (e: Omit<El, 'x' | 'y'>, at: (o: Box) => [number, number]) => Promise<Box>;

/** 要素のインクの箱を測り、at が返す位置に置く。 */
function placer(els: El[]): Place {
  return async (e, at) => {
    const o = await probe({ ...e, x: 0, y: 0 });
    const [x, y] = at(o);
    els.push({ ...e, x, y });
    return o;
  };
}

const brand = (size: number, extra = '') => ({
  key: 'logo', style: `font-family:Fredoka;font-weight:600;font-size:${size}px;${extra}white-space:nowrap`,
  content: `${esc(SITE.name)}<span style="color:${C.accent}">.</span>`, color: C.ink,
});

/** サイトの .eyebrow と同じく、札の右に点線を伸ばす。札の下端の y を返す。 */
async function placeEyebrow(place: Place, text: string) {
  const M = L.margin, R = W - M;
  const eb = await place(
    { key: 'eyebrow', style: `font-size:${L.small}px;white-space:nowrap`, content: chip(text, L.chip.tracking), color: C.muted },
    (o) => [M - o.left, M - o.top],
  );
  const ebW = eb.right - eb.left, ebH = eb.bottom - eb.top;
  await place({ key: 'eyebrow-rule', kind: 'rule', w: R - M - ebW - U }, (o) => [M + ebW + U - o.left, M + ebH / 2 - (o.top + o.bottom) / 2]);
  return M + ebH;
}

async function layoutCard({ eyebrow, title, titleAccent, tags, icon }: CardImage) {
  const M = L.margin, R = W - M, B = H - M;
  const els: El[] = [];
  const place = placer(els);
  const sprout = await lucideIcon('sprout');

  const eyebrowBottom = await placeEyebrow(place, esc(eyebrow));

  const logoEl = brand(L.logo);
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
  const tagsEl = { key: 'tags', style: `font-size:${L.small}px;gap:${L.chip.gap}px;flex-wrap:wrap`, content: tags.map((t) => chip(`#${esc(t)}`, 0.04)).join(''), color: C.muted, w: fullW };
  const tg = tags.length ? await probe({ ...tagsEl, x: 0, y: 0 }) : null;
  const tagsH = tg ? L.gap.tags + (tg.bottom - tg.top) : 0;

  const content = esc(phrases(title)) + (titleAccent ? `<span style="color:${C.accent}">${esc(titleAccent)}</span>` : '');
  let chosen: { e: El; o: Box } | undefined;
  let iconW = 0;
  for (const size of L.titleSizes) {
    const style = `display:block;${DISPLAY_JP};font-size:${size}px;line-height:${Math.round(size * L.lineHeight)}px;word-break:keep-all`;
    iconW = i0 ? Math.round(size * L.titleIcon * (i0.right - i0.left) / (i0.bottom - i0.top)) + L.gap.icon : 0;
    const tw = fullW - iconW;
    const at = (w: number) => lineWidths(`<div style="width:${w}px;${style}">${content}</div>`);
    let widths = await at(tw);
    const lines = widths.length;
    const lastSize = size === L.titleSizes.at(-1);
    if (lines > L.maxLines && !lastSize) continue;
    let lo = Math.floor(tw / lines), hi = tw;
    while (hi - lo > 4) {
      const w = (lo + hi) >> 1;
      const measured = await at(w);
      if (measured.length > lines) lo = w; else { hi = w; widths = measured; }
    }
    const even = Math.min(...widths) >= Math.max(...widths) / 2;
    if (!even && !lastSize) continue;
    const e: El = { key: 'title', style, content, color: C.ink, w: hi, x: 0, y: 0 };
    chosen = { e, o: await probe(e) };
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

  return page(els);
}

async function layoutSite() {
  const M = L.margin, R = W - M, B = H - M;
  const els: El[] = [];
  const place = placer(els);
  const sprout = await lucideIcon('sprout');
  const eyebrowBottom = await placeEyebrow(place, 'NOTES &amp; EXPERIMENTS');

  const dom = await place({ key: 'domain', style: `font-size:${L.logo}px;white-space:nowrap`, content: 'haru0416.dev', color: C.ink2 }, (o) => [M - o.left, B - o.bottom]);
  await place({ key: 'nav', style: `font-size:${L.small}px;white-space:nowrap`, content: 'About · Blog · Works · Lab', color: C.muted }, (o) => [R - o.right, B - o.bottom]);
  const ruleY = B - (dom.bottom - dom.top) - L.gap.footer - 2;
  await place({ key: 'rule', kind: 'rule', w: R - M }, (o) => [M - o.left, ruleY - o.top]);

  const mid = (eyebrowBottom + ruleY) / 2;
  const markEl = brand(160, 'line-height:1;letter-spacing:-4px;');
  const mark = await probe({ ...markEl, x: 0, y: 0 });
  const leadEl = { key: 'lead', style: `${DISPLAY_JP};font-size:36px;white-space:nowrap`, content: esc(SITE.description), color: C.ink2 };
  const lead = await probe({ ...leadEl, x: 0, y: 0 });
  const markH = mark.bottom - mark.top, leadH = lead.bottom - lead.top;
  const top = mid - (markH + U + leadH) / 2;
  const s0 = await probe({ key: 'sprout', kind: 'img', src: sprout, size: 100, x: 0, y: 0 });
  const sp = await place({ key: 'sprout', kind: 'img', src: sprout, size: Math.round(100 * markH / (s0.bottom - s0.top)) }, (o) => [M - o.left, top - o.top]);
  els.push({ ...markEl, x: M + (sp.right - sp.left) + U - mark.left, y: top - mark.top });
  els.push({ ...leadEl, x: M - lead.left, y: top + markH + U - lead.top });
  return page(els);
}

async function renderPage(html: string): Promise<Buffer<ArrayBuffer>> {
  const { node, css } = await prepare(html);
  return renderer.render(node, { width: W, height: H, css, lang: 'ja' });
}

export async function renderSiteImage() {
  return renderPage(await layoutSite());
}

export async function renderCardImage(card: CardImage) {
  return renderPage(await layoutCard(card));
}
