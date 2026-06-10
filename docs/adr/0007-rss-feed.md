# ADR-0007: RSS feed for the writing index

- Status: Accepted
- Date: 2026-06-10

## Context

サイトは「書いたものの索引」（ADR-0001）を主役にしているが、購読導線が無い。Zenn には公式 feed（`zenn.dev/haru0416/feed`）があるものの、自前ブログ（`/blog/<slug>`）には feed が無く、両方を追いたい読者は 2 箇所を購読する必要がある。これはサイトの「全部一本にマージした索引」という役割と不整合。

sitemap は導入済み（`@astrojs/sitemap`）。残るは feed のみ。

## Decision

### 1. `/rss.xml` をビルド時生成

`@astrojs/rss` を使い、静的エンドポイント `src/pages/rss.xml.ts` で生成する。

### 2. 内容は Writing index と同一

Zenn エントリ + 自前ブログエントリをマージし、`pubDate` 降順で出す。

- Zenn エントリ: `<link>` を zenn.dev の記事 URL にした外部アイテムとして含める。サイトの「索引」という役割を feed にも反映する
- ブログエントリ: `/blog/<slug>` の絶対 URL
- 件数上限: 直近 50 件（将来肥大した時の安全弁）
- `language` は `ja`

### 3. 発見導線

`Base.astro` の `<head>` に `<link rel="alternate" type="application/rss+xml">` を追加する。

### 4. コミット粒度

- 本 ADR を独立コミット
- 実装（依存追加 + エンドポイント + alternate link）で 1 コミット（`Refs: ADR-0007`）

## Consequences

### Positive
- 「この人の書いたもの」を 1 つの feed で追える。索引サイトとしての役割が購読面でも完成する
- ビルド時生成なのでランタイムコスト無し

### Negative / Tradeoffs
- Zenn 記事を自サイトの feed に含めるため、feed リーダー上で zenn.dev へ直接飛ぶアイテムが混ざる（意図的な仕様）
- Zenn RSS の取得失敗時は既存の fail-soft 設計に従い、その分のアイテムが欠けた feed になる（ビルドは失敗しない）

### Follow-ups
- ブログ記事の本文全文を feed に含めるか（現状はタイトル + description のみ）は読者要望が出たら検討

## Alternatives

### Alt 1: 自前ブログのみの feed
**不採用理由**: Zenn 読者と分断され、読者が 2 feed を購読する必要が残る。「全部一本の索引」というサイトの設計思想と不一致。

### Alt 2: Atom 形式
**不採用理由**: RSS 2.0 で実用上十分。`@astrojs/rss` の既定に乗る。

### Alt 3: feed 無しのまま（Zenn feed に任せる）
**不採用理由**: 自前ブログ記事が購読不能のまま残る。
