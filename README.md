# Portfolio

ブログと遊び場を兼ねた個人サイト。Astro + Tailwind、静的出力を Cloudflare Pages に置く。

## 構成

- `/blog` — `src/content/blog/*.md` を記事として出す。frontmatter は `title / description / pubDate / tags / draft`。
- `/works` — `src/content/works.json` に代表作を並べる。
- `/lab` — 1 ページ 1 実験。`src/pages/lab/<slug>.astro` を足して `src/data/lab.ts` に登録する。
- `/rss.xml`, `/sitemap-index.xml` は自動生成。`/fonts.css` は自前配信するフォントの `@font-face` を 1 ファイルにまとめたもの。

サイト名や GitHub のリンクは `src/site.ts`。公開 URL は `astro.config.mjs` の `site`。

## ファイルの役割

| 場所 | 役割 |
|---|---|
| `src/layouts/Base.astro` | 共通の骨格。フォントの preload、テーマ判定、ページ遷移(ClientRouter)、スキップリンク |
| `src/components/` | `Logo` `Header` `Footer` `Hero`(ページ冒頭)`PostList`(記事一覧)`Tile`(アイコンの座布団)`Wordmark`(名前の文字送り) |
| `src/styles/global.css` | トークン → 土台 → 書体と部品 → 記事本文 → 動き、の順 |
| `src/scripts/` | `smooth-scroll`(ホイールの慣性)`reading`(読了時間)`theme`(実効テーマの判定)`surface`(ライト背景の水面シミュレーション)`deep`(ダーク背景の深海)`petals`(Canvas 2D)`petals-gpu`(WebGPU) |
| `src/data/icons.ts` | 使う lucide アイコンの登録。作品のアイコンはここに足す |

## 見た目の規則

- **配色**: OKLCH。色相 3 つ(`--h` 地、`--h-accent` 桃、`--h-mint` 薄荷)と明度・彩度の段階で全色を作り、`light-dark()` でライトとダークを 1 か所に書く。OS のテーマに追従し、ヘッダーのボタンで固定できる。
- **書体**: 見出しは `.display`(Fredoka)と `.display-jp`(Zen Maru Gothic 700)。本文は Nunito と OS の日本語フォント。
- **背景**(`.sea`): ダークは深海(`src/scripts/deep.ts` が描く光の柱・沈むマリンスノー・海底から立ち上る泡の列、下ほど深い青み)、ライトは静かな水面(`src/scripts/surface.ts`: 2D 波動方程式で解く小さな雨粒の波紋と、上部だけに出る光の網目。上ほど空の水色)。出ない側は色を透明にして隠す。CSS のみで transform だけを動かし、reduced-motion では静止。
- **ガラス素材**(`.glass`): Liquid Glass の考え方を控えめに。背後をぼかして彩度を上げ、縁に光のリング(左上が明るく右下が暗い)と上辺のハイライト。ヘッダー・カード・ピル・チップ・アイコンボタンに使う。桃色のボタンと押下中のチップは不透明のまま。
- **動き**: 頻繁に見る操作は動かさない。ホバーと押下は 150〜200ms、スクロール連動は CSS のみ、ページ遷移は本文だけ。すべて `prefers-reduced-motion` で無効になる。

## 単位の規約

- **余白**: 8px の倍数だけ使う(Tailwind の `2 / 4 / 6 / 8 / 12 / 16 / 24 / 32`)。ピルやチップの内側だけ 4px 刻みを許容。
- **文字**: 16px 基準、比率 1.25 の型スケール(`text-xs` 〜 `text-7xl`)。行送りは 8px の倍数に丸めてある。`text-[...]` や `leading-*` で個別に指定しない。
- **角丸**: `rounded-lg`(8)/ `rounded-2xl`(16)/ `rounded-3xl`(24)/ `rounded-4xl`(40)/ `rounded-full`。入れ子にするときは **内側の角丸 = 外側の角丸 − 余白** で同心にする(カード 40 − 余白 24 = 座布団 16)。角の曲線は対応ブラウザでは `corner-shape: squircle`(超楕円)になり、円弧の角にある曲率の段差がなくなる。
- **幅**: 本文 42rem、広い面 64rem。日付の列は 6rem。
- 定義は `src/styles/global.css` の `@theme`。

## コマンド

パッケージ管理は Bun。

```sh
bun install
bun run dev      # 開発サーバー
bun run build    # dist/ に静的出力
bun run preview  # dist/ を配信して確認
bunx astro check
```

## curl で見ると

トップを curl / wget / HTTPie で取ると、HTML の代わりに名刺のようなテキストが返る(`functions/_middleware.ts`、Cloudflare Pages Functions)。`?html` で HTML、`?plain` で色なし。データは `/meta.json`(ビルド時に生成)。ローカルで試すには `bun run build && bunx wrangler pages dev dist`。

## デプロイ (Cloudflare Pages)

Git 連携で以下を設定する。

| 項目 | 値 |
|---|---|
| Build command | `bun run build` |
| Build output directory | `dist` |
| 環境変数 | `BUN_VERSION=1.4.2`(`bun.lock` があれば Bun が使われる) |

デプロイ後、`astro.config.mjs` の `site` を独自ドメインの URL に変える。
