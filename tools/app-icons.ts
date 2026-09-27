// 再生成: bun tools/app-icons.ts
// ホーム画面に追加したときのアイコン(manifest.webmanifest が読む)。favicon.svg と同じ芽を、同じ色で描く。
// 端末が丸や角丸に切り抜いても欠けないよう(maskable)、地は正方形いっぱいに塗り、芽は中央の 56% に収める(切り抜きの安全域は直径 80%)。
import sharp from 'sharp';
import { oklchToHex } from '../src/palette';

const BG = oklchToHex(94.5, 0.022, 300);
const INK = oklchToHex(69, 0.17, 356);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="${BG}"/><g transform="translate(22 22) scale(2.3333)" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9.536V7a4 4 0 0 1 4-4h1.5a.5.5 0 0 1 .5.5V5a4 4 0 0 1-4 4 4 4 0 0 0-4 4c0 2 1 3 1 5a5 5 0 0 1-1 3"/><path d="M4 9a5 5 0 0 1 8 4 5 5 0 0 1-8-4"/><path d="M5 21h14"/></g></svg>`;

for (const size of [192, 512]) {
  await sharp(Buffer.from(svg), { density: (72 * size) / 100 }).resize(size, size).png({ compressionLevel: 9, palette: true }).toFile(`public/icon-${size}.png`);
}
console.log('ok');
