// QR コードの符号化。名刺に載せる短い URL だけを扱うため、JIS X 0510 のうち次の範囲に絞る。
// - バイトモード(UTF-8)のみ
// - 型番 1〜6。7 以上で要る型番情報の領域は持たない
// 手順と変数名は Project Nayuki の QR Code generator(MIT)を参考にしている。

export type Ecc = 'L' | 'M' | 'Q' | 'H';

/** 形式情報に書く誤り訂正レベルの 2 ビット。 */
const ECC_BITS: Record<Ecc, number> = { L: 1, M: 0, Q: 3, H: 2 };

/** 型番ごとの [1 ブロックの誤り訂正語数, [ブロック数, 1 ブロックのデータ語数][]]。短いブロックが先に並ぶ。 */
const BLOCKS: Record<Ecc, [number, [number, number][]][]> = {
  L: [[7, [[1, 19]]], [10, [[1, 34]]], [15, [[1, 55]]], [20, [[1, 80]]], [26, [[1, 108]]], [18, [[2, 68]]]],
  M: [[10, [[1, 16]]], [16, [[1, 28]]], [26, [[1, 44]]], [18, [[2, 32]]], [24, [[2, 43]]], [16, [[4, 27]]]],
  Q: [[13, [[1, 13]]], [22, [[1, 22]]], [18, [[2, 17]]], [26, [[2, 24]]], [18, [[2, 15], [2, 16]]], [24, [[4, 19]]]],
  H: [[17, [[1, 9]]], [28, [[1, 16]]], [22, [[2, 13]]], [16, [[4, 9]]], [22, [[2, 11], [2, 12]]], [28, [[4, 15]]]],
};
const MAX_VERSION = 6;

const MASKS: ((x: number, y: number) => boolean)[] = [
  (x, y) => (x + y) % 2 === 0,
  (_, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

// --- リード・ソロモン符号。GF(2^8) の原始多項式は x^8 + x^4 + x^3 + x^2 + 1(0x11D)。

function gfMul(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}

/** (x - α^0)(x - α^1)…(x - α^(degree-1)) の係数。最高次の 1 は省く。 */
function rsDivisor(degree: number): number[] {
  const result = new Array<number>(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      result[j] = gfMul(result[j], root);
      if (j + 1 < degree) result[j] ^= result[j + 1];
    }
    root = gfMul(root, 0x02);
  }
  return result;
}

function rsRemainder(data: number[], divisor: number[]): number[] {
  const result = divisor.map(() => 0);
  for (const b of data) {
    const factor = b ^ result.shift()!;
    result.push(0);
    divisor.forEach((coef, i) => { result[i] ^= gfMul(coef, factor); });
  }
  return result;
}

// --- 符号語の組み立て

function dataCapacity(version: number, ecc: Ecc): number {
  return BLOCKS[ecc][version - 1][1].reduce((sum, [n, k]) => sum + n * k, 0);
}

function buildCodewords(bytes: Uint8Array, version: number, ecc: Ecc): number[] {
  const capacity = dataCapacity(version, ecc);
  const bits: number[] = [];
  const push = (value: number, length: number) => { for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1); };
  push(0b0100, 4); // バイトモード
  push(bytes.length, 8); // 型番 1〜9 の文字数指示子は 8 ビット
  bytes.forEach((b) => push(b, 8));
  push(0, Math.min(4, capacity * 8 - bits.length)); // 終端パターン
  push(0, (8 - (bits.length % 8)) % 8);
  const words: number[] = [];
  for (let i = 0; i < bits.length; i += 8) words.push(bits.slice(i, i + 8).reduce((acc, b) => (acc << 1) | b, 0));
  for (let pad = 0xec; words.length < capacity; pad ^= 0xec ^ 0x11) words.push(pad);

  // ブロックに分けて誤り訂正語を付け、ブロックをまたいで 1 語ずつ交互に並べる。
  const [ecLength, groups] = BLOCKS[ecc][version - 1];
  const divisor = rsDivisor(ecLength);
  const blocks: { data: number[]; ec: number[] }[] = [];
  let offset = 0;
  for (const [count, length] of groups) {
    for (let i = 0; i < count; i++) {
      const data = words.slice(offset, offset + length);
      offset += length;
      blocks.push({ data, ec: rsRemainder(data, divisor) });
    }
  }
  const out: number[] = [];
  const longest = Math.max(...blocks.map((b) => b.data.length));
  for (let i = 0; i < longest; i++) blocks.forEach((b) => { if (i < b.data.length) out.push(b.data[i]); });
  for (let i = 0; i < ecLength; i++) blocks.forEach((b) => out.push(b.ec[i]));
  return out;
}

