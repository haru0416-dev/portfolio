import matter from 'gray-matter';

const OWNER = 'haru0416-dev';
const REPO = 'haru-content';
const BRANCH = 'main';
const ARTICLES_PREFIX = 'articles/';
const FETCH_TIMEOUT_MS = 10_000;

export interface ZennArticleMeta {
  slug: string;
  title: string;
  emoji?: string;
  type?: 'tech' | 'idea';
  topics?: string[];
  publishedAt?: Date;
  href: string;
}

interface TreeNode {
  path: string;
  type: 'blob' | 'tree';
}

async function fetchWithTimeout(url: string, ms: number, init?: RequestInit): Promise<Response> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ms);
  try {
    return await fetch(url, {
      ...init,
      headers: {
        'User-Agent': 'haru-portfolio-build/1.0',
        ...(init?.headers ?? {}),
      },
      signal: ac.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function parsePublishedAt(value: unknown): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  const s = String(value).trim();
  if (!s) return undefined;
  // Zenn 公式書式は "YYYY-MM-DD HH:mm" (JST 想定、TZ 表記なし)。
  // TZ 指定が無い場合は JST として扱う。
  const isoLike = s.replace(' ', 'T');
  const withTz = /[+-]\d{2}:?\d{2}$|Z$/.test(isoLike) ? isoLike : `${isoLike}+09:00`;
  const d = new Date(withTz);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export async function fetchZennArticles(): Promise<ZennArticleMeta[]> {
  try {
    const treeUrl = `https://api.github.com/repos/${OWNER}/${REPO}/git/trees/${BRANCH}?recursive=1`;
    const res = await fetchWithTimeout(treeUrl, FETCH_TIMEOUT_MS, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) throw new Error(`GitHub Trees API responded ${res.status}`);
    const data = (await res.json()) as { tree: TreeNode[] };
    const paths = data.tree
      .filter(
        (n) => n.type === 'blob' && n.path.startsWith(ARTICLES_PREFIX) && n.path.endsWith('.md'),
      )
      .map((n) => n.path);

    const results = await Promise.all(
      paths.map(async (path): Promise<ZennArticleMeta | null> => {
        try {
          const rawUrl = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${path}`;
          const r = await fetchWithTimeout(rawUrl, FETCH_TIMEOUT_MS);
          if (!r.ok) throw new Error(`raw fetch ${r.status} for ${path}`);
          const text = await r.text();
          const fm = matter(text).data as Record<string, unknown>;
          if (fm.published !== true) return null;
          const slug = path.replace(new RegExp(`^${ARTICLES_PREFIX}`), '').replace(/\.md$/, '');
          const typeRaw = fm.type;
          return {
            slug,
            title: String(fm.title ?? slug),
            emoji: fm.emoji ? String(fm.emoji) : undefined,
            type: typeRaw === 'tech' || typeRaw === 'idea' ? typeRaw : undefined,
            topics: Array.isArray(fm.topics) ? fm.topics.map(String) : undefined,
            publishedAt: parsePublishedAt(fm.published_at),
            href: `https://zenn.dev/haru0416/articles/${slug}`,
          };
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.warn(`[zenn] failed to fetch ${path}: ${msg}`);
          return null;
        }
      }),
    );

    return results.filter((m): m is ZennArticleMeta => m !== null);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[zenn] articles fetch failed: ${msg}. Returning empty list.`);
    return [];
  }
}
