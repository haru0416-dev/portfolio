import rss from '@astrojs/rss';
import { fetchZennEntries, getBlogEntries, sortNewestFirst } from '@lib/writing';
import type { APIRoute } from 'astro';

const LIMIT = 50;

export const GET: APIRoute = async (context) => {
  const [zenn, blog] = await Promise.all([fetchZennEntries(), getBlogEntries()]);
  const entries = sortNewestFirst([...zenn, ...blog]).slice(0, LIMIT);

  return rss({
    title: 'haru — writing',
    description: 'haru — writing, code, and things in between.',
    site: context.site ?? 'https://haru0416.dev',
    items: entries.map((entry) => ({
      title: entry.title,
      link: entry.external ? entry.href : new URL(entry.href, context.site).toString(),
      pubDate: entry.pubDate,
    })),
    customData: '<language>ja</language>',
  });
};
