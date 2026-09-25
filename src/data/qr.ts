import { encodeQr } from './qr-encode';

const roundRect = (x: number, y: number, s: number, r: number) =>
  `M${x + r} ${y}h${s - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${s - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${-(s - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(s - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}z`;

/**
 * QR コードを SVG パスにする。1 モジュールを 1 単位とし、周囲の余白は含めない。
 * 位置検出パターンは線ではなく塗りの輪で描き、どの描画系でも同じ太さにする。ドットは隙間が広いと読み取りにくいため、ほぼモジュールいっぱいの半径にする。
 */
export function qrPath(text: string) {
  const { size, modules } = encodeQr(text, 'M');
  const corners = [[0, 0], [size - 7, 0], [0, size - 7]];
  // 位置検出パターン(3 つの角の 7×7)は、下で角の丸い輪として描く。
  const inFinder = (x: number, y: number) => corners.some(([cx, cy]) => x >= cx && x < cx + 7 && y >= cy && y < cy + 7);
  const d: string[] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (modules[y][x] && !inFinder(x, y)) d.push(`M${x + 0.5} ${y + 0.04}a.46 .46 0 1 1 0 .92a.46 .46 0 1 1 0-.92`);
    }
  }
  for (const [x, y] of corners) {
    d.push(roundRect(x, y, 7, 2), roundRect(x + 1, y + 1, 5, 1.25), roundRect(x + 2, y + 2, 3, 0.9));
  }
  return { size, d: d.join('') };
}
