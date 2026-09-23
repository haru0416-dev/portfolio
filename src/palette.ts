// --paper と theme-color を同じ配色から生成する。
export const HUE = 300;

const PAPER = {
  light: { l: 97.5, c: 0.01 },
  dark: { l: 19, c: 0.02 },
} as const;

/** 0〜255 の [r, g, b]。 */
export function oklchToRgb(Lpct: number, C: number, H: number): [number, number, number] {
  const L = Lpct / 100;
  const h = (H * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;
  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bl = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;
  const gamma = (x: number) => (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055);
  const byte = (x: number) => Math.round(Math.min(1, Math.max(0, gamma(x))) * 255);
  return [byte(r), byte(g), byte(bl)];
}

export function oklchToHex(Lpct: number, C: number, H: number): string {
  return `#${oklchToRgb(Lpct, C, H).map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

export const THEME_COLOR = {
  light: oklchToHex(PAPER.light.l, PAPER.light.c, HUE),
  dark: oklchToHex(PAPER.dark.l, PAPER.dark.c, HUE),
} as const;

/** `<html style>` に渡す。stylesheet の :root より優先される。 */
export const rootColorStyle = `--h:${HUE};--paper:light-dark(oklch(${PAPER.light.l}% ${PAPER.light.c.toFixed(3)} var(--h)),oklch(${PAPER.dark.l}% ${PAPER.dark.c.toFixed(3)} var(--h)))`;
