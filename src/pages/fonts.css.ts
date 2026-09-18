// ページごとの @font-face 埋め込みを避け、ページ間でキャッシュする。
import { componentDataByCssVariable } from 'virtual:astro:assets/fonts/internal';

export function GET() {
  const css = [...componentDataByCssVariable.values()].map((d) => d.css).join('\n');
  return new Response(css, { headers: { 'Content-Type': 'text/css; charset=utf-8' } });
}
