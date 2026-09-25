// 名刺の寸法と絵柄のデータ。単位はすべて mm。
import { oklchToHex } from '../palette';
import { RAYS } from './sea';

export const CARD = {
  /** 仕上がり寸法。日本の名刺の標準(91 × 55)を縦に使う。 */
  width: 55,
  height: 91,
  /** 裁ち落とし。背景はこの幅だけ仕上がりの外へ伸ばす。 */
  bleed: 3,
  /** 角丸加工の半径。印刷所ごとに選べる値が違うため、入稿前に合わせる。 */
  radius: 4,
  /** 文字や QR を置いてよい、仕上がり線からの距離。断裁のずれと角丸で欠けない幅。 */
  safe: 4,
  /** 紙の厚み。220kg 前後の名刺用紙を想定する。 */
  thickness: 0.35,
} as const;

/** 印刷所に渡す色は sRGB の 16 進にする。OKLCH は入稿先のソフトで読めないことがある。 */
const c = (l: number, ch: number, h: number) => oklchToHex(l, ch, h);
export const INK = {
  seaTop: c(36, 0.075, 250),
  seaMid: c(25, 0.055, 268),
  seaDeep: c(16.5, 0.035, 285),
  ray: c(88, 0.07, 215),
  white: c(96, 0.01, 285),
  silver: c(80, 0.03, 275),
  gray: c(66, 0.035, 280),
  /** サイトの --accent(ライト)と同じ。 */
  accent: c(66, 0.175, 356),
  stickerBase: c(97, 0.008, 285),
  shallowSand: c(96, 0.035, 95),
  shallowAqua: c(89, 0.06, 205),
  deepTeal: c(73, 0.085, 218),
  waterShade: c(45, 0.08, 230),
  filamentWarm: c(99, 0.04, 90),
  filamentCool: c(94, 0.05, 200),
  sunGlow: c(98, 0.06, 85),
  sunHaze: c(97, 0.05, 80),
  /** サイトのライトテーマの --ink と --ink-2。 */
  lightInk: c(32, 0.05, 300),
  lightInk2: c(47, 0.04, 300),
  /** サイトの浅い海の粒と同じ色。 */
  mote: c(40, 0.07, 285),
  qrPanel: c(96, 0.01, 285),
} as const;

/** 光の筋。サイトの背景と同じ並びを、名刺の幅に合わせる。 */
export const CARD_RAYS = RAYS.map((r) => ({ x: (r.x / 100) * CARD.width, w: Math.max((r.w / 100) * CARD.width, 2.4), a: r.a }));

// ビルドのたびに絵柄が変わらないよう、種を固定した乱数を使う。
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** マリンスノー。上ほど多く撒く。 */
export function marineSnow(seed: number, count: number, fromY = -CARD.bleed, toY = CARD.height + CARD.bleed) {
  const rand = mulberry32(seed);
  return Array.from({ length: count }, () => {
    const y = fromY + (toY - fromY) * rand() ** 1.6;
    return { x: -CARD.bleed + rand() * (CARD.width + CARD.bleed * 2), y, r: 0.12 + rand() ** 3 * 0.35, a: 0.18 + rand() * 0.5 };
  });
}

type Point = [number, number];

/** 水面のコースティクス(波が集めた光の網目)の元になるボロノイ分割。各セルを重心へ shrink 倍に縮めた多角形を返す。 */
export function causticCells(seed: number, box: { x: number; y: number; w: number; h: number }, columns: number, shrink: number): Point[][] {
  const rand = mulberry32(seed);
  const cell = box.w / columns;
  const rows = Math.ceil(box.h / cell);
  // 格子の中心を揺らして、並びが格子に見えないようにする。外周にも 1 列足し、端のセルを閉じる。
  const seeds: Point[] = [];
  for (let j = -1; j <= rows; j++) {
    for (let i = -1; i <= columns; i++) {
      seeds.push([box.x + (i + 0.5 + (rand() - 0.5) * 0.8) * cell, box.y + (j + 0.5 + (rand() - 0.5) * 0.8) * cell]);
    }
  }
  const bound: Point[] = [[box.x - cell * 2, box.y - cell * 2], [box.x + box.w + cell * 2, box.y - cell * 2], [box.x + box.w + cell * 2, box.y + box.h + cell * 2], [box.x - cell * 2, box.y + box.h + cell * 2]];
  // 多角形を、p と q の垂直二等分線で分けた p の側で切る。
  const clip = (poly: Point[], p: Point, q: Point): Point[] => {
    const nx = q[0] - p[0], ny = q[1] - p[1];
    const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
    const side = ([x, y]: Point) => (x - mx) * nx + (y - my) * ny;
    const out: Point[] = [];
    poly.forEach((a, i) => {
      const b = poly[(i + 1) % poly.length];
      const sa = side(a), sb = side(b);
      if (sa <= 0) out.push(a);
      if (sa * sb < 0) { const t = sa / (sa - sb); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
    });
    return out;
  };
  return seeds
    .filter(([x, y]) => x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h)
    .map((p) => {
      let poly = bound;
      for (const q of seeds) if (q !== p && Math.hypot(q[0] - p[0], q[1] - p[1]) < cell * 3) poly = clip(poly, p, q);
      const cx = poly.reduce((s, v) => s + v[0], 0) / poly.length, cy = poly.reduce((s, v) => s + v[1], 0) / poly.length;
      return poly.map(([x, y]): Point => [cx + (x - cx) * shrink, cy + (y - cy) * shrink]);
    });
}
