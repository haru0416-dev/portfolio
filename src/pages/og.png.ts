// サイト共通の共有用画像。ページ固有の画像が無いページ(トップ・一覧・Lab・404)の OGP で使う
import type { APIRoute } from 'astro';
import { renderSiteImage } from '../og';

export const GET: APIRoute = async () => {
  return new Response(new Uint8Array(await renderSiteImage()), { headers: { 'Content-Type': 'image/png' } });
};