// --- 模様の配置

class Grid {
  readonly modules: boolean[][];
  /** 位置検出・タイミング・形式情報など、データを置かない場所。 */
  readonly reserved: boolean[][];
  constructor(readonly size: number) {
    this.modules = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
    this.reserved = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  }
  fixed(x: number, y: number, dark: boolean) {
    this.modules[y][x] = dark;
    this.reserved[y][x] = true;
  }
}

function drawFunctionPatterns(g: Grid, version: number) {
  const { size } = g;
  for (let i = 0; i < size; i++) {
    g.fixed(6, i, i % 2 === 0);
    g.fixed(i, 6, i % 2 === 0);
  }
  // 位置検出パターンと分離帯。中心からの距離が 2 と 4 の輪だけ明るい。
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx, y = cy + dy;
        if (x < 0 || x >= size || y < 0 || y >= size) continue;
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        g.fixed(x, y, d !== 2 && d !== 4);
      }
    }
  }
  // 型番 2〜6 の位置合わせパターンは右下の 1 つだけ。ほかの候補は位置検出パターンと重なる。
  if (version >= 2) {
    const c = size - 7;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) g.fixed(c + dx, c + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  }
  drawFormatBits(g, 'L', 0); // 場所を予約するための仮の値。マスクを決めたあと書き直す。
}

function drawFormatBits(g: Grid, ecc: Ecc, mask: number) {
  const data = (ECC_BITS[ecc] << 3) | mask;
  // BCH(15, 5) 符号。生成多項式は 0x537。
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const bits = ((data << 10) | rem) ^ 0x5412;
  const bit = (i: number) => ((bits >>> i) & 1) !== 0;
  const { size } = g;
  // 左上の角を囲む 1 組目。
  for (let i = 0; i <= 5; i++) g.fixed(8, i, bit(i));
  g.fixed(8, 7, bit(6));
  g.fixed(8, 8, bit(7));
  g.fixed(7, 8, bit(8));
  for (let i = 9; i < 15; i++) g.fixed(14 - i, 8, bit(i));
  // 右上と左下に分かれた 2 組目。
  for (let i = 0; i < 8; i++) g.fixed(size - 1 - i, 8, bit(i));
  for (let i = 8; i < 15; i++) g.fixed(8, size - 15 + i, bit(i));
  g.fixed(8, size - 8, true); // 常に暗いモジュール
}

/** 右下から 2 列ずつ、上下に折り返しながら置く。6 列目はタイミングパターンなので飛ばす。 */
function drawCodewords(g: Grid, codewords: number[]) {
  const { size } = g;
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    const upward = ((right + 1) & 2) === 0;
    for (let vert = 0; vert < size; vert++) {
      const y = upward ? size - 1 - vert : vert;
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        if (g.reserved[y][x]) continue;
        // 語が足りない分(剰余ビット)は明るいまま残す。
        if (i < codewords.length * 8) g.modules[y][x] = ((codewords[i >>> 3] >>> (7 - (i & 7))) & 1) !== 0;
        i++;
      }
    }
  }
}

function applyMask(g: Grid, mask: number) {
  const test = MASKS[mask];
  for (let y = 0; y < g.size; y++) {
    for (let x = 0; x < g.size; x++) if (!g.reserved[y][x] && test(x, y)) g.modules[y][x] = !g.modules[y][x];
  }
}

