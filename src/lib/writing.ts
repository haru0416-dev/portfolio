import { XMLParser } from 'fast-xml-parser';

export type WritingSource = 'zenn' | 'notes';

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

export async function fetchZennEntries(): Promise<WritingEntry[]> {
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
    console.warn(`[writing] zenn fetch failed: ${msg}. Falling back to empty list.`);
    return [];
  }
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
