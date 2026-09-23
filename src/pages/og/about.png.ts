import type { APIRoute } from 'astro';
import { renderCardImage } from '../../og';
import { SITE } from '../../site';

export const GET: APIRoute = async () => {
  const png = await renderCardImage({ eyebrow: 'ABOUT', title: `Hi, I'm ${SITE.name}`, titleAccent: '.', tags: [] });
  return new Response(png, { headers: { 'Content-Type': 'image/png' } });
};
