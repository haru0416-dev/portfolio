import { getCollection } from 'astro:content';
import { renderOgPng } from '@lib/og';
import { formatDate } from '@lib/writing';
import type { APIRoute } from 'astro';

interface Props {
  title: string;
  date: string;
}

export async function getStaticPaths() {
  const blog = await getCollection('blog');
  return blog
    .filter((entry) => !entry.data.draft)
    .map((entry) => ({
      params: { slug: entry.id },
      props: { title: entry.data.title, date: formatDate(entry.data.date) } satisfies Props,
    }));
}

export const GET: APIRoute<Props> = async ({ props }) => {
  const png = await renderOgPng({ title: props.title, date: props.date });
  return new Response(png, { headers: { 'Content-Type': 'image/png' } });
};
