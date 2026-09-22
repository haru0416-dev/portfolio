import type { APIRoute, GetStaticPaths } from 'astro';
import type { CollectionEntry } from 'astro:content';
import { getWorks } from '../../../data/collections';
import { lucideIcon, renderCardImage } from '../../../og';

export const getStaticPaths = (async () => {
  const works = await getWorks();
  return works.map((work) => ({ params: { id: work.id }, props: { work } }));
}) satisfies GetStaticPaths;

export const GET: APIRoute<{ work: CollectionEntry<'works'> }> = async ({ props: { work } }) => {
  const png = await renderCardImage({ eyebrow: 'WORKS', title: work.data.name, tags: work.data.stack, icon: await lucideIcon(work.data.icon) });
  return new Response(png, { headers: { 'Content-Type': 'image/png' } });
};
