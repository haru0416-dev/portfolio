// Astro の Fonts API 内部モジュール。Font コンポーネントが使っているものを、外部 CSS 化のために直接参照する
declare module 'virtual:astro:assets/fonts/internal' {
  export const componentDataByCssVariable: Map<string, { css: string; preloads: Array<{ url: string; type: string }> }>;
}
