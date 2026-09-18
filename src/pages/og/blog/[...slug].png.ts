import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection, type CollectionEntry } from 'astro:content';
import { postEyebrow, renderCardImage } from '../../../og';

export const getStaticPaths = (async () => {
  const posts = await getCollection('blog', ({ data }) => !data.draft);
  return posts.map((post) => ({ params: { slug: post.id }, props: { post } }));
}) satisfies GetStaticPaths;

export const GET: APIRoute<{ post: CollectionEntry<'blog'> }> = async ({ props: { post } }) => {
  const png = await renderCardImage({ eyebrow: postEyebrow(post.data.pubDate), title: post.data.title, tags: post.data.tags });
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};
