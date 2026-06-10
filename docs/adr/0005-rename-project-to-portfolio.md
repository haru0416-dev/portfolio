# ADR-0005: Rename project and repository to "portfolio"

- Status: Accepted
- Date: 2026-05-25
- Owner: haru0416-dev (GitHub)

## Context

リポジトリ名・ローカルフォルダ名・Cloudflare Worker 名がすべて `haru0416` で揃っているが、これは GitHub アカウント / 独自ドメイン / Zenn ID と同じ識別子であり、**プロジェクトの内容 (= portfolio サイト)** を表していない。ローカルでは多数の独立プロジェクトを並行して扱っているため、フォルダ名から用途が読めないと取り違えのリスクがある。

一方、以下はユーザー識別子であって変更してはならない:

- `haru0416-dev` (GitHub organization)
- `haru0416.dev` (本サイトの独自ドメイン)
- `zenn.dev/haru0416` (Zenn のユーザー ID)

つまり「プロジェクト名としての `haru0416`」だけを `portfolio` に改名する。

## Decision

### 1. 新しい名前

`portfolio` (小文字、kebab 不要)。

### 2. 変更対象

| 対象 | 旧 | 新 |
|------|----|----|
| GitHub repo | `haru0416-dev/haru0416` | `haru0416-dev/portfolio` |
| ローカルフォルダ | `haru0416` | `portfolio` |
| `package.json#name` | `haru0416` | `portfolio` |
| `wrangler.toml#name` (= Worker 名) | `haru0416` | `portfolio` |
| `src/lib/writing.ts` User-Agent | `haru0416-portfolio-build/1.0` | `portfolio-build/1.0` |

変更しないもの:

- `src/lib/blog.ts` / `src/lib/zenn.ts` の `OWNER = 'haru0416-dev'`
- `src/lib/writing.ts` の Zenn フィード URL `https://zenn.dev/haru0416/feed`
- `wrangler.toml#routes.pattern = "haru0416.dev"`

### 3. 実行順序 (Worker 名変更を含むため、無停止での張り替え手順を明示)

1. **コード修正コミット** (`package.json`, `wrangler.toml`, `src/lib/writing.ts`)
2. **GitHub リポ rename**: `gh repo rename portfolio` (remote URL は自動更新)
3. **新 Worker デプロイ**: ADR-0004 の auto-deploy または手動 `wrangler deploy` で、新しい Worker 名 `portfolio` がデプロイされる (旧 `haru0416` Worker と並存)
4. **動作確認**: `portfolio.<account>.workers.dev` で配信内容を確認
5. **カスタムドメイン張り替え**: Cloudflare Dashboard で `haru0416.dev` を旧 Worker (`haru0416`) から外し、新 Worker (`portfolio`) に紐付け
6. **旧 Worker 削除**: 動作確認後、`haru0416` Worker を削除
7. **ローカルフォルダ rename**: 作業シェルを抜けた状態で `haru0416` → `portfolio` に rename

### 4. コミット粒度

- 本 ADR を独立コミット
- コード修正 (上記 Phase 1) を別コミット (`Refs: ADR-0005`)
- 残りはインフラ操作 (gh / wrangler / Cloudflare Dashboard / mv) で git 履歴に出ない

## Consequences

### Positive

- フォルダ名から用途が即わかる (`Project/portfolio`)
- GitHub の repo 一覧でも `portfolio` と表示され、`haru0416` (個人ハンドル) と区別される
- Worker 名も用途を表す名前になり、Cloudflare ダッシュボードで他プロジェクトと混同しにくい

### Negative / Tradeoffs

- **Worker 名変更で一時的に 2 つの Worker が並存する**。カスタムドメイン張り替えのタイミング次第で、旧 Worker と新 Worker のどちらが配信するかが切り替わる。手順 4 → 5 → 6 の順を守ればダウンタイム 0
- GitHub の旧 URL (`haru0416-dev/haru0416`) は GitHub のリダイレクトに依存する。GitHub は repo rename 後、旧 owner/name でのアクセスを新リポジトリに 301 リダイレクトする (永続) ので、外部リンクは生き続ける
- ローカル環境でこのフォルダパスを参照しているツール設定は手動で追従が要る

### Follow-ups

- ADR-0001 / 0002 / 0003 / 0004 の本文中に出てくる `haru0416` (プロジェクト名としての言及部分) は履歴保存のため**書き換えない**。本 ADR が後続の正となる

## Alternatives

### Alt A: `Portfolio` (大文字始まり)

**不採用理由**: GitHub / OSS の慣習では repo 名は小文字。URL 上の見栄えも小文字が一般的。

### Alt B: `haru-portfolio` (接頭辞付き)

**不採用理由**: 既に GitHub org が `haru0416-dev` なので、repo 名側で重ねて `haru-` を付ける必要はない。フルパスは `haru0416-dev/portfolio` で十分一意。

### Alt C: 何も変えない (現状維持)

**不採用理由**: 本人が「プロジェクトが分かりづらい」と指摘した時点で、識別子としての価値が低下している。後で他プロジェクトが増えるたびに混乱が累積する。
