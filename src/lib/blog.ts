import matter from 'gray-matter';

const OWNER = 'haru0416-dev';
const REPO = 'blog-content';
const BRANCH = 'main';
const FETCH_TIMEOUT_MS = 10_000;

export interface BlogLoaderEntry {
  id: string;
  data: {
    title: string;
    date: string;
    description?: string;
    draft?: boolean;
  };
  body: string;
  filePath: string;
}

interface TreeNode {
  path: string;
  type: 'blob' | 'tree';
  sha: string;
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

export async function fetchBlogContent(): Promise<BlogLoaderEntry[]> {
  try {
    const treeUrl = `https://api.github.com/repos/${OWNER}/${REPO}/git/trees/${BRANCH}?recursive=1`;
    const res = await fetchWithTimeout(treeUrl, FETCH_TIMEOUT_MS, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) {
      throw new Error(`GitHub Trees API responded ${res.status}`);
    }
    const data = (await res.json()) as { tree: TreeNode[] };
    const paths = data.tree
      .filter((n) => n.type === 'blob' && n.path.startsWith('articles/') && n.path.endsWith('.md'))
      .map((n) => n.path);

    const results = await Promise.all(
      paths.map(async (path): Promise<BlogLoaderEntry | null> => {
        try {
          const rawUrl = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${path}`;
          const r = await fetchWithTimeout(rawUrl, FETCH_TIMEOUT_MS);
          if (!r.ok) throw new Error(`raw fetch ${r.status} for ${path}`);
          const text = await r.text();
          const parsed = matter(text);
          const slug = path.replace(/^articles\//, '').replace(/\.md$/, '');
          return {
            id: slug,
            data: parsed.data as BlogLoaderEntry['data'],
            body: parsed.content,
            filePath: path,
          };
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.warn(`[blog] failed to fetch ${path}: ${msg}`);
          return null;
        }
      }),
    );

    return results.filter((e): e is BlogLoaderEntry => e !== null && e.data.draft !== true);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[blog] content fetch failed: ${msg}. Returning empty list.`);
    return [];
  }
}
