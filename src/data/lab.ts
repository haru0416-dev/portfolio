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
