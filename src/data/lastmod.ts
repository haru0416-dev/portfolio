// サイトマップの lastmod。astro.config.mjs から読むため、astro:content は使えず、記事の frontmatter を直接読む。
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { LAB } from './lab';

const BLOG = join(process.cwd(), 'src/content/blog');

function field(frontmatter: string, key: string) {
  return frontmatter.match(new RegExp(`^${key}:\\s*['"]?(\\d{4}-\\d{2}-\\d{2})`, 'm'))?.[1];
}

function posts() {
  return readdirSync(BLOG, { recursive: true, encoding: 'utf8' })
    .filter((f) => /\.mdx?$/.test(f))
    .flatMap((f) => {
      const frontmatter = readFileSync(join(BLOG, f), 'utf8').match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';
      if (/^draft:\s*true/m.test(frontmatter)) return [];
      const date = field(frontmatter, 'updatedDate') ?? field(frontmatter, 'pubDate');
      return date ? [{ id: relative(BLOG, join(BLOG, f)).replace(/\.mdx?$/, ''), date }] : [];
    });
}

const newest = (dates: string[]) => dates.sort().at(-1);

/** パス(/blog/hello/ など)から最終更新日。作品は日付を持たないので載せない。一覧とトップは中身の最新日にする。 */
export function lastmodByPath(): Map<string, string> {
  const map = new Map<string, string>();
  const blog = posts();
  for (const p of blog) map.set(`/blog/${p.id}/`, p.date);
  for (const l of LAB) map.set(`/lab/${l.slug}/`, l.date);
  const blogNewest = newest(blog.map((p) => p.date));
  const labNewest = newest(LAB.map((l) => l.date));
  const all = newest([blogNewest, labNewest].filter((d): d is string => !!d));
  if (blogNewest) map.set('/blog/', blogNewest);
  if (labNewest) map.set('/lab/', labNewest);
  if (all) { map.set('/', all); map.set('/about/', all); }
  return map;
}
