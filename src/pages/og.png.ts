import type { APIRoute } from 'astro';
import { renderSiteImage } from '../og';

export const GET: APIRoute = async () => {
  return new Response(await renderSiteImage(), { headers: { 'Content-Type': 'image/png' } });
};
