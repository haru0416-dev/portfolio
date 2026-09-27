import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';
import { ICON_NAMES } from './data/icon-names';
import { LAB } from './data/lab';

const labPages = readdirSync(join(process.cwd(), 'src/pages/lab'))
  .filter((file) => file.endsWith('.astro') && file !== 'index.astro')
  .map((file) => file.slice(0, -'.astro'.length));
// 登録だけあってページがないと、Lab の一覧から 404 へつながる。逆にページだけあるときは labBySlug() が止める。
const missingPages = LAB.map((entry) => entry.slug).filter((slug) => !labPages.includes(slug));
if (missingPages.length) throw new Error(`Lab に登録があるのにページがありません: ${missingPages.join(', ')}。src/pages/lab/ にページを置いてください。`);

const blog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

const works = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/works' }),
  schema: ({ image }) => z.object({
    name: z.string(),
    summary: z.string(),
    stack: z.array(z.string()),
    icon: z.enum(ICON_NAMES).default('box'),
    cover: image().optional(),
    repo: z.url().optional(),
    url: z.url().optional(),
    issues: z.url().optional(),
    status: z.enum(['active', 'wip', 'soon', 'archived']).default('active'),
    order: z.number().default(100),
  }),
});

export const collections = { blog, works };
