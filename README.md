# Portfolio

記事と自作ツール、ブラウザで動く実験を載せる個人サイト。Astro と Tailwind を使い、静的に生成したファイルを Cloudflare Pages に置く。

## 構成

- `/blog`: `src/content/blog/*.md` を記事として出す。frontmatter は `title / description / pubDate / tags / draft`。タグの絞り込みには最新カードも含め、表示件数と0件時の案内を出す。
- `/works`: `src/content/works.json` に代表作を登録する。`#munou-example` に公開 README から引用した会話例、`#feedback` に感想・不具合の報告先を載せる。`issues` は受付が有効な公開 GitHub Issues の URL がある作品だけ指定する。
- `/lab`: 実験を 1 ページに 1 つずつ置く。追加するときは `src/pages/lab/<slug>.astro` を作り、`src/data/lab.ts` に登録する。
- `/rss.xml`, `/sitemap-index.xml` は自動生成。`public/robots.txt` でサイトマップの場所を伝える。`/fonts.css` には自前配信するフォントの `@font-face` をまとめている。

サイト名や GitHub のリンクは `src/site.ts`。公開 URL は `https://haru0416.dev` で、`astro.config.mjs` の `site` に設定している。

共有用画像は `public/og.png`(1200×630px)。編集用の `public/og.svg` にはサイトで使うフォントを埋め込んでいる。SVGを変更したらブラウザで描画し、同じ寸法・倍率1でPNGも書き出す。共通レイアウトから公開ドメインの絶対URLをOGP・Twitterカードに指定する。

記事ページの共有用画像は、ビルド時に `src/og.ts` が Takumi で記事ごとに描き、`/og/blog/<slug>.png` に書き出す(`src/pages/og/blog/[...slug].png.ts`)。フォントはビルド時に Google Fonts から、題名に使う文字を含む分割ファイルだけ取得するので、ビルドにはネットワーク接続が要る。Takumi は `word-break: auto-phrase` に未対応のため、題名は `Intl.Segmenter` で区切った文節の切れ目だけで改行させている。配置は `src/og.ts` 冒頭に書いた規則(余白・左右の端・ベースライン・題名の縦位置)を満たすように、各要素のインクの位置を測ってから計算する。右側の円は記事ごとのアイコンを置く枠で、`renderPostImage` の `icon` に画像を渡すと差し替わる(省略時はサイトの芽のアイコン)。

## ファイルの役割

| 場所 | 役割 |
|---|---|
| `src/layouts/Base.astro` | 共通レイアウト。フォントの preload、テーマ判定、ページ遷移(ClientRouter)、スキップリンク |
| `src/components/` | `Logo` `Header` `Footer` `Hero`(ページ冒頭)`PostList`(記事一覧)`Tile`(アイコン背景)`Wordmark`(名前の文字送り) |
| `src/styles/global.css` | 色や寸法の変数、基本スタイル、書体と部品、記事本文、アニメーション |
| `src/scripts/` | `smooth-scroll`(ホイールの慣性)`reading`(読了時間)`theme`(実効テーマの判定)`background`(背景の起動・停止、リサイズ、非表示時の停止)`surface`(水面)`deep`(深海)`petals`(Canvas 2D)`petals-gpu`(WebGPU) |
| `src/data/icons.ts` | 使う lucide アイコンの登録。作品のアイコンはここに足す |

## 見た目の規則

配色は OKLCH で指定する。地の色、桃色、薄荷色の色相を `--h`、`--h-accent`、`--h-mint` にまとめ、明度と彩度を変えて使っている。ライトとダークの色は `light-dark()` で指定する。ヘッダーのテーマ設定で「端末の設定に合わせる」「ライト」「ダーク」を選ぶ。端末の設定に戻すと保存済みの固定テーマを解除する。

見出しは `.display` が Fredoka、`.display-jp` が Zen Maru Gothic 700。Zen Maru Gothic は palt(かなと約物を詰める機能)を持たないので、かなと約物だけ詰めた `public/fonts/zen-maru-kana-700.woff2` を先に当てている。`uv run scripts/zen-maru-kana.py` で作り直せる(元フォントと同じ OFL。ライセンスは同じ場所の `zen-maru-kana-OFL.txt`)。和文の見出しが無いページは `Base` に `jpHeadings={false}` を渡し、このフォントを先読みしない。本文には Nunito と OS の日本語フォントを使う。

背景の `.sea` はテーマによって変わる。ダークでは CSS で 2 層の光の帯を動かし、`src/scripts/deep.ts` がマリンスノーと下から上がる泡を描く。下へ行くほど青みが濃くなる。ライトでは `src/scripts/surface.ts` が 2D 波動方程式で雨粒の波紋を計算する。画面の上部には光の網目を重ね、空の水色を付けている。

光の帯は CSS の transform、粒子と波紋は Canvas 2D で動かす。reduced-motion では深海を静止画にし、水面の Canvas を隠す。

