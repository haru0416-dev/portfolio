// 今の実効テーマ。color-scheme の算出値は「light dark」のまま返ることがあるので、
// クラス指定があればそれを、無ければ OS の設定を見る
const mq = matchMedia('(prefers-color-scheme: dark)');
export function isDark(): boolean {
  const c = document.documentElement.classList;
  if (c.contains('dark')) return true;
  if (c.contains('light')) return false;
  return mq.matches;
}
/** テーマが変わる可能性のある事象(クラスの変更、OS の設定変更)で fn を呼ぶ。解除関数を返す */
export function onThemeChange(fn: () => void): () => void {
  const mo = new MutationObserver(fn);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  mq.addEventListener('change', fn);
  return () => { mo.disconnect(); mq.removeEventListener('change', fn); };
}
