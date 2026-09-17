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
    description: '桜の花びらが、風に乗って舞う。WebGPU で数千枚。',
    date: '2026-09-17',
  },
];
