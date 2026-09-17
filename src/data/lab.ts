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
    description: '桜の花びらが風に乗って舞う。WebGPU で描く。',
    date: '2026-09-17',
  },
];
