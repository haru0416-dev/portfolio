# ADR-0002: GitHub-backed content sources (zenn-content + blog-content)

- Status: Accepted (amended by ADR-0003 for repo strategy)
- Date: 2026-05-14
- Owner: haru0416-dev (GitHub)

> **Amendment note**: §1「採用する 2 リポジトリ」と Alt 2 の不採用理由は ADR-0003 で訂正済。実体は単一リポジトリ `haru-content/{articles,blog}/`。本 ADR の取得方式・frontmatter 契約・fail-soft 設計は引き続き有効。

## Context

ADR-0001 では Writing 主役のサイト構成を採用し、Zenn 記事は RSS、雑記は in-tree の `src/content/notes/*.mdx` から拾う方針だった。

その後、Zenn の GitHub 連携を開始する方針となり、加えて Zenn 以外の "通常ブログ" 的長文も GitHub 上で管理する方針が固まった。

これにより、**執筆の入口を「git push」に統一する**ほうが、ローカル MDX 編集と Zenn の管理画面と portfolio リポジトリの 3 入口を持つよりずっと一貫する。

ADR-0001 の Follow-up に書いた「Zenn-content GitHub repo を補助データソースに採用」を、より広い「GitHub-backed content sources」全体方針として確定させる。

## Decision

### 1. 採用する 2 リポジトリ

| 用途 | リポジトリ名 | Portfolio での扱い |
| --- | --- | --- |
| Zenn 記事の真の source | `zenn-content` | フロントマター（topics / emoji / type / published）だけ拾い、RSS 由来エントリを enrichment。記事本文は Zenn 側に任せ、portfolio はレンダリングしない |
| 通常ブログの真の source | `blog-content` | 記事本文を含め portfolio が完全レンダリング。`/blog/<slug>` で配信 |

両方とも GitHub アカウント `haru0416-dev` 下に置く。

### 2. in-tree 雑記の廃止

`src/content/notes/`、`src/content.config.ts`、`src/pages/notes/[...slug].astro` を撤去。既存の seed note は `blog-content` 側に移植する。

### 3. URL 設計

- 既存: `/notes/<slug>` → 廃止
- 新規: `/blog/<slug>`
- 旧 URL の保護: まだ外部公開していないため、リダイレクトは不要

### 4. Writing index の振る舞い

ADR-0001 で確定済みの「全部一本にマージ、時系列順、外部リンクには小さい印」を維持。

- Zenn エントリ: external、Zenn URL へリンク、`zenn` 印
- Blog エントリ: internal、`/blog/<slug>` へリンク、印無し
- 並びは `pubDate` 降順、年でグルーピング

### 5. データ取得方式

リポジトリは **public 前提**。理由: build-time fetch の認証フローを避けたい、Cloudflare Workers のビルドで secret を取り扱う手間を最小化したい、両 repo の中身は "公開された記事" なので private に保つ動機が薄い。

- 一覧取得: GitHub Trees API `https://api.github.com/repos/<owner>/<repo>/git/trees/<branch>?recursive=1`（unauthenticated、60 req/hr / IP — ビルド頻度的に余裕）
- 中身取得: `https://raw.githubusercontent.com/<owner>/<repo>/<branch>/<path>`（auth 不要、CDN 経由）
- レート制限に達した場合: 既存の Zenn RSS と同じく warning + 空配列 fallback

将来 private に変えたくなった場合: GitHub PAT を `wrangler` secret に入れる方式に切り替え（別 ADR）。

### 6. フロントマター契約

**blog-content** (`articles/<slug>.md`):

```yaml
---
title: タイトル
date: 2026-05-14            # ISO date
description: 一行要約         # optional, OG description にも使う
draft: false                  # true なら build 時にスキップ
---

本文（CommonMark + GFM）。
```

**zenn-content** (`articles/<slug>.md`, Zenn 公式 format に準拠):

```yaml
---
title: タイトル
emoji: 🧠
type: tech                    # tech or idea
topics: [rust, ai]
published: true
published_at: "2026-05-12 11:00"
---
```

