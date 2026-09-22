// functions/_middleware.ts の CLI 向け応答が読む。
import { getPublishedPosts, getWorks } from '../data/collections';
import { SITE } from '../site';
import { LAB } from '../data/lab';
import { formatDate } from '../date';

export async function GET() {
  const posts = (await getPublishedPosts())
    .slice(0, 5)
    .map((p) => ({ title: p.data.title, date: formatDate(p.data.pubDate), path: `/blog/${p.id}/` }));
  const works = (await getWorks())
    .map((w) => ({ name: w.data.name, status: w.data.status, url: w.data.status === 'soon' ? null : (w.data.url ?? w.data.repo ?? null) }));
  const lab = LAB.map((l) => ({ title: l.title, description: l.description, path: `/lab/${l.slug}/` }));
  return new Response(JSON.stringify({ name: SITE.name, tagline: SITE.description, github: SITE.github, posts, works, lab }), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
