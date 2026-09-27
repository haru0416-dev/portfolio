// @ts-check
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { defineConfig, fontProviders } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { satteri } from '@astrojs/markdown-satteri';
import { figureFromTitledImage } from './src/data/markdown-figure.ts';
import { CODE_THEME, CODE_TRANSFORMERS } from './src/data/code-theme.ts';
import { lastmodByPath } from './src/data/lastmod.ts';

const lastmod = lastmodByPath();

/**
 * シェーダーのソース(src/shaders の .glsl・.wgsl)を文字列として読み込む。ビルドではコメントと余分な空白を落とす。
 * #version などのプリプロセッサの行は 1 行に独立させる。a - -b や a / *p は詰めると -- や /* になるので空白を残す。
 * @param {string} src
 */
function minifyShader(src) {
  const lines = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '').split('\n').map((l) => l.trim()).filter(Boolean);
  let out = '';
  for (const line of lines) out += line.startsWith('#') ? `${out && !out.endsWith('\n') ? '\n' : ''}${line}\n` : `${line} `;
  return out
    .replace(/[ \t]+/g, ' ')
    .replace(/ ?([{}();,:=<>[\]]) ?/g, '$1')
    .replace(/ ([*/+-]) (?=[\w.(])/g, '$1')
    .replace(/(?<=[\w.)\]]) ([*/+-])/g, '$1')
    .trim();
}

/** @returns {import('vite').Plugin} */
function shaderSource() {
  let build = false;
  return {
    name: 'shader-source',
    enforce: 'pre',
    configResolved(config) { build = config.command === 'build'; },
    async load(id) {
      if (!/\.(glsl|wgsl)$/.test(id)) return;
      const src = await readFile(id, 'utf8');
      return `export default ${JSON.stringify(build ? minifyShader(src) : src)};`;
    },
  };
}

/**
 * public/_headers の CSP_PLACEHOLDER を、出力した HTML に合わせた Content-Security-Policy に置き換える。
 * ページに直接書いたスクリプトは、内容のハッシュで 1 つずつ許す(内容が変わるとハッシュも変わるので、ビルドのたびに作る)。
 * style 属性や、テーマ・ページ遷移のスクリプトが書き換える style を多く使うので、スタイルは直書きを許す。
 * @returns {import('astro').AstroIntegration}
 */
function contentSecurityPolicy() {
  return {
    name: 'content-security-policy',
    hooks: {
      'astro:build:done': async ({ dir }) => {
        const hashes = new Set();
        for (const entry of await readdir(dir, { recursive: true })) {
          if (!entry.endsWith('.html')) continue;
          const html = await readFile(new URL(entry, dir), 'utf8');
          for (const [, attrs, body] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
            if (/\bsrc=|type="application\/(ld\+)?json"/.test(attrs)) continue;
            hashes.add(`'sha256-${createHash('sha256').update(body).digest('base64')}'`);
          }
        }
        const policy = [
          "default-src 'self'",
          // Cloudflare Web Analytics は配信のときに計測用のスクリプトを差し込み、結果を送る。
          `script-src 'self' ${[...hashes].sort().join(' ')} https://static.cloudflareinsights.com`,
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: blob:",
          "connect-src 'self' https://cloudflareinsights.com",
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'self'",
          "frame-ancestors 'none'",
          'upgrade-insecure-requests',
        ].join('; ');
        const file = new URL('_headers', dir);
        const headers = await readFile(file, 'utf8');
        if (!headers.includes('CSP_PLACEHOLDER')) throw new Error('_headers に CSP_PLACEHOLDER がありません。');
        await writeFile(file, headers.replace('CSP_PLACEHOLDER', policy));
      },
    },
  };
}

export default defineConfig({
  site: 'https://haru0416.dev',
  // 静的な出力はディレクトリ形式(/about/index.html)。スラッシュなしの URL は Cloudflare Pages が 308 で転送し、移動のたびに 1 往復増える。
  trailingSlash: 'always',
  vite: {
    plugins: [tailwindcss(), shaderSource()],
    // Tailscale 経由で dev サーバーを見るため
    server: { allowedHosts: ['.ts.net'] },
    build: {
      // lightningcss は animation-timeline を animation ショートハンドに畳み込んで無効化してしまう
      cssMinify: 'esbuild',
      // 小さなスクリプトもページに埋め込まずファイルにする。埋め込んだモジュールがあると、ページ遷移(ClientRouter)が
      // その実行を待つために data: のスクリプトを差し込み、CSP に止められて待たずに進んでしまう。画像や CSS は既定のまま。
      assetsInlineLimit: (file) => (file.endsWith('.js') ? false : undefined),
    },
  },
  integrations: [contentSecurityPolicy(), mdx(), sitemap({
    serialize(item) {
      const date = lastmod.get(new URL(item.url).pathname);
      return date ? { ...item, lastmod: date } : item;
    },
  })],
  markdown: {
    // 色は CSS 変数で両テーマ分を出力し、prose.css で light-dark() により選ぶ。
    shikiConfig: { themes: CODE_THEME, defaultColor: false, transformers: CODE_TRANSFORMERS },
    processor: satteri({
      hastPlugins: [figureFromTitledImage],
      features: {
        // 「↩」は絵文字で表示される環境があるため矢印を使う。
        gfm: { footnotes: { label: '脚注', backLabel: '本文の脚注 {reference} へ戻る', backContent: '↑' } },
        // Astro は既定で有効にするが、日本語の直後の ' を閉じ引用符にし、--> を –> に変えてしまう。
        smartPunctuation: false,
      },
    }),
  },
  fonts: [
    { provider: fontProviders.google(), name: 'Fredoka', cssVariable: '--font-fredoka', weights: [600], styles: ['normal'], subsets: ['latin'], fallbacks: [] },
    { provider: fontProviders.google(), name: 'Nunito', cssVariable: '--font-nunito', weights: [500, 700], styles: ['normal'], subsets: ['latin'], fallbacks: ['Hiragino Sans', 'Yu Gothic UI', 'Meiryo', 'sans-serif'] },
    { provider: fontProviders.google(), name: 'JetBrains Mono', cssVariable: '--font-jetbrains', weights: [400], styles: ['normal'], subsets: ['latin'], fallbacks: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'] },
  ],
});
