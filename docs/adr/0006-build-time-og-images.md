# ADR-0006: Build-time OG image generation

- Status: Accepted
- Date: 2026-06-10

## Context

ADR-0001 / ADR-0002 の Follow-ups に「OG 画像の方針」が未消化のまま残っている。現状、サイトには `og:image` が無く、SNS や Zenn 経由で共有された際にテキストのみのカードになる。Writing を主役にするサイトとして、共有カードは記事の「表紙」に相当し、ここが空白なのは設計思想と不整合。

サイトは純静的ビルド (`output: 'static'`、ADR-0001 §7) なので、ビルド時に PNG を生成して静的アセットとして配信するのが最も素直で、ランタイム追加も不要。

## Decision

### 1. 生成方式

**satori**（HTML ライクなオブジェクトツリー → SVG）+ **@resvg/resvg-js**（SVG → PNG）を、Astro の静的ファイルエンドポイント（`src/pages/og/**/*.png.ts`）内で実行する。

- `output: 'static'` のまま。デプロイ構成（Workers Static Assets）に変更なし
- 依存は `dependencies` に追加（CI ビルドで必要なため）

### 2. 生成対象

| パス | 用途 |
| --- | --- |
| `/og/default.png` | トップ・Writing アーカイブ・404 などサイト共通 |
| `/og/blog/<slug>.png` | 自前ブログ各記事（タイトル + 日付入り） |

Zenn 記事は Zenn 側が OG 画像を生成するため対象外。

### 3. デザイン

1200×630。サイトのデザイントークンを踏襲し、**light テーマ固定**:

- 背景 `#ffffff` / 文字 `#111111` / 補助 `#6b6b6b` / 罫線 `#e2e2e2` / アクセント `#b8332a`（限定使用）
- Noto Serif JP によるタイポグラフィのみで構成。グラデーション・グロー等は OG でも禁止（ADR-0001 §6 の禁止事項を OG にも適用）
- 構図: 上部にドメイン + 罫線、中央に記事タイトル（大きめ serif）、下部に日付

### 4. フォント

**Noto Serif JP Medium**（OTF, SIL OFL 1.1）を `src/assets/fonts/` にベンダリングする。

- ビルド時に satori へ渡すためだけに使用。クライアントには配信しない
- woff2 は satori 非対応。CJK フォントのビルド時 fetch は外部依存とサイズの面で不安定要因になるため、リポジトリ同梱を選ぶ（約 6MB、OFL ライセンス文を同梱）

### 5. メタタグ

`Base.astro` に追加:

- `og:image`（絶対 URL）/ `og:image:width` / `og:image:height` / `og:image:alt`
- `twitter:card` を `summary` から `summary_large_image` に変更、`twitter:image` 追加
- ページごとに `ogImage` prop で上書き可能。既定は `/og/default.png`

### 6. コミット粒度

- 本 ADR を独立コミット
- フォント追加 + 生成実装 + メタタグで 1 コミット（`Refs: ADR-0006`）

## Consequences

### Positive
- 共有時にタイトルの読める「表紙」が付く。Writing 主役の思想が外部導線まで一貫する
- ビルド時生成なのでランタイムコスト・障害点が増えない

### Negative / Tradeoffs
- リポジトリにフォント約 6MB が入る
- ビルド成果物が記事数ぶん増える（1 記事 1 PNG、数十 KB 規模）
- satori / resvg のネイティブモジュールがビルド環境依存になる（bun + GitHub Actions ubuntu で動作確認をもって受け入れ）

### Follow-ups
- ダークテーマ版 OG は作らない（OG はプラットフォーム側背景に載るため light 固定が安全）
- Writing アーカイブ専用 OG（タイトル「Writing」入り）は必要になったら追加

## Alternatives

### Alt 1: 動的生成（Cloudflare Workers + satori WASM）
**不採用理由**: 純静的サイトに対して過剰。リクエスト時生成が必要になるのはコンテンツが動的な場合のみ。

### Alt 2: astro-og-canvas
**不採用理由**: canvaskit-wasm ベースで手軽だが、レイアウト表現の自由度が低く、Astro 6 対応状況が不明確。satori は framework 非依存で Astro バージョンに縛られない。

### Alt 3: 外部 OG 生成サービス
**不採用理由**: 外部依存が増えるだけ。静的ビルドで完結できる。

### Alt 4: 手書き SVG テンプレート + resvg のみ（satori 無し）
**不採用理由**: 日本語タイトルの折返しを自前実装する必要がある。satori の flexbox + 自動折返しに任せるほうが堅い。