// --- マスクの評価。点数が低いほど読み取りやすい。

/** 1 行(または 1 列)の、同じ色の連続(N1)と 1:1:3:1:1 の並び(N3)の点。行の外は明るい余白と見なす。 */
function linePenalty(line: boolean[]): number {
  // 同じ色の連続(ラン)に分ける。
  const runs: { dark: boolean; length: number }[] = [];
  for (const dark of line) {
    const last = runs.at(-1);
    if (last?.dark === dark) last.length++;
    else runs.push({ dark, length: 1 });
  }
  let score = 0;
  for (const { length } of runs) if (length >= 5) score += 3 + (length - 5);

  // 位置検出パターンに似た 暗明暗暗暗明暗 が 1:1:3:1:1 の比率で並び、片側に 4 倍以上、反対側に 1 倍以上の明るいランがあるもの。
  // 比率で見るため、2:2:6:2:2 のように拡大した並びも数える。行の外は明るい余白が続いていると見なす。
  const border = line.length;
  const lightBefore = (j: number) => (j === 0 ? border : runs[j - 1].length + (j - 1 === 0 ? border : 0));
  const lightAfter = (j: number) => (j + 5 === runs.length ? border : runs[j + 5].length + (j + 5 === runs.length - 1 ? border : 0));
  for (let j = 0; j + 5 <= runs.length; j++) {
    if (!runs[j].dark) continue;
    const n = runs[j].length;
    if (![n, n * 3, n, n].every((len, k) => runs[j + 1 + k].length === len)) continue;
    const before = lightBefore(j), after = lightAfter(j);
    if (before >= n * 4 && after >= n) score += 40;
    if (after >= n * 4 && before >= n) score += 40;
  }
  return score;
}

function penalty(g: Grid): number {
  const { size, modules: m } = g;
  let score = 0;
  for (let i = 0; i < size; i++) {
    score += linePenalty(m[i]);
    score += linePenalty(m.map((row) => row[i]));
  }
  for (let y = 0; y < size - 1; y++) {
    for (let x = 0; x < size - 1; x++) {
      const c = m[y][x];
      if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) score += 3; // N2
    }
  }
  // N4: 暗いモジュールの割合が 50% から 5% 離れるごとに 10 点。
  const dark = m.flat().filter(Boolean).length;
  const total = size * size;
  score += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
  return score;
}

// --- 入口

export type QrMatrix = { version: number; size: number; mask: number; modules: boolean[][] };

/** text を QR コードにする。mask を省くと、8 通りを試して点数が最も低いものを選ぶ。 */
export function encodeQr(text: string, ecc: Ecc = 'M', mask?: number): QrMatrix {
  const bytes = new TextEncoder().encode(text);
  let version = 1;
  // 4 ビットのモード指示子と 8 ビットの文字数指示子のぶん、2 語ぶんを差し引いて比べる。
  while (version <= MAX_VERSION && dataCapacity(version, ecc) < bytes.length + 2) version++;
  if (version > MAX_VERSION) throw new Error(`QR コードに入りきりません(${bytes.length} バイト、誤り訂正 ${ecc})。型番 ${MAX_VERSION} までしか扱いません。`);

  const size = version * 4 + 17;
  const codewords = buildCodewords(bytes, version, ecc);
  const render = (m: number) => {
    const g = new Grid(size);
    drawFunctionPatterns(g, version);
    drawCodewords(g, codewords);
    applyMask(g, m);
    drawFormatBits(g, ecc, m);
    return g;
  };
  let best = mask ?? 0;
  if (mask === undefined) {
    let bestScore = Infinity;
    for (let m = 0; m < MASKS.length; m++) {
      const score = penalty(render(m));
      if (score < bestScore) { best = m; bestScore = score; }
    }
  }
  return { version, size, mask: best, modules: render(best).modules };
}
