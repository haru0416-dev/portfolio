// 記事のコードブロックの配色。サイトの色相から作り、どの色も背景に対して 4.5:1 以上にする。
import { HUE, oklchToHex } from '../palette';

type Role = 'fg' | 'muted' | 'comment' | 'keyword' | 'string' | 'number' | 'func' | 'type' | 'punct';
type Tone = Record<Role, string>;

const c = (l: number, ch: number, h: number) => oklchToHex(l, ch, h);

// 背景は prose.css の --code-bg と同じ値にする。
export const CODE_BG = { light: c(94.5, 0.022, HUE), dark: c(22, 0.028, HUE) };

const TONES: { light: Tone; dark: Tone } = {
  light: {
    fg: c(32, 0.05, HUE), muted: c(42, 0.04, HUE), comment: c(50, 0.03, HUE), punct: c(44, 0.04, HUE),
    keyword: c(50, 0.17, 356), string: c(47, 0.09, 175), number: c(50, 0.12, 50), func: c(47, 0.13, 275), type: c(47, 0.1, 230),
  },
  dark: {
    fg: c(92, 0.015, HUE), muted: c(82, 0.02, HUE), comment: c(68, 0.03, HUE), punct: c(76, 0.03, HUE),
    keyword: c(78, 0.13, 356), string: c(82, 0.1, 175), number: c(82, 0.1, 60), func: c(80, 0.1, 280), type: c(80, 0.09, 225),
  },
};

const SCOPES: [Role, string[]][] = [
  ['comment', ['comment', 'punctuation.definition.comment', 'string.comment']],
  ['keyword', ['keyword', 'storage', 'storage.type', 'storage.modifier', 'keyword.control', 'keyword.operator.new', 'keyword.operator.expression', 'entity.name.tag', 'keyword.other.attribute']],
  ['string', ['string', 'string.quoted', 'string.template', 'string.regexp', 'punctuation.definition.string', 'markup.inline.raw']],
  ['number', ['constant.numeric', 'constant.language', 'constant.character', 'constant.other', 'support.constant', 'variable.language']],
  ['func', ['entity.name.function', 'support.function', 'meta.function-call entity.name.function', 'entity.other.attribute-name', 'meta.attribute']],
  ['type', ['entity.name.type', 'entity.name.class', 'support.type', 'support.class', 'storage.type.primitive', 'entity.other.inherited-class', 'entity.name.namespace']],
  ['punct', ['punctuation', 'keyword.operator', 'meta.brace', 'punctuation.separator', 'punctuation.terminator']],
  ['fg', ['variable', 'variable.parameter', 'variable.other', 'support.variable', 'meta.definition.variable', 'source']],
  ['muted', ['markup.quote', 'markup.list']],
];

function theme(name: string, type: 'light' | 'dark') {
  const t = TONES[type];
  return {
    name,
    type,
    colors: { 'editor.background': CODE_BG[type], 'editor.foreground': t.fg },
    tokenColors: [
      ...SCOPES.map(([role, scope]) => ({ scope, settings: { foreground: t[role] } })),
      { scope: ['markup.heading', 'markup.bold'], settings: { foreground: t.keyword, fontStyle: 'bold' } },
      { scope: ['markup.italic'], settings: { fontStyle: 'italic' } },
      { scope: ['markup.inserted'], settings: { foreground: t.string } },
      { scope: ['markup.deleted'], settings: { foreground: t.keyword } },
    ],
  };
}

export const CODE_THEME = { light: theme('haru-light', 'light'), dark: theme('haru-dark', 'dark') };

// pre を figure.code-block で包み、言語名とコピーボタンの置き場所を作る。
export const CODE_TRANSFORMERS = [
  {
    name: 'code-block',
    root(this: { options: { lang: string } }, root: { children: unknown[] }) {
      root.children = [{ type: 'element', tagName: 'figure', properties: { className: ['code-block'], dataLang: this.options.lang }, children: root.children }];
    },
  },
];
