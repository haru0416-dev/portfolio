import { getCollection } from 'astro:content';
import { fetchZennArticles } from '@lib/zenn';
import { XMLParser } from 'fast-xml-parser';

export type WritingSource = 'zenn' | 'blog';

const ZENN_SLUG_REGEX = /\/articles\/([^/?#]+)/;

export interface WritingEntry {
  title: string;
  href: string;
  pubDate: Date;
  year: string;
  source: WritingSource;
  external: boolean;
}

const ZENN_FEED_URL = 'https://zenn.dev/haru0416/feed';
const FETCH_TIMEOUT_MS = 10_000;

interface ZennRawItem {
  title: string;
  link: string;
  pubDate: string;
  guid?: string | { '#text': string };
}

async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ms);
  try {
    return await fetch(url, {
      headers: { 'User-Agent': 'haru0416-portfolio-build/1.0' },
      signal: ac.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchZennRSS(): Promise<WritingEntry[]> {
  try {
    const res = await fetchWithTimeout(ZENN_FEED_URL, FETCH_TIMEOUT_MS);
    if (!res.ok) throw new Error(`Zenn feed responded ${res.status}`);
    const xml = await res.text();
    const parser = new XMLParser({ ignoreAttributes: true, processEntities: true });
    const parsed = parser.parse(xml);
    const itemsRaw = parsed?.rss?.channel?.item;
    if (!itemsRaw) return [];
    const items: ZennRawItem[] = Array.isArray(itemsRaw) ? itemsRaw : [itemsRaw];

    return items.map((item) => {
      const pubDate = new Date(item.pubDate);
      return {
        title: String(item.title).trim(),
        href: String(item.link),
        pubDate,
        year: String(pubDate.getUTCFullYear()),
        source: 'zenn' as const,
        external: true,
      };
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[writing] zenn RSS fetch failed: ${msg}. Falling back to empty list.`);
    return [];
  }
}

function slugFromZennHref(href: string): string | null {
  const m = ZENN_SLUG_REGEX.exec(href);
  return m ? m[1] : null;
}

/**
 * RSS と zenn-content の articles/ を slug でマージ。
 * RSS は最新 ~10 件しか返さないため、それより古い記事は zenn-content から拾う。
 * 両方にある記事は RSS の pubDate を採用（live で確実な値）。
 */
export async function fetchZennEntries(): Promise<WritingEntry[]> {
  const [rss, github] = await Promise.all([fetchZennRSS(), fetchZennArticles()]);

  const seen = new Set<string>();
  const out: WritingEntry[] = [];

  for (const entry of rss) {
    const slug = slugFromZennHref(entry.href);
    if (slug) seen.add(slug);
    out.push(entry);
  }

  for (const meta of github) {
    if (seen.has(meta.slug)) continue;
    if (!meta.publishedAt) continue;
    out.push({
      title: meta.title,
      href: meta.href,
      pubDate: meta.publishedAt,
      year: String(meta.publishedAt.getUTCFullYear()),
      source: 'zenn',
      external: true,
    });
  }

  return out;
}

export async function getBlogEntries(): Promise<WritingEntry[]> {
  const blog = await getCollection('blog');
  return blog
    .filter((entry) => !entry.data.draft)
    .map((entry) => ({
      title: entry.data.title,
      href: `/blog/${entry.id}`,
      pubDate: entry.data.date,
      year: String(entry.data.date.getUTCFullYear()),
      source: 'blog' as const,
      external: false,
    }));
}

export function sortNewestFirst(entries: WritingEntry[]): WritingEntry[] {
  return [...entries].sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());
}

export function groupByYear(entries: WritingEntry[]): Array<[string, WritingEntry[]]> {
  const map = new Map<string, WritingEntry[]>();
  for (const e of entries) {
    const arr = map.get(e.year) ?? [];
    arr.push(e);
    map.set(e.year, arr);
  }
  return Array.from(map.entries()).sort(([a], [b]) => Number(b) - Number(a));
}

export function formatDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${y}.${m}.${dd}`;
}
