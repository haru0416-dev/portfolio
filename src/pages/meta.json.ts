// curl 向けの応答(functions/_middleware.ts)が読む、サイトの要約。ビルド時に静的に出す
import { getCollection } from 'astro:content';
import { SITE } from '../site';
import { LAB } from '../data/lab';

export async function GET() {
  const posts = (await getCollection('blog', ({ data }) => !data.draft))
    .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf())
    .slice(0, 5)
    .map((p) => ({ title: p.data.title, date: p.data.pubDate.toISOString().slice(0, 10), path: `/blog/${p.id}/` }));
  const works = (await getCollection('works'))
    .sort((a, b) => a.data.order - b.data.order)
    .map((w) => ({ name: w.data.name, status: w.data.status, url: w.data.status === 'soon' ? null : (w.data.url ?? w.data.repo ?? null) }));
  const lab = LAB.map((l) => ({ title: l.title, description: l.description, path: `/lab/${l.slug}/` }));
  return new Response(JSON.stringify({ name: SITE.name, tagline: SITE.description, github: SITE.github, posts, works, lab }), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
