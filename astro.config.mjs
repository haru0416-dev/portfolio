// @ts-check
import { defineConfig, fontProviders } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  // sitemap / RSS / OGP の絶対URLに使う公開ドメイン
  site: 'https://haru0416.dev',
  vite: {
    plugins: [tailwindcss()],
    // Tailscale 経由で dev サーバーを見るため
    server: { allowedHosts: ['.ts.net'] },
    // lightningcss は animation-timeline を animation ショートハンドに畳み込んで無効化してしまう
    build: { cssMinify: 'esbuild' },
  },
  integrations: [mdx(), sitemap()],
  // フォントはビルド時に取り込んで自前配信する(外部ドメインへの接続をなくし、preload できるようにする)
  fonts: [
    { provider: fontProviders.google(), name: 'Fredoka', cssVariable: '--font-fredoka', weights: [600], styles: ['normal'], subsets: ['latin'], fallbacks: ['Zen Maru Gothic', 'Hiragino Maru Gothic ProN', 'sans-serif'] },
    { provider: fontProviders.google(), name: 'Nunito', cssVariable: '--font-nunito', weights: [500, 700], styles: ['normal'], subsets: ['latin'], fallbacks: ['Hiragino Sans', 'Yu Gothic UI', 'Meiryo', 'sans-serif'] },
    // 日本語の丸ゴシックは見出し用の 700 だけ。本文は OS の日本語フォントに任せる
    { provider: fontProviders.google(), name: 'Zen Maru Gothic', cssVariable: '--font-zen-maru', weights: [700], styles: ['normal'], subsets: ['japanese', 'latin'], fallbacks: ['Hiragino Maru Gothic ProN', 'Hiragino Sans', 'Yu Gothic UI', 'sans-serif'] },
  ],
});
