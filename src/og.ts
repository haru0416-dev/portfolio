// 記事ごとの共有用画像(1200×630 PNG)をビルド時に Takumi で描く。見た目は public/og.svg に合わせている
import { Renderer } from '@takumi-rs/core';
import { fromHtml } from '@takumi-rs/helpers/html';
import { googleFonts, subsetFonts, type FontSubset } from '@takumi-rs/helpers';
import { SITE } from './site';

export const OG_SIZE = { width: 1200, height: 630 } as const;

// public/og.svg と同じ色
const C = { ink: '#352d46', ink2: '#51475f', muted: '#756981', accent: '#cf4e88', line: '#ddd9e7' };

// サイトの Sprout アイコン(lucide)
const sprout = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${C.accent}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9.536V7a4 4 0 0 1 4-4h1.5a.5.5 0 0 1 .5.5V5a4 4 0 0 1-4 4 4 4 0 0 0-4 4c0 2 1 3 1 5a5 5 0 0 1-1 3"/><path d="M4 9a5 5 0 0 1 8 4 5 5 0 0 1-8-4M5 21h14"/></svg>`,
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

async function registerFontsFor(source: Parameters<typeof subsetFonts>[0]['source']) {
  fontList ??= googleFonts([
    { name: 'Zen Maru Gothic', weight: 700 },
    { name: 'Fredoka', weight: 600 },
    { name: 'Nunito', weight: 700 },
  ]);
  const used = subsetFonts({ fonts: await fontList, source });
  await Promise.all(used.map((f) => {
    if (!registered.has(f.key)) {
      registered.set(f.key, f.data().then((data) => renderer.registerFont({
        name: f.name, subsetOf: f.subsetOf, subsetRank: f.subsetRank, weight: f.weight, style: f.style, data,
      })));
    }
    return registered.get(f.key);
  }));
}

export interface PostImage {
  title: string;
  date: Date;
  tags: string[];
}

export async function renderPostImage({ title, date, tags }: PostImage): Promise<Buffer> {
  const day = date.toISOString().slice(0, 10).replaceAll('-', '.');
  // 長い題は字を小さくして 3 行に収める
  const size = title.length > 40 ? 52 : title.length > 24 ? 60 : 68;
  const html = `
<div style="display:flex;width:100%;height:100%;padding:32px;background-color:#f1f3fb;background-image:radial-gradient(ellipse 510px 430px at 1050px 480px, rgba(246,213,230,.7), rgba(246,213,230,0)),linear-gradient(170deg,#e8f2fc,#faf5fb);font-family:Nunito,'Zen Maru Gothic';font-weight:700;color:${C.ink}">
  <div style="display:flex;flex-direction:column;width:100%;height:100%;padding:64px 72px 48px;border:2px solid ${C.line};border-radius:32px">
    <div style="display:flex;font-size:23px;letter-spacing:4px;color:${C.muted}">BLOG · ${day}</div>
    <div style="display:flex;flex-direction:column;justify-content:center;flex-grow:1">
      <div style="font-family:'Zen Maru Gothic';font-size:${size}px;line-height:1.4;word-break:keep-all;text-wrap:balance;line-clamp:3">${esc(phrases(title))}</div>
      ${tags.length ? `<div style="display:flex;flex-wrap:wrap;gap:12px;margin-top:24px;font-size:24px;color:${C.muted}">${tags.map((t) => `<span>#${esc(t)}</span>`).join('')}</div>` : ''}
    </div>
    <div style="display:flex;align-items:center;justify-content:space-between;padding-top:28px;border-top:2px dashed ${C.line}">
      <div style="display:flex;align-items:center;gap:12px;font-family:Fredoka;font-weight:600;font-size:44px">
        <img src="${sprout}" width="44" height="44" />
        <span>${esc(SITE.name)}<span style="color:${C.accent}">.</span></span>
      </div>
      <div style="font-size:28px;color:${C.ink2}">haru0416.dev</div>
    </div>
  </div>
</div>`;
  const { node, css } = fromHtml(html);
  await registerFontsFor(node);
  return renderer.render(node, { ...OG_SIZE, css, lang: 'ja' });
}
