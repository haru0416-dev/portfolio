import type { APIRoute, GetStaticPaths } from 'astro';
import { LAB, type LabEntry } from '../../../data/lab';
import { renderCardImage } from '../../../og';
import { dotted } from '../../../date';

export const getStaticPaths = (() => {
  return LAB.map((entry) => ({ params: { slug: entry.slug }, props: { entry } }));
}) satisfies GetStaticPaths;

export const GET: APIRoute<{ entry: LabEntry }> = async ({ props: { entry } }) => {
  const png = await renderCardImage({
    eyebrow: `LAB · ${dotted(entry.date)}`,
    title: entry.title,
    tags: [],
  });
  return new Response(png, { headers: { 'Content-Type': 'image/png' } });
};
