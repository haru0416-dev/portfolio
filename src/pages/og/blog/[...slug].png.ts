// 記事ごとの共有用画像。ビルド時に /og/blog/<slug>.png として書き出す
import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection, type CollectionEntry } from 'astro:content';
import { renderPostImage } from '../../../og';

export const getStaticPaths = (async () => {
  const posts = await getCollection('blog', ({ data }) => !data.draft);
  return posts.map((post) => ({ params: { slug: post.id }, props: { post } }));
}) satisfies GetStaticPaths;

export const GET: APIRoute<{ post: CollectionEntry<'blog'> }> = async ({ props: { post } }) => {
  const png = await renderPostImage({ title: post.data.title, date: post.data.pubDate, tags: post.data.tags });
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};
