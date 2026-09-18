# Portfolio

記事、自作ツール、ブラウザで動く実験を載せる個人サイト。Astro と Tailwind CSS で静的に生成し、Cloudflare Pages に配信する。

公開先: https://haru0416.dev/

## 開発

Node.js 22.12.0 以上と Bun を使う。Bun のバージョンは `package.json` の `packageManager` を参照。フォント取得のため、ビルドにはネットワーク接続が必要。

```sh
bun install
bun run dev --background
```

開発サーバーは http://localhost:4321/ で起動する。

```sh
bun run astro dev status
bun run astro dev logs
bun run astro dev stop
```

型チェックとビルド:

```sh
bun run astro check
bun run build
bun run preview
```

出力先は `dist/`。`preview` は静的出力の確認用で、Cloudflare Pages Functions は実行しない。

## コンテンツの追加

### 記事

`src/content/blog/` に Markdown または MDX を追加する。frontmatter の必須項目は `title` と `pubDate`。`description`、`updatedDate`、`tags`、`draft` は任意で、`draft: true` の記事は公開対象から外れる。

記事は `/blog/<slug>/` に生成される。一覧のタグ絞り込み、RSS、記事ごとのOG画像にも反映される。

### 作品

`src/content/works/<id>.md` に登録する。必須項目は `name`、`summary`、`stack`。本文を書けば `/works/<id>/` の説明として表示される。

任意項目は `icon`、`repo`、`url`、`issues`、`status`、`order`。`status` は `active`、`wip`、`soon`、`archived` から選び、`order` の小さい順に並ぶ。`soon` の作品はリポジトリへのリンクを表示しない。

`issues` には、受付を有効にした公開 GitHub Issues のURLを指定する。作品ページと `/works/#feedback` に掲載される。アイコンを追加するときは `src/data/icons.ts` にも登録する。

項目の型とデフォルト値は `src/content.config.ts` で定義している。

### Lab

`src/pages/lab/<slug>.astro` を作り、`src/data/lab.ts` に登録する。

## 主なファイル

| 場所 | 役割 |
| --- | --- |
| `src/site.ts` | サイト名、説明、GitHub URL |
| `astro.config.mjs` | 公開URL、フォント、Astroの設定 |
| `src/layouts/Base.astro` | 共通レイアウト、メタ情報、テーマ、ページ遷移 |
| `src/components/` | ヘッダー、記事一覧などの共通部品 |
| `src/styles/global.css` | 色・寸法の変数、部品、記事本文、アニメーション |
| `src/scripts/` | テーマ判定、スクロール、背景・花びらの描画 |
| `src/og.ts` | TakumiによるOG画像生成 |
| `functions/_middleware.ts` | CLI向け応答と追加ヘッダー |
| `public/_headers` | 静的ファイルの応答ヘッダーとキャッシュ設定 |

## スタイルと生成アセット

色と寸法は `src/styles/global.css` にまとめている。色は OKLCH と `light-dark()` で指定し、ヘッダーで端末設定・ライト・ダークを切り替える。レイアウトの最大幅は通常 `41rem`、`wide` 指定時は `64rem`。

背景と花びらは `prefers-reduced-motion` に対応する。動きを減らす設定では深海を静止画にし、水面のCanvasを隠す。Petals は WebGPU を使い、利用できない場合は Canvas 2D に切り替える。

### フォント

ラテン文字の見出しに Fredoka、和文見出しに Zen Maru Gothic 700、本文に Nunito とOSの日本語フォントを使う。フォントは自前配信し、`/fonts.css` に `@font-face` をまとめる。

和文見出しには、かなと約物を詰めた派生フォントを優先して当てる。再生成には uv と Python 3.12 以上が必要。

```sh
uv run scripts/zen-maru-kana.py
```

出力は `public/fonts/zen-maru-kana-700.woff2`。元フォントと同じ SIL Open Font License を適用し、ライセンスを [zen-maru-kana-OFL.txt](public/fonts/zen-maru-kana-OFL.txt) に同梱する。和文見出しのないページは `Base` に `jpHeadings={false}` を渡すと先読みを省ける。

### OG画像とカーソル

OG画像はビルド時に1200×630のPNGとして生成する。サイト共通は `/og.png`、記事用は `/og/blog/<slug>.png`、作品用は `/og/works/<id>.png`。配色はダークテーマに合わせ、作品のアイコンは題名の左に置く。

カーソルは `tools/cursors.py` で定義する。次のコマンドは `public/cursors/` のSVGと `global.css` のカーソル設定を更新する。

```sh
python3 tools/cursors.py
```

## Cloudflare固有の応答

curl・wget・HTTPieなどでトップページを取得すると、サイト紹介をテキストで返す。`?html` または `Accept: text/html` でHTML、`?plain` で色なしのテキストになる。紹介内容はビルド時に生成する `/meta.json` から読む。

ミドルウェアは応答に `X-Sprout` ヘッダーを追加する。`/coffee` は418、POST・PUT・PATCH・DELETEは405を返す。ローカルでこれらを確認する場合は、Astroではなく Wrangler で起動する。

```sh
bun run build
bunx wrangler pages dev dist
```

## デプロイ

Cloudflare Pages の `haru0416-portfolio` にCLIから直接アップロードする。初回は `bunx wrangler login` で認証する。SSH先などでブラウザから localhost に戻れない場合は `bunx wrangler login --device --browser=false` を使う。

```sh
bun run build
bunx wrangler pages deploy dist --project-name haru0416-portfolio --branch main
```

このコマンドは本番ブランチ `main` に公開する。作業ツリーから生成した `dist/` を使うため、未コミットの変更も含まれる。`functions/` は Wrangler が一緒に配信する。

Pages側の配信先は https://haru0416-portfolio.pages.dev/ 。`public/_headers` では `*.pages.dev` に `noindex` を指定している。独自ドメインを変更するときは Pages の登録とDNSを確認し、メール用のMX・TXTレコードは変更しない。
