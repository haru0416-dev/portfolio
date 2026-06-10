# ADR-0001: Portfolio site architecture and design direction

- Status: Accepted
- Date: 2026-05-14

## Context

ハンドル `haru0416` のポートフォリオサイトを新規に立てる。過去の試作は、いずれも以下の問題により破棄されてきた。

- 情報設計が曖昧で、何を主役にしたサイトかが読み手に伝わらない
- いわゆる "AI slop" 的な装飾過多（グラデーション、グロー、過剰なアニメーション）
- 既製テンプレ感が強く、扱う題材・作風と乖離している

活動領域は Rust（asterel 等）、Tauri 製アプリ、デザイン・ライティング（Zenn）に跨るが、公開コンテンツとして分量が多いのは「文章」である。

このため、サイトは「読み物（Zenn 記事 + 自前 MDX 雑記）を主役にした Editorial 寄りミニマル」とし、装飾より活字組みの強度で持たせる方針を採用する。

## Decision

### 1. 役割と主役
- 主役: Writing（Zenn 記事 + サイト内 MDX 雑記）の通時的インデックス
- 脇役: Projects（asterel など 3〜5 件）、Contact
- ヒーローブロックは置かない。冒頭は「名前のみ」、サブタイトル無し

### 2. 骨格（TOC / Masthead 型）
雑誌の目次・新聞の紙面に倣う単一ページ構成。

```
haru0416

—— Writing
2026  title
      title
2025  title
      ...

—— Projects
asterel    one-line description
KonoAsset  one-line description

—— Contact
github / zenn / mail
```

スクロールで全要素が読める。ナビゲーションは持たない（必要なら anchor のみ）。

### 3. 技術スタック（grounded against 2026-05 sources）

| 項目 | 採用 | 根拠 |
| --- | --- | --- |
| Framework | **Astro 6.3.x** | Astro 公式 March 2026 ブログで安定版確認 |
| Language | **TypeScript 6.x** | Astro 6 系と整合する現行安定版 |
| Package manager | **bun 1.3.x** | 高速、Astro 6 公式サポート |
| Lint/Format | **Biome 2.4+** | 公式 v2.4 リリース（2026-Q1）で Astro サポート改善 |
| Runtime | **Node 22+** | Astro 6 が Node 18/20 サポート廃止 |
| Deploy | **Cloudflare Workers (Static Assets)** | Cloudflare 公式が新規プロジェクトに Workers 推奨。Pages はレガシー方向 |
| Test | 当面なし | 必要になったら追加判断 |

選定理由:
- Astro = content-first、ビルド時 RSS 取得・MDX レンダリングが素直
- bun = 高速、install / build フローの単純化
- Biome = 単一ツールで lint + format
- Cloudflare Workers (Static Assets) = CF 自身の新規推奨パス、将来 Functions / Durable Objects / R2 への拡張余地

### 4. Astro 6 への適合（cutoff 後の API 変更を反映）

訓練データ cutoff（2026-01）以降に変わった事項を明示:

- `<ViewTransitions />` は **廃止**。`<ClientRouter />` を使用
- `Astro.glob()` 廃止 → `import.meta.glob` または Content Collections に集約
- `astro:content` の `z` re-export は deprecated → `astro/zod` の `z` を直接 import
- Zod 4 系（3 系は非サポート）
- CSP, Live Content Collections 等は stable 化したが本サイトでは未使用予定

### 5. コンテンツソース
- **Zenn 記事**: ビルド時に Zenn RSS（`https://zenn.dev/haru0416/feed`）を fetch、年次グルーピング、外部リンクとして表示
  - probe 済み（2026-05-14）: RSS 2.0 + dc namespace、`<item>` ごとに `title / link / description / pubDate / dc:creator` 確認
- **雑記**: `src/content/notes/*.mdx` を Content Collection として管理、サイト内 `/notes/[slug]` に配信
- Writing index は両者を時系列でマージして表示（外部リンクには小さい印を付ける）

### 6. デザイン言語
- **タイポグラフィを主役にする**
  - 見出し: Serif（候補: IBM Plex Serif / Source Serif 4 / 源ノ明朝）
  - 本文: Sans（候補: Inter / Geist / IBM Plex Sans JP）
  - コード: Mono（候補: JetBrains Mono / Geist Mono）
  - サイズコントラストを大きく取り、活字の段差で構造を表す
- **カラー**: Light + Dark（`prefers-color-scheme` 連動、トグル UI 無し）。基本モノクロ + 控えめ 1 アクセント（リンクホバー等の限定使用）
- **禁止**: グラデーション、ボックスシャドウ（必要最小限を除く）、ブラー、グロー、不要なアニメーション
- **許可**: ホバー時のアンダーライン、ページ遷移時の極めて短い fade（Astro `<ClientRouter />`）
- 日本語タイポグラフィを丁寧に扱う（font stack、行間、句読点周りのカーニング）

