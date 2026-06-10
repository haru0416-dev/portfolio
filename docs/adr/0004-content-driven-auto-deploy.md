# ADR-0004: Content-driven auto-deploy via GitHub Actions

- Status: Accepted
- Date: 2026-05-14
- Owner: haru0416-dev (GitHub)

## Context

ADR-0002 / ADR-0003 で **コンテンツが haru-content にある / サイトコードが haru0416 にある** という構造を確定したが、配布フロー（deploy）は未整備で、現状はローカルで `bun run deploy` を叩く手動運用。これだと:

- `haru-content` に push しても portfolio は更新されない（最大限の "git push = 公開" 感が損なわれる）
- portfolio コードに変更を入れる時も、手動で deploy する必要がある
- 書いた当日に Zenn と portfolio の両方に出ないので、外部から見て一貫性が崩れる

書く側の体験を「**git push したら数分で世界に出る**」に揃えるため、自動 deploy を整備する。

## Decision

### 1. CI/CD プラットフォーム: GitHub Actions

理由:
- 既に両 repo が GitHub 上にある
- repository_dispatch でクロスリポ・トリガーが組める（Cloudflare Workers Builds は native 統合だが cross-repo trigger が弱い）
- ステップを自分で組めるので `bun install` → `bun run build` → `wrangler deploy` のコントロールが効く

採用しないもの:
- Cloudflare Workers Builds（cross-repo trigger に向かない）
- Cron 単独（即時性が無い、深夜の不要 build）

### 2. 2 つの workflow

#### `haru0416/.github/workflows/deploy.yml`

トリガー:
- `push: branches: [main]` — portfolio コード変更
- `repository_dispatch: types: [content-update]` — haru-content からの通知
- `workflow_dispatch:` — 手動実行用
- `schedule:` — 1 日 1 回（dispatch 失敗時の保険、RSS の新着を拾うため）

ステップ:
1. checkout
2. setup-bun
3. bun install
4. bun run build
5. cloudflare/wrangler-action@v3 で deploy

#### `haru-content/.github/workflows/notify-portfolio.yml`

トリガー: `push: branches: [main]`

ステップ:
- GitHub API の dispatches エンドポイントに POST して haru0416 の workflow を起動

### 3. シークレットの所在

| Secret | 置き場 | 用途 | スコープ |
| --- | --- | --- | --- |
| `CF_API_TOKEN` | haru0416 | wrangler deploy 認証 | Cloudflare カスタムトークン: Workers Scripts:Edit + Account Settings:Read |
| `CF_ACCOUNT_ID` | haru0416 | account 指定 | 機密ではないが secret 扱い |
| `PORTFOLIO_DISPATCH_TOKEN` | haru-content | repository_dispatch 認可 | GitHub fine-grained PAT: haru0416 repo に対する `Contents: read and write`（`POST /repos/{owner}/{repo}/dispatches` は GitHub 公式の権限マトリクス上 Contents セクションに属する。`Actions` ではない） |

`GITHUB_TOKEN`（Actions 既定）は同 repo 内専用なので cross-repo dispatch には使えない。専用 PAT が必要。

### 4. キャッシュ戦略

- `actions/setup-bun` の cache を有効化（`bun install` 高速化）
- Astro の build cache（`.astro/`）は CI では再生成（短時間で安定性優先）

### 5. デプロイ頻度の見積もり

| トリガー | 想定頻度 |
| --- | --- |
| haru-content push | 数日に 1 回（記事更新） |
| haru0416 push | 月に 1〜数回（サイトコード変更） |
| cron | 1 日 1 回（保険） |

GitHub Actions の無料枠（個人 public repo: 無制限）内で十分。

### 6. ロールバック

- Cloudflare Workers の Version Rollback（dashboard から前 version に戻せる）
- それで足りない場合は `wrangler rollback` か git revert + push で前のコードを再 deploy

### 7. コミット粒度

- 本 ADR を独立コミット
- portfolio repo に workflow ファイル追加 = 1 コミット
- haru-content repo に notify workflow 追加 = 別 commit（別 repo なので必然的に独立）

## Consequences

### Positive
- "git push = 公開" が両 repo で成立
- portfolio に直接コード push しても自動 deploy（手動 wrangler 不要）
- Cron で 1 日 1 回保険があるので、dispatch が落ちても最大 24h で次回 build される
- ADR-0003 の "執筆フロー一本化" が deploy も含めて完成

### Negative / Tradeoffs
- 認証情報が 3 つ増える（CF_API_TOKEN / CF_ACCOUNT_ID / PORTFOLIO_DISPATCH_TOKEN）。漏洩時の影響範囲は Workers Scripts と haru0416 の Actions 起動権限
- haru-content 側で workflow が動くため、その分 Actions 利用枠を消費（public repo なら無制限）
- 初回のシークレット設定は手作業（API token 発行 / GitHub Secrets 投入）。本 ADR にチェックリストを残す

### Setup checklist（手動作業）

1. Cloudflare dashboard → My Profile → API Tokens → Create Custom Token
   - Permission: Account → Workers Scripts → Edit
   - Permission: Account → Account Settings → Read
   - Account Resources: Include → 自分の account
   - Token を `CF_API_TOKEN` として haru0416 の repo secrets に登録
2. Cloudflare dashboard → 右側の Account ID をコピー、`CF_ACCOUNT_ID` として haru0416 の repo secrets に登録
3. GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token
   - Resource owner: haru0416-dev
   - Repository access: Only select repositories → haru0416
   - Permissions: **Contents → Read and write**（Metadata は自動で Read-only に付与される）
   - 注意: `Actions` ではない。`POST /repos/.../dispatches` は GitHub 公式の権限マトリクスで Contents セクションに割り当てられている。`Actions: write` が必要なのは `workflow_dispatch` 用の別エンドポイント
   - Token を `PORTFOLIO_DISPATCH_TOKEN` として haru-content の repo secrets に登録

### Follow-ups
- Build 失敗時の通知（Slack / Email）— 必要になったら別 ADR
- Preview deploy（feature branch 用）— 不要そうだが要望が出たら
- ドメイン `haru0416.dev` 取得 + Workers Custom Domains 割当（ADR-0001 の follow-up を継続）

## Alternatives

### Alt 1: Cloudflare Workers Builds（CF native）
**不採用理由**: cross-repo trigger (haru-content → portfolio) を素直に組めない。CF Builds の repository_dispatch サポートが限定的。

### Alt 2: Cron のみ（1 日 1 回再ビルド）
**不採用理由**: 即時性が無い。書いた直後に確認したいニーズに合わない。dispatch + cron 併用にする。

### Alt 3: Webhook を Cloudflare Worker で受けて自前 dispatch
**不採用理由**: 余分な Worker と route を維持する負担。GitHub Actions だけで済む話を複雑化させる。

### Alt 4: monorepo 化（portfolio とコンテンツを 1 リポ）
**不採用理由**: ADR-0001 で portfolio コードと書いたものを分離した動機（commit 履歴の汚染回避、Zenn 連携の独立性）が崩れる。
