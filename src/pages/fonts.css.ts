// 全フォントの @font-face と CSS 変数を 1 つの静的 CSS として出す。
// <Font /> はページごとに同じ @font-face をインラインで埋め込む(日本語は 120 区分あるので 30KB 超)ため、
// 外部ファイルにしてページをまたいでキャッシュさせる。
import { componentDataByCssVariable } from 'virtual:astro:assets/fonts/internal';

export function GET() {
  const css = [...componentDataByCssVariable.values()].map((d) => d.css).join('\n');
  return new Response(css, { headers: { 'Content-Type': 'text/css; charset=utf-8' } });
}
