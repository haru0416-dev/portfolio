# portfolio

Personal site for haru. Live at [haru0416.dev](https://haru0416.dev/).

## Stack

Astro 6 · Bun · Biome · Cloudflare Workers Static Assets · TypeScript.

## Local

```sh
bun install
bun run dev
```

## Deploy

Pushes to `main` trigger `.github/workflows/deploy.yml`, which builds with Bun and runs `wrangler deploy`.

Content is fetched at build time from [`haru-content`](https://github.com/haru0416-dev/haru-content) and Zenn RSS.
