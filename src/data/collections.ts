import { getCollection, type CollectionEntry } from 'astro:content';

export async function getPublishedPosts() {
  return (await getCollection('blog', ({ data }) => !data.draft))
    .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

export async function getWorks() {
  return (await getCollection('works')).sort((a, b) => a.data.order - b.data.order);
}

export const WORK_STATUS_LABELS = {
  active: '',
  wip: 'Work in progress',
  soon: 'Coming soon',
  archived: 'Archived',
} satisfies Record<CollectionEntry<'works'>['data']['status'], string>;
