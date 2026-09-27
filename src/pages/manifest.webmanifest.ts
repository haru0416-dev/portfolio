// ホーム画面に追加したときの名前・アイコン・色。アイコンは tools/app-icons.ts で作る。
import { SITE } from '../site';
import { THEME_COLOR } from '../palette';

export function GET() {
  const manifest = {
    name: SITE.title,
    short_name: SITE.name,
    description: SITE.description,
    lang: 'ja',
    start_url: '/',
    scope: '/',
    display: 'browser',
    background_color: THEME_COLOR.light,
    theme_color: THEME_COLOR.light,
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
  };
  return new Response(JSON.stringify(manifest), { headers: { 'Content-Type': 'application/manifest+json' } });
}
