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

任意項目は `icon`、`cover`、`repo`、`url`、`issues`、`status`、`order`。`cover` は一覧と作品ページに表示する画像で、`src/content/works/` からの相対パスで指定する。省略した場合は `icon` を使ったカバーを表示する。`status` は `active`、`wip`、`soon`、`archived` から選び、`order` の小さい順に並ぶ。`soon` の作品はリポジトリへのリンクを表示しない。

`issues` には、受付を有効にした公開 GitHub Issues の URL を指定する。作品ページに掲載される。アイコンを追加するときは `src/data/icons.ts` にも登録する。

項目の型とデフォルト値は `src/content.config.ts` で定義している。

### Lab

`src/pages/lab/<slug>.astro` を作り、`src/data/lab.ts` に登録する。ページは `src/layouts/Lab.astro` の `<Lab slug="...">` で囲む。題名・説明・日付・OG 情報は登録内容から表示される。

一覧のサムネイルも必要。`src/assets/lab/<slug>.png` を置くか、テーマで画面が変わる場合は `<slug>-light.png` と `<slug>-dark.png` の両方を置く。画像がないと一覧のビルドは失敗する。

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

色と寸法は `src/styles/global.css` にまとめている。色は OKLCH と `light-dark()` で指定し、ヘッダーで端末設定・ライト・ダークを切り替える。ページ遷移では `astro:before-swap` で遷移先の文書に保存済みテーマを適用し、選択中のナビだけ一瞬ダーク配色になるのを防ぐ。レイアウトの最大幅は `--container-reading`（通常、`41rem`）と `--container-site`（`wide`、`64rem`）で定義する。

全画面で使う色・部品・遷移は `global.css`、特定ページのレイアウトはその `.astro` の `<style>`、記事と作品の本文だけに必要な装飾は `prose.css` に置く。作品・Lab のカードの高さは直上の一覧項目（作品詳細では `article`）を CSS コンテナとして測る。カードを別の親へ移すときは、その親に `card-container` を付ける。

本文内の `transition:name` には `transition:animate="initial"` を併記する。要素ごとのフェードCSSを生成せず、通常の遷移と非対応ブラウザ向けのフェードを `global.css` で定義している。

文字は 16px × 1.25ⁿ の型スケール、行送りと高さは 8px の倍数、角丸は 4・6・8・12・16・24・32px に揃える。`G` キー、フッターの Grid、または URL の `?grid` で、8px グリッドと本文の列、ホバーした要素の寸法を重ねて表示できる。実装は `src/scripts/design-grid.ts` で、開いたときに初めて読み込む。

背景と花びらは `prefers-reduced-motion` に対応する。動きを減らす設定では深海を静止画にし、水面の Canvas を隠す。背景の Canvas と描画用画像は、表示するテーマで初めて使うときだけ初期化する。Lab のテーマ別サムネイルは遅延読み込みし、Petals は WebGPU が利用できないときだけ Canvas 2D の描画コードを読み込む。

### フォント

文字はすべて自作の [Pancake](https://github.com/haru0416-dev/pancake-mono) で描く。本文と見出しは Pancake Sans(Medium と Bold)、コードは Pancake Mono(Regular)。フォントは自前配信する。生成には uv と Python 3.12 以上が必要。

- サイトで使う文字だけのサブセット。ビルドした HTML とスクリプトから文字を集めるので、先にビルドする。英字とかなは常に全部入れる。Pancake Mono はコードの欄の字だけを持ち、それ以外の和文は Pancake Sans に落ちる。記事や見出しを足して文字が増えたら作り直してコミットする。デプロイ時に足りない文字がないか確かめ、足りなければ公開を止める。OG 画像も Bold のサブセットで描く。

  ```sh
  bun run build && uv run scripts/pancake-site.py
  ```

- Lab の Pancake が読む、文字の範囲で分けた全ウェイト。110MB ほどあるので git には入れず、デプロイ時に作る(出力がそろっていれば何もしない)。

  ```sh
  uv run scripts/pancake.py
  ```

どちらも GitHub のリリースの zip を `node_modules/.cache/pancake/` に取ってきて使う。出力は `public/fonts/pancake-*.woff2` と `public/fonts/pancake/`。元フォントと同じ SIL Open Font License を適用し、ライセンスを [OFL.txt](public/fonts/OFL.txt) に同梱する。

### OG 画像とカーソル

OG 画像はビルド時に 1200×630 の PNG として生成する。サイト共通は `/og.png`、記事用は `/og/blog/<slug>.png`、作品用は `/og/works/<id>.png`、Lab 用は `/og/lab/<slug>.png`。配色はダークテーマに合わせ、作品のアイコンは題名の左に置く。

カーソルは `tools/cursors.py` で定義する。次のコマンドは `public/cursors/` の SVG と `global.css` のカーソル設定を更新する。

```sh
python3 tools/cursors.py
```

クリックするまで使わないカーソルの SVG は先読みせず、CSS の `cursor` から必要時に取得する。

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
