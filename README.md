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

出力先は `dist/`。`preview` は静的出力の確認用で、Cloudflare Pages Functions は実行しない。418 や curl 向けテキストは以下で確認する。

```sh
bun run pages:dev
```

## コンテンツの追加

### 記事

`src/content/blog/` に Markdown または MDX を追加する。frontmatter の必須項目は `title` と `pubDate`。`description`、`updatedDate`、`tags`、`draft` は任意で、`draft: true` の記事は公開対象から外れる。

記事は `/blog/<slug>/` に生成される。一覧のタグ絞り込み、RSS、記事ごとのOG画像にも反映される。

### 作品

`src/content/works/<id>.md` に登録する。必須項目は `name`、`summary`、`stack`。本文を書けば `/works/<id>/` の説明として表示される。

任意項目は `icon`、`cover`、`repo`、`url`、`issues`、`status`、`order`。`cover` は一覧と作品ページのサムネイルに使う画像で、`src/content/works/` からの相対パスで指定する。指定がなければ `icon` を使ったカバー画像を生成する。`status` は `active`、`wip`、`soon`、`archived` から選び、`order` の小さい順に並ぶ。`soon` の作品はリポジトリへのリンクを表示しない。

`issues` には、受付を有効にした公開 GitHub Issues の URL を指定する。作品ページに掲載される。アイコンを追加するときは `src/data/icons.ts` にも登録する。

項目の型とデフォルト値は `src/content.config.ts` で定義している。

### Lab

`src/pages/lab/<slug>.astro` を作り、`src/data/lab.ts` に登録する。ページは `src/layouts/Lab.astro` の `<Lab slug="...">` で囲む。題名・説明・日付・OG 情報は登録内容から表示される。

## 主なファイル

| 場所 | 役割 |
| --- | --- |
| `src/site.ts` | サイト名、説明、GitHub URL |
| `astro.config.mjs` | 公開URL、フォント、Astroの設定 |
| `src/layouts/Base.astro` | 共通レイアウト、メタ情報、テーマ、ページ遷移 |
| `src/layouts/Lab.astro` | Lab詳細ページの見出しとメタ情報 |
| `src/data/collections.ts` | 記事の公開条件、記事・作品の並び順、作品ステータスの表示名 |
| `src/components/` | ヘッダー、記事一覧などの共通部品 |
| `src/styles/global.css` | 色・寸法の変数、共通部品、アニメーション |
| `src/styles/prose.css` | 記事・作品の詳細ページだけで読む本文スタイル |
| `src/scripts/filter.ts` | Blog・Works共通の絞り込みと遷移処理 |
| `src/scripts/` | テーマ判定、スクロール、背景・Labの描画 |
| `src/og.ts` | TakumiによるOG画像生成 |
| `functions/_middleware.ts` | CLI向け応答と追加ヘッダー |
| `public/_headers` | 静的ファイルの応答ヘッダーとキャッシュ設定 |

## スタイルと生成アセット

色と寸法は `src/styles/global.css` にまとめている。色は OKLCH と `light-dark()` で指定し、ヘッダーで端末設定・ライト・ダークを切り替える。レイアウトの最大幅は `--container-reading`（通常、`41rem`）と `--container-site`（`wide`、`64rem`）で定義する。

本文内の `transition:name` には `transition:animate="initial"` を併記する。要素ごとのフェードCSSを生成せず、通常の遷移と非対応ブラウザ向けのフェードを `global.css` で定義している。

文字は 16px × 1.25ⁿ の型スケール、行送りと高さは 8px の倍数、角丸は 4・6・8・12・16・24・32px に揃える。`G` キー、フッターの Grid、または URL の `?grid` で、8px グリッドと本文の列、ホバーした要素の寸法を重ねて表示できる。実装は `src/scripts/design-grid.ts` で、開いたときに初めて読み込む。

背景と花びらは `prefers-reduced-motion` に対応する。動きを減らす設定では深海を静止画にし、水面の Canvas を隠す。背景の Canvas と描画用画像は、表示するテーマで初めて使うときだけ初期化する。Petals は WebGPU を使い、利用できない場合は Canvas 2D に切り替える。

### フォント

ラテン文字の見出しに Fredoka、和文見出しに Zen Maru Gothic 700、本文に Nunito と OS の日本語フォントを使う。フォントは自前配信し、Fredoka・Nunito・JetBrains Mono は Astro の Fonts API と `<Font />` で各ページに `@font-face` を書き込む。

和文見出しは、Zen Maru Gothic から作った 2 つのフォントで描く。どちらも先読みし、遅い回線でも見出しが後から差し替わらないようにする。再生成には uv と Python 3.12 以上が必要。

- かなと約物を詰めた派生フォント。かなを優先して当てる。

  ```sh
  uv run scripts/zen-maru-kana.py
  ```

- 見出しで使う文字だけのサブセット。ビルドした HTML から文字を集めるので、先にビルドする。記事や見出しを足して文字が増えたら作り直してコミットする。デプロイ時に足りない文字がないか確かめ、足りなければ公開を止める。

  ```sh
  bun run build && uv run scripts/zen-maru.py
  ```

出力は `public/fonts/zen-maru-kana-700.woff2` と `public/fonts/zen-maru-700.woff2`。元フォントと同じ SIL Open Font License を適用し、ライセンスを [zen-maru-kana-OFL.txt](public/fonts/zen-maru-kana-OFL.txt) に同梱する。和文見出しのないページは `Base` に `jpHeadings={false}` を、等幅のフォントを使うページは `mono` を渡して、先読みを合わせる。

### OG 画像とカーソル

OG 画像はビルド時に 1200×630 の PNG として生成する。サイト共通は `/og.png`、記事用は `/og/blog/<slug>.png`、作品用は `/og/works/<id>.png`。配色はダークテーマに合わせ、作品のアイコンは題名の左に置く。

カーソルは `tools/cursors.py` で定義する。次のコマンドは `public/cursors/` の SVG と `global.css` のカーソル設定を更新する。

```sh
python3 tools/cursors.py
```

## Cloudflare 固有の応答

curl・wget・HTTPie などでトップページを取得すると、サイト紹介をテキストで返す。`?html` または `Accept: text/html` で HTML、`?plain` で色なしのテキストになる。紹介内容はビルド時に生成する `/meta.json` から読む。

ミドルウェアは応答に `X-Sprout` ヘッダーを追加する。`/coffee` は 418、POST・PUT・PATCH・DELETE は 405 を返す。ローカルでこれらを確認する場合は、Astro ではなく Wrangler で起動する。

```sh
bun run pages:dev
```

## デプロイ

Cloudflare Pages の `haru0416-portfolio` に CLI から直接アップロードする。初回は `bunx wrangler login` で認証する。SSH 先などでブラウザから localhost に戻れない場合は `bunx wrangler login --device --browser=false` を使う。

```sh
bun run deploy
```

このコマンドは本番ブランチ `main` に公開する。未コミットの変更があるときは止める。作業ツリーのまま上げるときは `ALLOW_DIRTY=1 bun run deploy` を使う。`functions/` は Wrangler が一緒に配信する。

Pages 側の配信先は https://haru0416-portfolio.pages.dev/ 。`public/_headers` では `*.pages.dev` に `noindex` を指定している。独自ドメインを変更するときは Pages の登録と DNS を確認し、メール用の MX・TXT レコードは変更しない。