`.glass` は背後をぼかして彩度を上げ、左上が明るく右下が暗い縁と、上辺のハイライトを付ける。ヘッダー、カード、ピル、チップ、アイコンボタンに使う。桃色のボタンと押下中のチップは不透明のまま。

カーソルは lucide と同じ 24 の格子、線幅 2、角丸で描いた mouse-pointer-2。桃色の線に白い縁取りを付けている。リンクに重ねても形は変えず、色だけを濃くする。押している間はさらに濃くなり、入力欄では I ビームを使う。画像は `public/cursors/*.svg` にある。CSS の `cursor` に SVG を埋め込み、ホバーできる端末だけに適用する。JavaScript は使わない。形を変えるときは `tools/cursors.py` を編集して実行する。

ホバーと押下の変化は 150〜200ms。スクロールに連動する動きは CSS で指定し、ページ遷移では本文だけを動かす。背景・花びら・慣性スクロールは閲覧中の `prefers-reduced-motion` の変更にも対応する。ただし、花びらの一時停止は設定変更では解除しない。

慣性スクロールはキー・ポインター・タッチ操作で中断する。細かいホイール入力や、外部からスクロール位置が変わったときも中断する。

## 単位の規約

- 余白は 8px の倍数(Tailwind の `2 / 4 / 6 / 8 / 12 / 16 / 24 / 32`)。ピルやチップの内側だけ 4px 刻みを許容する。
- 文字サイズは 16px を基準に 1.25 倍ずつ増やす(`text-xs` 〜 `text-7xl`)。行送りは 8px の倍数に丸めてある。`text-[...]` や `leading-*` で個別に指定しない。
- 角丸は `rounded-lg`(8)/ `rounded-2xl`(16)/ `rounded-3xl`(24)/ `rounded-4xl`(40)/ `rounded-full`。入れ子では、外側の角丸から余白を引いた値を内側の角丸にする。たとえばカードが 40px、余白が 24px なら、アイコン背景の角丸は 16px。対応ブラウザでは `corner-shape: squircle`(超楕円)を使い、直線と円弧のつなぎ目にある曲率の段差をなくす。
- 本文の幅は 42rem、広いレイアウトは 64rem。日付の列は 6rem。

値は `src/styles/global.css` の `@theme` で定義している。

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

curl / wget / HTTPie でトップページを取得すると、HTML の代わりにサイト紹介のテキストが返る。処理は Cloudflare Pages Functions の `functions/_middleware.ts` にある。`?html` を付けると HTML、`?plain` を付けると色なしのテキストになる。

同じファイルに、見つけた人向けのおまけを置いている。全応答に `X-Sprout` ヘッダーを付け、`/coffee` は 418 I'm a teapot を返す。POST・PUT・PATCH・DELETE には一言添えて 405 を返す。DNS の TXT レコード(ダッシュボードで設定)は `curl -I` を勧め、順にたどれるようにしている。RFC 2324 の BREW メソッドは Cloudflare が Functions に届く前に 501 で返すので使えない。

紹介文やリンクはビルド時に生成する `/meta.json` から読む。ローカルで試すには `bun run build && bunx wrangler pages dev dist` を実行する。

## デプロイ (Cloudflare Pages)

応答ヘッダーは `public/_headers` で指定する。全ページにセキュリティ用のヘッダー(HSTS、`nosniff`、他サイトへの埋め込み禁止など)を付け、ファイル名にハッシュが入る `/_astro/*` は1年キャッシュする。`*.pages.dev` の配信先とプレビューには `X-Robots-Tag: noindex` を付け、検索には本番ドメインだけを載せる。

Pages プロジェクトは `haru0416-portfolio`。現在は Git 連携ではなく、CLI から直接アップロードしている。
本番URLは https://haru0416.dev/ 。Pages の配信先 https://haru0416-portfolio.pages.dev/ でも開ける。

```sh
bun run build
bunx wrangler pages deploy dist --project-name haru0416-portfolio --branch main
```

`main` は本番ブランチ。上のコマンドは作業ツリーから生成した `dist` を公開するので、未コミットの変更も含まれる。`functions/` も Wrangler が一緒に配信する。

初回は `bunx wrangler login` で認証する。SSH先などでブラウザのlocalhostへ戻れない場合は `bunx wrangler login --device --browser=false` を使い、表示されたURLとコードで承認する。

独自ドメインは Pages に登録し、DNSも設定済み。現在のレコードは以下。接続先を変更するときも、メール用の MX・TXT は変更しない。

| 種類 | 名前 | 接続先 | プロキシ | TTL |
|---|---|---|---|---|
| CNAME | `@` | `haru0416-portfolio.pages.dev` | 有効 | 自動 |

Wrangler の OAuth 認証には DNS の編集権限がないため、DNS の変更はダッシュボードか、このゾーンに限定した DNS 編集権限の API トークンで行う。Pages のカスタムドメインは `Active` で、`https://haru0416.dev/` のHTTPS表示を確認済み。
