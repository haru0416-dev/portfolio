import { renderOgPng } from '@lib/og';
import type { APIRoute } from 'astro';

export const GET: APIRoute = async () => {
  const png = await renderOgPng({
    title: 'haru',
    subtitle: 'writing, code, and things in between.',
  });
  return new Response(png, { headers: { 'Content-Type': 'image/png' } });
};