### 7. デプロイ構成
- 純静的ビルド（`output: 'static'` 既定）。`@astrojs/cloudflare` adapter は **使わない**
- `wrangler.toml` に最小設定:
  ```toml
  name = "haru0416"
  compatibility_date = "2026-05-14"
  assets = { directory = "./dist", not_found_handling = "404-page" }
  ```
- `bun run build` → `bunx wrangler deploy` で配信
- ドメイン: 将来 `haru0416.dev`（取得は本決定の範囲外）

### 8. ディレクトリと命名
- リポジトリ名: `haru0416`

### 9. コミット粒度
- 本 ADR を独立コミット（`docs(adr): add ADR-0001 portfolio architecture`）
- スキャフォールド、デザイン適用、コンテンツ取得、雑記コレクション等は別コミットに分割
- 全実装コミットの本文に `Refs: ADR-0001` を含める

## Consequences

### Positive
- 情報設計が一文で言える（"書いたもののインデックス"）。何を載せるか迷わなくなる
- 装飾を捨てるため、AI slop 的な装飾過多に陥らない。代わりにタイポグラフィの質が全てを決める
- Astro 6 Content Collections により、雑記の追加が `*.mdx` を置くだけになる
- Cloudflare Workers Static Assets により将来 Functions（コメント、メール送信、コンタクトフォーム等）を足す余地がある

### Negative / Tradeoffs
- 視覚的派手さがない。一見地味と受け取られる可能性がある
- フォント選定とタイポ設計の質が低いと、全体が単に退屈に見える（=逃げ場が無い）
- Zenn RSS のフォーマット変更や障害時の振る舞いを設計する必要がある（ビルド失敗 or キャッシュ fallback）
- bun は Node エコシステムの一部パッケージで non-trivial な相性問題が起きうる（Astro 6 自体は bun 公式サポート）

### Follow-ups
- フォント選定（無料 / セルフホスト / Google Fonts）の確定
- **Zenn-content GitHub repo を補助データソースに採用**:
  - Zenn の GitHub 連携を開始予定。RSS を主としつつ、`articles/*.md` のフロントマターから topic / emoji / type / published フラグを取り、Writing index のメタを強化する
  - 同時に RSS 障害時の fallback として機能させる
  - リポジトリ作成後に別 ADR で取得方式（raw fetch / git submodule / GitHub API）を決定
- OG 画像の方針（後続 ADR で扱う可能性）
- ドメイン `haru0416.dev` 取得と Workers への割当

## Alternatives

### Alt 1: Linear / Vercel 風プロダクト UI
ヒーロー + 機能カードのプロダクト LP 風。
**不採用理由**: 本人の "主役は読み物" の方向性と一致しない。また AI slop 的グラデの誘惑が強い。

### Alt 2: ブログエンジン（Hugo / Eleventy / Next.js + MDX）でフル自前ブログ化、Zenn 廃止
**不採用理由**: Zenn の公開先・SEO・読者導線を捨てるのは過剰。Zenn は維持し、雑記の置き場としてサイトを足すのが穏当。

### Alt 3: SPA ベース（Vite + React のみ）
**不採用理由**: 静的なコンテンツサイトで SPA の利点が無い。Astro が content-first として最適。

### Alt 4: サイドバー 2 カラム（rauno.me 系）
**不採用理由**: 検討の結果、Editorial / TOC 型を選好。サイドバーは "プロダクトドキュメント" の比喩が強く、雑誌的読み物の比喩と衝突する。

### Alt 5: Cloudflare Pages
**不採用理由**: Cloudflare が新規プロジェクトに Workers を公式推奨（2026 時点）。Pages は既存維持向け。新規で Pages を選ぶ理由が無い。

### Alt 6: GitHub Pages
**不採用理由**: 将来の拡張余地（Functions / R2 等）のため Workers 経路を選ぶ。

## Appendix: External grounding log

- Astro 6 (6.3.x): Astro 公式ブログ「What's new March 2026」+ GitHub Releases で確認（2026-05-14）
- Cloudflare Workers Static Assets: Cloudflare 公式 docs「Migrate from Pages to Workers」「Workers framework guides / Astro」+ Astro 公式 Cloudflare deploy ガイドで二軸確認（2026-05-14）
- Biome 2.4 Astro support: Biome 公式 v2.4 リリースノート + language-support ドキュメントで確認（2026-05-14）
- Zenn RSS: `curl https://zenn.dev/haru0416/feed` で実 fetch 成功、RSS 2.0 + dc namespace 確認（2026-05-14）
