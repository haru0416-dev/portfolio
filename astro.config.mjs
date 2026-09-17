// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  // TODO: Cloudflare のドメインに差し替える(sitemap / RSS / OGP の絶対URLに使う)
  site: 'https://example.com',
  vite: {
    plugins: [tailwindcss()],
    // Tailscale 経由で dev サーバーを見るため
    server: { allowedHosts: ['.ts.net'] },
  },
  integrations: [mdx(), sitemap()],
});
