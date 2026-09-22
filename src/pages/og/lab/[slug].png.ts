import type { APIRoute, GetStaticPaths } from 'astro';
import { LAB, type LabEntry } from '../../../data/lab';
import { renderCardImage } from '../../../og';

export const getStaticPaths = (() => {
  return LAB.map((entry) => ({ params: { slug: entry.slug }, props: { entry } }));
}) satisfies GetStaticPaths;

export const GET: APIRoute<{ entry: LabEntry }> = async ({ props: { entry } }) => {
  const png = await renderCardImage({
    eyebrow: `LAB · ${entry.date.replaceAll('-', '.')}`,
    title: entry.title,
    tags: [],
  });
  return new Response(png, { headers: { 'Content-Type': 'image/png' } });
};
