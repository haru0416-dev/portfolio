// 記事・作品ごとの共有用画像(1200×630 PNG)をビルド時に Takumi で描く。色はサイトのダークテーマ(深海)に合わせている
//
// 配置は「整っている」を次の規則で定義し、それを満たすように計算する。
// 各要素を一度単独で描いてインク(実際に塗られる画素)の外接矩形を測り、インクが目標の線に来るよう箱をずらす。
// - 単位 u = 24px。キャンバス端からインクまでの余白は四辺とも 4u、枠線はキャンバス端から 1.5u
// - 左寄せの要素(小見出し・題名・タグ・ロゴ)はインクの左端を一本の線に揃える。右端(ドメイン・区切り線・円)も同様
// - フッターの文字はベースラインを下余白の線に揃える
// - 文字サイズは 24 から比 1.5 で伸ばす(24・36・54・81)。題名はその中間(×√1.5)も候補にし、収まる最大のものを選ぶ。行送りは 4/3
// - 題名とタグの塊は、小見出しと区切り線の間の空きの上下が等しくなる位置に置く
// - アイコンは小さく名前の横に置く。作品のアイコンは題名の 1 行目の左(インクの高さ = 文字サイズ × 0.8)、
//   サイトの芽はフッターの「haru.」の左(インクの高さ = 字の高さ)。どちらも縦はインクの中心で揃える
// - 題名の各行の長さを揃える(行数が変わらない範囲で幅を最小にする)。それでも最短の行が最長の行の半分に満たなければ、字を小さくする
import { Renderer } from '@takumi-rs/core';
import { fromHtml } from '@takumi-rs/helpers/html';
import { googleFonts, subsetFonts, type FontSubset } from '@takumi-rs/helpers';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { SITE } from './site';

const W = 1200, H = 630;
export const OG_SIZE = { width: W, height: H } as const;

const U = 24;
const L = {
  margin: 4 * U, card: 1.5 * U, radius: 1.5 * U,
  small: U, logo: 1.5 * U, titleSizes: [81, 66, 54, 44], lineHeight: 4 / 3, maxLines: 3,
  gap: { band: 2 * U, tags: 1.5 * U, footer: U, icon: U },
  titleIcon: 0.8, // 題名の横のアイコンのインクの高さ(文字サイズ比)
};
// global.css のダークの値を sRGB にしたもの(paper / ink / ink-2 / muted / line / accent)
const C = { ink: '#ece9f2', ink2: '#c0bbca', muted: '#958ea2', accent: '#fe89b7', line: '#352f40' };
// 深海の背景: 地の色に、下へ行くほど濃くなる青(--sea-depth)と、左上からの淡い光の帯
const BG = 'background-color:#15121c;background-image:linear-gradient(to bottom, rgba(0,94,125,0) 25%, rgba(0,94,125,.18)),linear-gradient(104deg, rgba(101,186,225,0) 30%, rgba(101,186,225,.06) 36%, rgba(101,186,225,0) 42%)';

