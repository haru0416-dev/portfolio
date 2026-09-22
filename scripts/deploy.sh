#!/bin/sh
set -eu
if [ -n "$(git status --porcelain)" ] && [ -z "${ALLOW_DIRTY:-}" ]; then
  echo "未コミットの変更があります。コミットするか、ALLOW_DIRTY=1 を付けて実行してください。" >&2
  git status --porcelain >&2
  exit 1
fi
astro build
wrangler pages deploy dist --project-name haru0416-portfolio --branch main
