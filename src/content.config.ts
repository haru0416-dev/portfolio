import { defineCollection, z } from 'astro:content';
import { glob, file } from 'astro/loaders';

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
  loader: file('./src/content/works.json'),
  schema: z.object({
    name: z.string(),
    summary: z.string(),
    stack: z.array(z.string()),
    repo: z.string().url().optional(),
    url: z.string().url().optional(),
    status: z.enum(['active', 'wip', 'archived']).default('active'),
    order: z.number().default(100),
  }),
});

export const collections = { blog, works };