// サイトの Sprout アイコン(lucide)。記事ごとのアイコンが無いときに円の中に置く
const sprout = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${C.accent}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9.536V7a4 4 0 0 1 4-4h1.5a.5.5 0 0 1 .5.5V5a4 4 0 0 1-4 4 4 4 0 0 0-4 4c0 2 1 3 1 5a5 5 0 0 1-1 3"/><path d="M4 9a5 5 0 0 1 8 4 5 5 0 0 1-8-4M5 21h14"/></svg>`,
)}`;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// Takumi は word-break: auto-phrase に未対応なので、文節の切れ目だけに改行位置(ゼロ幅スペース)を入れ、
// それ以外は keep-all で改行させない。ひらがな・記号で始まる語は前の語にくっつける(助詞や送り仮名を行頭に残さない)。
// 漢字どうしも複合語として切らない
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

// 1 回のビルドで使い回す。フォントは Google Fonts の分割ファイルから、描く文字を含むものだけ取り込む
const renderer = new Renderer();
let fontList: Promise<FontSubset[]> | undefined;
const registered = new Map<string, Promise<unknown>>();

// かなと約物を詰めた見出し用の書体(サイトと同じ。scripts/zen-maru-kana.py で生成)
let kana: Promise<unknown> | undefined;

async function prepare(html: string) {
  const { node, css } = fromHtml(html);
  // ビルド後のコードは dist/ の下で動くので、import.meta.url ではなくプロジェクトのルート(作業ディレクトリ)から読む
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

/** 白地に描いて、白でない画素の外接矩形を返す(薄いアンチエイリアスの縁は除く) */
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

/** レイアウトだけ計算して、各行の幅を返す */
async function lineWidths(html: string) {
  const { node, css } = await prepare(`<div style="display:flex;width:${W}px;height:${H}px">${html}</div>`);
  const m = await renderer.measure(node, { width: W, height: H, css });
  const lines = new Map<number, [number, number]>();
  const walk = (n: typeof m) => {
    for (const r of n.runs) {
      if (!r.text.trim()) continue;
      const y = Math.round(r.y), [l, rt] = lines.get(y) ?? [Infinity, -Infinity];
      lines.set(y, [Math.min(l, r.x), Math.max(rt, r.x + r.width)]);
    }
    n.children.forEach(walk);
  };
  walk(m);
  return [...lines.values()].map(([l, r]) => r - l);
}

type El = {
  key: string; x: number; y: number; w?: number;
  kind?: 'text' | 'img' | 'rule';
  style?: string; content?: string; color?: string; src?: string; size?: number;
};

/** 要素を並べた HTML。only を指定するとその要素だけを描く(ほかは透明、背景は白。計測用) */
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
        // 計測時は子要素の色指定も外し、測る要素だけを黒で描く
        const content = only ? (e.content ?? '').replace(/color:#[0-9a-f]{6}/gi, 'color:inherit') : e.content;
        return `<div style="${pos}display:flex;${e.style};color:${hide(e.key) ? 'transparent' : only ? '#000' : e.color}">${content}</div>`;
      }
    }
  }).join('');
  const card = `<div style="position:absolute;left:${L.card}px;top:${L.card}px;width:${W - 2 * L.card}px;height:${H - 2 * L.card}px;border:2px solid ${hide('card') ? 'transparent' : only ? '#000' : C.line};border-radius:${L.radius}px"></div>`;
  return `<div style="display:flex;position:relative;width:${W}px;height:${H}px;${only ? 'background-color:#fff' : BG};font-family:Nunito,'Zen Maru Gothic';font-weight:700">${card}${body}</div>`;
}

// 箱の原点からインクまでのずれ。題名以外は記事が変わっても同じなので覚えておく
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
  /** 左上の小さな見出し(例: BLOG · 2026.09.17、WORKS) */
  eyebrow: string;
  title: string;
  tags: string[];
  /** 題名の左に置く小さな画像(URL か data URI)。作品のアイコン用。記事は無し */
  icon?: string;
}

/** 記事の小見出し。BLOG · 2026.09.17 */
export const postEyebrow = (date: Date) => `BLOG · ${date.toISOString().slice(0, 10).replaceAll('-', '.')}`;

/** lucide のアイコン名から、差し色で描いた SVG の data URI を作る(作品のアイコン用) */
export async function lucideIcon(name: string) {
  const svg = await readFile(join(process.cwd(), 'node_modules/lucide-static/icons', `${name}.svg`), 'utf8');
  return `data:image/svg+xml,${encodeURIComponent(svg.replace(/<!--.*?-->/s, '').replaceAll('currentColor', C.accent))}`;
}

/** 規則から各要素の位置を解く。返す html(only) は計測にも使う */
export async function layoutCard({ eyebrow, title, tags, icon }: CardImage) {
  const M = L.margin, R = W - M, B = H - M;
  const els: El[] = [];
  const place = async (e: Omit<El, 'x' | 'y'>, at: (o: Box) => [number, number]) => {
    const o = await probe({ ...e, x: 0, y: 0 });
    const [x, y] = at(o);
    els.push({ ...e, x, y });
    return o;
  };

  // 上: 小見出しのインクの左上を余白の角に
  const eb = await place(
    { key: 'eyebrow', style: `font-size:${L.small}px;letter-spacing:${L.small / 6}px;white-space:nowrap`, content: esc(eyebrow), color: C.muted },
    (o) => [M - o.left, M - o.top],
  );
  const eyebrowBottom = M + (eb.bottom - eb.top);

  // 下: ロゴとドメインのベースライン(インクの下端)を下余白の線に
  const logoEl = { key: 'logo', style: `font-family:Fredoka;font-weight:600;font-size:${L.logo}px;white-space:nowrap`, content: `${esc(SITE.name)}<span style="color:${C.accent}">.</span>`, color: C.ink };
  const logo = await probe({ ...logoEl, x: 0, y: 0 });
  // 芽: インクの高さを「haru」の字の高さに合わせ、ベースラインを揃えて左に置く
  const s0 = await probe({ key: 'sprout', kind: 'img', src: sprout, size: 100, x: 0, y: 0 });
  const sp = await place({ key: 'sprout', kind: 'img', src: sprout, size: Math.round(100 * (logo.bottom - logo.top) / (s0.bottom - s0.top)) }, (o) => [M - o.left, B - o.bottom]);
  els.push({ ...logoEl, x: M + (sp.right - sp.left) + L.gap.icon - logo.left, y: B - logo.bottom });
  await place({ key: 'domain', style: `font-size:${L.small}px;white-space:nowrap`, content: 'haru0416.dev', color: C.ink2 }, (o) => [R - o.right, B - o.bottom]);
  // 区切り線: 線の下端からフッターの字の上端までを 1u(2 は線の太さ)
  const ruleY = B - (logo.bottom - logo.top) - L.gap.footer - 2;
  await place({ key: 'rule', kind: 'rule', w: R - M }, (o) => [M - o.left, ruleY - o.top]);

  // 中段: 小見出しの下端〜区切り線の上端の空き。題名+タグの塊の中心をこの空きの中央に
  const mid = (eyebrowBottom + ruleY) / 2;
  const fullW = R - M;
  const i0 = icon ? await probe({ key: 'icon', kind: 'img', src: icon, size: 100, x: 0, y: 0 }) : null;
  const cw = fullW; // タグの幅
  const bandH = ruleY - eyebrowBottom - 2 * L.gap.band;
  const tagsEl = { key: 'tags', style: `font-size:${L.small}px;gap:${L.small / 2}px;flex-wrap:wrap`, content: tags.map((t) => `<span>#${esc(t)}</span>`).join(''), color: C.muted, w: cw };
  const tg = tags.length ? await probe({ ...tagsEl, x: 0, y: 0 }) : null;
  const tagsH = tg ? L.gap.tags + (tg.bottom - tg.top) : 0;

  // 題名: 3 行以内で空きに収まる最大の文字サイズを選び、行の長さを揃える
  const content = esc(phrases(title));
  let chosen: { e: El; o: Box } | undefined;
  let iconW = 0;
  for (const size of L.titleSizes) {
    const style = `display:block;font-family:'Zen Maru Kana','Zen Maru Gothic';font-size:${size}px;line-height:${Math.round(size * L.lineHeight)}px;word-break:keep-all`;
    // 題名の幅は、左に置くアイコン(インクの高さ = 文字サイズ × 0.8)のぶん狭くなる
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

  // 作品のアイコン: 題名の 1 行目の左。インクの中心を 1 行目の行の中心に揃える
  if (icon && i0) {
    const size = parseInt(te.style!.match(/font-size:(\d+)/)![1]);
    const lh = Math.round(size * L.lineHeight);
    const cy = top - to.top + lh / 2;
    await place({ key: 'icon', kind: 'img', src: icon, size: Math.round(100 * size * L.titleIcon / (i0.bottom - i0.top)) }, (o) => [M - o.left, cy - (o.top + o.bottom) / 2]);
  }

  return { html: (only?: string) => page(els, only) };
}

export async function renderCardImage(card: CardImage): Promise<Buffer> {
  const { html } = await layoutCard(card);
  const { node, css } = await prepare(html());
  return renderer.render(node, { ...OG_SIZE, css, lang: 'ja' });
}
