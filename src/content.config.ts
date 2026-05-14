import { defineCollection } from 'astro:content';
import { fetchBlogContent } from '@lib/blog';
import { z } from 'astro/zod';

const blog = defineCollection({
  loader: async () => fetchBlogContent(),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    description: z.string().optional(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog };
