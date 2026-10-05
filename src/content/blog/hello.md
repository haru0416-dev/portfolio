---
title: このサイトについて
description: 自己表現の場として、Astro と Cloudflare Pages で個人サイトを作りました。
pubDate: 2026-09-17
tags: [meta, astro]
---

作ったツールや開発メモを置く個人サイトを作りました。いちばんの目的は自己表現です。

## 置いているもの

記事は [Blog](/blog/)、作ったツールは [Works](/works/)、ブラウザで動かせる実験は [Lab](/lab/) に置いています。Blog は Markdown で書けばそのままページになります。Works には代表作を数点だけ選んで載せていて、Lab は 1 ページに 1 つずつです。

## なぜ Astro と Cloudflare なのか

AI がない頃から HTML を手で書いてきたこともあって、サイトは SSG（Static Site Generator）で作るのがいちばんだと思っています。そして SSG で書くなら Astro だよな、というのが個人的な価値観です。

Next.js も、その頃に書いていました。ただ個人的に React が好きではなく、Next.js は重くて無駄が多くなりがちで、管理も大変なので苦手でした。

Pages Router から App Router に移る話や、CVE の件でも「あぁ〜」という気持ちになりました。いちばん大きかったのは、AI がまだ今ほど強くなかった頃に出た、middleware で認証をすり抜けられる脆弱性（CVE-2025-29927）です。そのあと React Server Components の脆弱性（CVE-2025-55182）も出ました。

Vercel は嫌いではないですし、作っているものもいいと思っています。ただ、Vercel にデプロイしてね、という圧が強いのはちょっと…と思っています。

コストと速度を考えると Cloudflare がかなり強く、Astro との相性もいいので、Astro で静的に生成して Cloudflare Pages から配信する形にしました。
