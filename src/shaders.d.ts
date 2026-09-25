// src/shaders のシェーダーは、astro.config.mjs の shaderSource が文字列として読み込む。
declare module '*.glsl' {
  const source: string;
  export default source;
}
declare module '*.wgsl' {
  const source: string;
  export default source;
}
