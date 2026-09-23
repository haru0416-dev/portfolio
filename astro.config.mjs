// @ts-check
import { defineConfig, fontProviders } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { satteri } from '@astrojs/markdown-satteri';
import { figureFromTitledImage } from './src/data/markdown-figure.ts';
import { CODE_THEME, CODE_TRANSFORMERS } from './src/data/code-theme.ts';
import { lastmodByPath } from './src/data/lastmod.ts';

const lastmod = lastmodByPath();

export default defineConfig({
  site: 'https://haru0416.dev',
  vite: {
    plugins: [tailwindcss()],
    // Tailscale 経由で dev サーバーを見るため
    server: { allowedHosts: ['.ts.net'] },
    // lightningcss は animation-timeline を animation ショートハンドに畳み込んで無効化してしまう
    build: { cssMinify: 'esbuild' },
  },
  integrations: [mdx(), sitemap({
    serialize(item) {
      const date = lastmod.get(new URL(item.url).pathname);
      return date ? { ...item, lastmod: date } : item;
    },
  })],
  markdown: {
    // 色は CSS 変数で両テーマ分を出力し、prose.css で light-dark() により選ぶ。
    shikiConfig: { themes: CODE_THEME, defaultColor: false, transformers: CODE_TRANSFORMERS },
    // 「↩」は絵文字で表示される環境があるため矢印を使う。
    processor: satteri({
      hastPlugins: [figureFromTitledImage],
      features: {
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
    { provider: fontProviders.google(), name: 'Zen Maru Gothic', cssVariable: '--font-zen-maru', weights: [700], styles: ['normal'], subsets: ['japanese', 'latin'], fallbacks: ['Hiragino Maru Gothic ProN', 'Hiragino Sans', 'Yu Gothic UI', 'sans-serif'] },
  ],
});
