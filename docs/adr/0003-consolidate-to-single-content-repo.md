# ADR-0003: Consolidate to a single haru-content repository

- Status: Accepted
- Date: 2026-05-14
- Owner: haru0416-dev (GitHub)
- Amends: ADR-0002 (repo split decision)

## Context

ADR-0002 では `zenn-content` と `blog-content` を別リポジトリに分け、その理由として Alt 2 で「Zenn の GitHub 連携が repo ルート前提の挙動を持つため、サブディレクトリ構成にすると Zenn 連携が複雑化する」と記した。

実装直後に「Zenn と blog を同一リポジトリで管理できないか」を再検討し、一次情報を確認した結果、以下が判明した:

- 個人アカウントの Zenn GitHub 連携は **root の `articles/` と `books/` のみを参照する**
- `npx zenn init` 時点で `node_modules/`, `package.json`, `README.md`, `.gitignore` 等が同じ root に同居する前提なので、それ以外のディレクトリは無視される設計と判断できる
- Publication モードでは root の各ディレクトリがユーザー名として解釈される注意があるが、個人アカウント（`zenn.dev/haru0416`）なので非該当

つまり ADR-0002 Alt 2 の不採用理由は誤り。同一リポジトリに `articles/`（Zenn 用）と `blog/`（portfolio 用）を同居させて問題ない。

執筆フローを最大限統一する方針と合わせ、**単一リポジトリ案を採用し直す**。

## Decision

### 1. 単一リポジトリ

`github.com/haru0416-dev/haru-content`（public）。

### 2. ディレクトリ構成

```
haru-content/
├── articles/        # Zenn が読む。zenn.dev へ自動公開される
│   └── <slug>.md
├── blog/            # portfolio だけが読む。Zenn は無視する
│   └── <slug>.md
└── images/          # Zenn 記事の画像置き場
```

`articles/` は Zenn 公式テンプレ準拠の frontmatter（emoji / type / topics / published / published_at）。  
`blog/` は portfolio 用 frontmatter（title / date / description / draft）。

### 3. Portfolio 側の取得

- `blog/*.md` → 全文取得して `/blog/<slug>` でレンダリング（現実装と同一、REPO 定数だけ変更）
- `articles/*.md` → 将来 Phase 3 で frontmatter のみ取得して RSS 由来 Zenn エントリを enrichment

### 4. 取得方式

ADR-0002 の方式（GitHub Trees API + raw.githubusercontent.com、公開 / 認証無し / fail-soft）は維持。`prefix` を変えるだけで両ディレクトリに対応する設計に小改修する。

### 5. コミット粒度

- 本 ADR を独立コミット（ADR-0002 への amendment 注記も同コミットに含める = ADR 文書群の整合性を取る 1 つの論理変更とみなす）
- 実装変更（`src/lib/blog.ts` の REPO 定数差し替え）は別コミット

`Refs: ADR-0003` を実装コミット本文に。

## Consequences

### Positive
- 執筆 = `git push haru-content`（1 つだけ）。clone 先・push 先・branch 概念がすべて一本化
- Zenn 記事の画像と blog 記事の画像を `images/` で共有できる（将来 blog が画像を扱う場合）
- 将来「Zenn 記事をローカルでプレビューするツール」を作る場合も、blog と同じ repo で完結

### Negative / Tradeoffs
- ディレクトリ規律違反のリスク: 誤って blog ドラフトを `articles/` に置くと Zenn に公開される。`articles/` の frontmatter には必ず `published: true|false` が要るので、未設定なら Zenn 側でエラー扱いになり実害は小さい
- もし将来 Zenn が「root 直下の任意ディレクトリを何らかの用途で予約」した場合（現状予約は `articles/` / `books/` / `images/` のみ）、`blog/` が衝突する可能性は理論上ある。確率は低い

### Follow-ups
- ADR-0002 のステータス欄に「Amended by ADR-0003: repo strategy」を併記（本 ADR 採択と同コミットで実施）
- Phase 3（Zenn enrichment）の実装時、`src/lib/zenn.ts`（仮）を追加して同じ `haru-content` の `articles/` を参照

## Alternatives

### Alt A: ADR-0002 のまま 2 リポジトリ
**不採用理由**: 連携可能と確認できた以上、執筆フロー単純化の利益が勝る。

### Alt B: `_blog/` / `.blog/` のように underscore/dot 接頭辞
**不採用理由**: 個人アカウントでは安全策不要。可読性を優先する。

### Alt C: blog を root 直下に展開（`<slug>.md` を repo 直下）
**不採用理由**: README や設定ファイルと記事が同居して見通しが悪い。`articles/` と並列の `blog/` が最も読める。