Portfolio は `published: true` のものだけ index に出す。`topics / emoji / type` を index UI（将来）で活用。RSS と zenn-content のエントリ突合は **slug**（ファイル名）で行う。

### 7. ファイル形式

- `.md`（CommonMark + GFM）を基本とする
- 必要になったら個別ファイル単位で `.mdx` も許容（Astro `@astrojs/mdx` で扱える）
- Zenn-flavored 拡張記法（`:::message` 等）は zenn-content にのみ出現し、portfolio は zenn-content の本文をレンダリングしないので無視

### 8. 取得失敗時の挙動

各データソース独立に try/catch:

- Zenn RSS が失敗 → 空、warning
- zenn-content fetch が失敗 → RSS の生データのみで index 表示（enrichment 無し）、warning
- blog-content fetch が失敗 → blog エントリ無しで index 表示、warning

つまり「どこかが落ちても残りで成立する」設計。

### 9. ビルド時キャッシュ（次フェーズ）

このフェーズでは未導入。将来 Cloudflare Pages/Workers の build worker でビルドキャッシュを利用する余地として残す。

### 10. コミット粒度

- 本 ADR を独立コミット
- 実装は以下に分割:
  1. `feat: add blog-content fetcher and /blog route`
  2. `refactor: remove in-tree notes collection`
  3. `feat: enrich Zenn entries with zenn-content metadata`（zenn-content repo 作成後）

全コミット本文に `Refs: ADR-0002` を含める。

## Consequences

### Positive
- 執筆フローが「git push」に一本化される
- portfolio リポジトリは "サイトのコード" だけになり、コンテンツ追加で site repo がコミット履歴を汚さない
- Zenn の topics / emoji / type を index UI に取り込める余地が生まれる
- 各データソースが独立 try/catch なので、一箇所の障害が他に波及しない

### Negative / Tradeoffs
- ローカル開発時にプレビューしたい blog 記事も GitHub に push する必要がある（git push → 数秒待って rebuild）
  - 緩和策: 開発時のみ `--blog-source=local-clone` のような flag を後付け可能。今は実装しない
- public repo 前提: 公開前の下書きは `draft: true` で表現する必要があり、frontmatter のリーク（GitHub からは下書きの存在が見える）はある
  - 緩和策: 完全に秘匿したい原稿は private gist 等で扱い、blog-content には push しない
- GitHub Trees API のレート制限（60/hr unauth）に build 頻度が当たる可能性
  - 緩和策: 当面は問題にならない。問題化したら authenticated（PAT）に切り替え

### Follow-ups
- ドメイン取得 + Workers ルート割当（ADR-0001 から継続）
- OG 画像のアートディレクション（ADR-0001 から継続）
- blog-content / zenn-content のローカル clone でプレビューする dev flag（要望次第）
- private 化の必要が出た場合の PAT 運用（別 ADR）

## Alternatives

### Alt 1: in-tree のまま続行
**不採用理由**: Zenn 側を GitHub 連携に寄せるのに portfolio 内だけ in-tree のままだと、執筆フローが 2 系統並走する。一貫性が損なわれる。

### Alt 2: 1 リポジトリにサブディレクトリ（`haru-content/{zenn,blog}/`）
**不採用理由**: Zenn の GitHub 連携が repo ルート前提の挙動（`articles/`, `books/` を repo 直下に要求）を持つため、サブディレクトリ構成にすると Zenn 連携が複雑化する。連携テンプレに乗ったほうが安全。

### Alt 3: ファイル種別を frontmatter の `source: zenn|blog` で識別、1 リポジトリにフラット
**不採用理由**: Zenn 連携テンプレと互換が崩れる。zenn-content をテンプレ準拠にしておくと公式 doc がそのまま使える。

### Alt 4: GitHub API で private + PAT 認証から始める
**不採用理由**: 公開記事に対して認証要件を入れるのは過剰。後から必要なら切り替えれば良い。
