import { defineCollection } from 'astro:content';
import { fetchBlogContent } from '@lib/blog';
import { z } from 'astro/zod';

const blog = defineCollection({
  loader: {
    name: 'haru-content-blog',
    async load({ store, renderMarkdown, parseData, generateDigest, logger }) {
      const entries = await fetchBlogContent();
      store.clear();
      for (const entry of entries) {
        const data = await parseData({
          id: entry.id,
          data: {
            title: entry.title,
            date: entry.date,
            description: entry.description,
            draft: entry.draft ?? false,
          },
          filePath: entry.filePath,
        });
        const rendered = await renderMarkdown(entry.body);
        store.set({
          id: entry.id,
          data,
          body: entry.body,
          filePath: entry.filePath,
          digest: generateDigest(entry.body),
          rendered,
        });
      }
      logger.info(`Loaded ${entries.length} blog entr${entries.length === 1 ? 'y' : 'ies'}`);
    },
  },
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    description: z.string().optional(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog };
