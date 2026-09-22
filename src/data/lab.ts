export type LabEntry = {
  slug: string;
  title: string;
  description: string;
  date: string;
};

export const LAB: LabEntry[] = [
  {
    slug: 'petals',
    title: 'Petals',
    description: '風に舞う桜の花びらを WebGPU で描いています。',
    date: '2026-09-17',
  },
];

export function labBySlug(slug: string): LabEntry {
  const entry = LAB.find((item) => item.slug === slug);
  if (!entry) throw new Error(`Lab に「${slug}」がありません。src/data/lab.ts に登録してください。`);
  return entry;
}

export function labFromPath(pathname: string): LabEntry | undefined {
  const slug = pathname.match(/^\/lab\/([^/]+)\/?$/)?.[1];
  return slug ? LAB.find((item) => item.slug === slug) : undefined;
}
