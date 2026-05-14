import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://haru0416.dev',
  output: 'static',
  integrations: [mdx(), sitemap()],
  trailingSlash: 'never',
  build: {
    format: 'directory',
  },
});
