export type LabEntry = {
  slug: string;
  title: string;
  description: string;
  date: string;
};

export const LAB: LabEntry[] = [
  {
    slug: 'flow-field',
    title: 'Flow Field',
    description: 'ノイズで作ったベクトル場に粒子を流す。クリックで場を作り直す。',
    date: '2026-09-17',
  },
];
