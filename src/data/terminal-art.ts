// curl でトップを開いたときに出すイラスト(functions/_middleware.ts)。1 文字を縦横 2 つずつに割る文字(▘▝▖▗▚▞▙▟ など)で、
// 24 ビットの色で描く。上下 2 分割の ▀ だけで描くより横が 2 倍細かくなり、目や線がつぶれにくい。1 文字に使える色は前景と背景の 2 色。
import sharp from 'sharp';
import { join } from 'node:path';

const COLUMNS = 32;
/** 左上・右上・左下・右下をそれぞれ 1・2・4・8 として、前景で塗る部分の組み合わせに対応する文字。 */
const QUADRANTS = ' ▘▝▀▖▌▞▛▗▚▐▜▄▙▟█';

type Rgb = [number, number, number];

const mean = (ps: Rgb[]): Rgb => [0, 1, 2].map((k) => Math.round(ps.reduce((a, p) => a + p[k], 0) / ps.length)) as Rgb;
const error = (ps: Rgb[], m: Rgb) => ps.reduce((a, p) => a + (p[0] - m[0]) ** 2 + (p[1] - m[1]) ** 2 + (p[2] - m[2]) ** 2, 0);
const fg = (c: Rgb) => `38;2;${c.join(';')}`;
const bg = (c: Rgb) => `48;2;${c.join(';')}`;

export async function terminalArt(): Promise<string[]> {
  // ビルドはリポジトリの直下で走る。import.meta.url はビルド後の置き場所を指すので使わない。
  const file = join(process.cwd(), 'src/assets/avatar/haru.png');
  const { width, height } = await sharp(file).metadata();
  // 1 文字は縦長(横 1 : 縦 2)で、それを縦横 2 つに割った 1 画素は横 0.5 : 縦 1。縦を半分に詰めて縮め、画素を正方形に見せる。
  // 縮めると色が沈むので、彩度を少し上げる。ぼかすと細部が消えるので、ぼかしや輪郭の強調はしない。
  const w = COLUMNS * 2;
  const { data } = await sharp(file)
    .resize({ width: w, height: Math.round((w * height!) / width! / 2), fit: 'fill', kernel: 'lanczos3' })
    .modulate({ saturation: 1.2 })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const h = data.length / 4 / w;
  // 半透明の縁は台紙の白と混ぜて塗り、ほぼ透明なら端末の地を見せる。しきい値だけで切ると縁がざらつく。
  const at = (x: number, y: number): Rgb | null => {
    if (y >= h) return null;
    const i = (y * w + x) * 4;
    const a = data[i + 3] / 255;
    if (a < 0.35) return null;
    return [0, 1, 2].map((k) => Math.round(data[i + k] * a + 255 * (1 - a))) as Rgb;
  };

  const rows: string[] = [];
  for (let y = 0; y < h; y += 2) {
    let line = '';
    let last = '';
    for (let x = 0; x < w; x += 2) {
      const cell = [at(x, y), at(x + 1, y), at(x, y + 1), at(x + 1, y + 1)];
      const opaque = cell.filter((p): p is Rgb => p !== null);
      let code: string;
      let ch: string;
      if (!opaque.length) [code, ch] = ['\x1b[0m', ' '];
      else if (opaque.length < 4) {
        // 透明な部分は端末の地のまま残し、残りを 1 色で塗る。
        const mask = cell.reduce((m, p, i) => m | (p ? 1 << i : 0), 0);
        [code, ch] = [`\x1b[0;${fg(mean(opaque))}m`, QUADRANTS[mask]];
      } else {
        // 4 画素を前景と背景の 2 色に分ける分け方のうち、色のずれがいちばん小さいものを選ぶ。
        let best = { e: Infinity, mask: 15, front: opaque[0], back: null as Rgb | null };
        for (let mask = 1; mask < 16; mask++) {
          const front = opaque.filter((_, i) => mask & (1 << i));
          const back = opaque.filter((_, i) => !(mask & (1 << i)));
          const mf = mean(front);
          const mb = back.length ? mean(back) : null;
          const e = error(front, mf) + (mb ? error(back, mb) : 0);
          if (e < best.e - 1) best = { e, mask, front: mf, back: mb };
        }
        [code, ch] = best.back ? [`\x1b[${fg(best.front)};${bg(best.back)}m`, QUADRANTS[best.mask]] : [`\x1b[0;${fg(best.front)}m`, '█'];
      }
      // 色が変わるときだけ指定を書き、応答を小さくする。
      if (code !== last) line += code;
      last = code;
      line += ch;
    }
    rows.push(`${line}\x1b[0m`);
  }
  return rows;
}
