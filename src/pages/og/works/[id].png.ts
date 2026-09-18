import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection, type CollectionEntry } from 'astro:content';
import { lucideIcon, renderCardImage } from '../../../og';

export const getStaticPaths = (async () => {
  const works = await getCollection('works');
  return works.map((work) => ({ params: { id: work.id }, props: { work } }));
}) satisfies GetStaticPaths;

export const GET: APIRoute<{ work: CollectionEntry<'works'> }> = async ({ props: { work } }) => {
  const png = await renderCardImage({ eyebrow: 'WORKS', title: work.data.name, tags: work.data.stack, icon: await lucideIcon(work.data.icon) });
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};
