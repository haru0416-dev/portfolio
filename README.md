# Portfolio

ブログと遊び場を兼ねた個人サイト。Astro + Tailwind、静的出力を Cloudflare Pages に置く。

## 構成

- `/blog` — `src/content/blog/*.md` を記事として出す。frontmatter は `title / description / pubDate / tags / draft`。
- `/works` — `src/content/works.json` に代表作を並べる。
- `/lab` — 1 ページ 1 実験。`src/pages/lab/<slug>.astro` を足して `src/data/lab.ts` に登録する。
- `/rss.xml`, `/sitemap-index.xml` は自動生成。

サイト名や GitHub のリンクは `src/site.ts`。公開 URL は `astro.config.mjs` の `site`。

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
