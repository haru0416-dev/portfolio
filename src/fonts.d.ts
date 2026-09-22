// fonts.css の生成に使う Astro 内部 API。Astro 更新時は互換性を確認する。
declare module 'virtual:astro:assets/fonts/internal' {
  export const componentDataByCssVariable: Map<string, { css: string; preloads: Array<{ url: string; type: string }> }>;
}
