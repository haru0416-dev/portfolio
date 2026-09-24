// 名刺の寸法と絵柄のデータ。単位はすべて mm。
// 画面の 3D 表示(BusinessCard)が使う。入稿用の紙面(CardArt の frame="print")も同じ値で描ける。
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
  surface: c(44, 0.085, 238),
  ray: c(88, 0.07, 215),
  white: c(96, 0.01, 285),
  silver: c(80, 0.03, 275),
  gray: c(66, 0.035, 280),
  /** サイトの --accent(ライト)と同じ桃色。 */
  accent: c(66, 0.175, 356),
  stickerBase: c(97, 0.008, 285),
  /** 裏はサイトのライトテーマと同じ、日の当たる浅い海。左上は日の当たる砂の暖かい明るさ、右下へ深くなるほど青緑に沈む。 */
  shallowSand: c(96, 0.035, 95),
  shallowAqua: c(89, 0.06, 205),
  deepTeal: c(73, 0.085, 218),
  /** 水の中の陰。どの深さの上でも同じように沈むよう、暗い色を薄く重ねる。 */
  waterShade: c(45, 0.08, 230),
  /** 網の光。白ではなく、その場所の水を明るくした色。浅いところは太陽の暖かさを帯びる。 */
  filamentWarm: c(99, 0.04, 90),
  filamentCool: c(94, 0.05, 200),
  sunGlow: c(98, 0.06, 85),
  sunHaze: c(97, 0.05, 80),
  /** サイトのライトテーマの --ink と --ink-2・--muted。 */
  lightInk: c(32, 0.05, 300),
  lightInk2: c(47, 0.04, 300),
  lightMuted: c(50, 0.035, 300),
  /** 昇っていく粒。サイトの浅い海の粒と同じ薄紫。 */
  mote: c(40, 0.07, 285),
  qrPanel: c(96, 0.01, 285),
} as const;

/** 光の筋。サイトの背景と同じ並びを、名刺の幅に合わせて使う。 */
export const CARD_RAYS = RAYS.map((r) => ({ x: (r.x / 100) * CARD.width, w: Math.max((r.w / 100) * CARD.width, 2.4), a: r.a }));

// 描くたびに位置が変わらないよう、種を固定した乱数で粒子を撒く。
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** マリンスノー。上ほど多く、文字の多い下半分では薄くする。 */
export function marineSnow(seed: number, count: number, fromY = -CARD.bleed, toY = CARD.height + CARD.bleed) {
  const rand = mulberry32(seed);
  return Array.from({ length: count }, () => {
    const y = fromY + (toY - fromY) * rand() ** 1.6;
    return { x: -CARD.bleed + rand() * (CARD.width + CARD.bleed * 2), y, r: 0.12 + rand() ** 3 * 0.35, a: 0.18 + rand() * 0.5 };
  });
}

type Point = [number, number];

/**
 * 水面のコースティクス(波が集めた光の網目)。種をばらした点でボロノイ分割し、各セルを少し縮めて角を丸めて塗る。
 * セルとセルの隙間が明るい網目として残る。網目の太さはセルの大きさで自然にばらつく。
 * 結果はベクターの多角形なので、刷っても画像化されない。
 */
export function causticCells(seed: number, box: { x: number; y: number; w: number; h: number }, columns: number, shrink = 0.8): Point[][] {
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
  // 多角形を、p に近い側の半平面(p と q の垂直二等分線で分けた側)で切る。
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

/** 泡。縁が明るく中が透ける輪を、いくつか浮かべる。 */
export function bubbles(seed: number, count: number, area: { x: number; y: number; w: number; h: number }) {
  const rand = mulberry32(seed);
  return Array.from({ length: count }, () => ({ x: area.x + rand() * area.w, y: area.y + rand() * area.h, r: 0.5 + rand() ** 2 * 1.3 }));
}
