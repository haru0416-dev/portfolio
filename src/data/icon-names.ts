export const ICON_NAMES = [
  'sprout',
  'message-circle',
  'scale',
  'newspaper',
  'wand-sparkles',
  'box',
  'code',
  'external-link',
  'cpu',
] as const;

export type IconName = (typeof ICON_NAMES)[number];
