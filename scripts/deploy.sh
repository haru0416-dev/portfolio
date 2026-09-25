#!/bin/sh
set -eu
if [ -n "$(git status --porcelain)" ] && [ -z "${ALLOW_DIRTY:-}" ]; then
  echo "未コミットの変更があります。コミットするか、ALLOW_DIRTY=1 を付けて実行してください。" >&2
  git status --porcelain >&2
  exit 1
fi
# 変換結果のキャッシュは、Markdown のプラグインや配色を変えても作り直されないので、毎回消す。
rm -f node_modules/.astro/data-store.json
# 記事の変換に失敗してもビルドは成功扱いになり、本文が空のまま出力される。ログにエラーがあれば公開しない。
log=$(mktemp)
trap 'rm -f "$log"' EXIT
astro build >"$log" 2>&1 || { cat "$log" >&2; exit 1; }
cat "$log"
if grep -q '\[ERROR\]' "$log"; then
  echo "ビルドのログにエラーがあるため、公開を中止しました。" >&2
  exit 1
fi
# 見出しのフォントは使う文字だけを持つので、記事で増えた文字が抜けていないか確かめる。
uv run -q scripts/zen-maru.py --check
wrangler pages deploy dist --project-name haru0416-portfolio --branch main
