# Portfolio

ブログと遊び場を兼ねた個人サイト。Astro + Tailwind、静的出力を Cloudflare Pages に置く。

## 構成

- `/blog` — `src/content/blog/*.md` を記事として出す。frontmatter は `title / description / pubDate / tags / draft`。
- `/works` — `src/content/works.json` に代表作を並べる。
- `/lab` — 1 ページ 1 実験。`src/pages/lab/<slug>.astro` を足して `src/data/lab.ts` に登録する。
- `/rss.xml`, `/sitemap-index.xml` は自動生成。

サイト名や GitHub のリンクは `src/site.ts`。公開 URL は `astro.config.mjs` の `site`。

## 単位の規約

- **余白**: 8px の倍数だけ使う(Tailwind の `2 / 4 / 6 / 8 / 12 / 16 / 24 / 32`)。ピルやチップの内側だけ 4px 刻みを許容。
- **文字**: 16px 基準、比率 1.25 の型スケール(`text-xs` 〜 `text-7xl`)。行送りは 8px の倍数に丸めてある。`text-[...]` や `leading-*` で個別に指定しない。
- **角丸**: `rounded-lg`(8)/ `rounded-2xl`(16)/ `rounded-3xl`(24)/ `rounded-4xl`(40)/ `rounded-full`。入れ子にするときは **内側の角丸 = 外側の角丸 − 余白** で同心にする(カード 40 − 余白 24 = 座布団 16)。角の曲線は対応ブラウザでは `corner-shape: squircle`(超楕円)になり、円弧の角にある曲率の段差がなくなる。
- **幅**: 本文 42rem、広い面 64rem。日付の列は 6rem。
- 定義は `src/styles/global.css` の `@theme`。

## コマンド

```sh
pnpm dev       # 開発サーバー
pnpm build     # dist/ に静的出力
pnpm preview   # dist/ を配信して確認
pnpm astro check
```

## デプロイ (Cloudflare Pages)

Git 連携で以下を設定する。

| 項目 | 値 |
|---|---|
| Build command | `pnpm build` |
| Build output directory | `dist` |
| 環境変数 | `NODE_VERSION=24` |

デプロイ後、`astro.config.mjs` の `site` を独自ドメインの URL に変える。
