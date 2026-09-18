// color-scheme の算出値は「light dark」の場合があるため、クラス指定を優先し、なければ OS 設定を見る。
const darkScheme = matchMedia('(prefers-color-scheme: dark)');
export function isDark(): boolean {
  const classes = document.documentElement.classList;
  if (classes.contains('dark')) return true;
  if (classes.contains('light')) return false;
  return darkScheme.matches;
}
/** 実効テーマが同じでも fn は呼ばれる。 */
export function onThemeChange(fn: () => void): () => void {
  const observer = new MutationObserver(fn);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  darkScheme.addEventListener('change', fn);
  return () => { observer.disconnect(); darkScheme.removeEventListener('change', fn); };
}
