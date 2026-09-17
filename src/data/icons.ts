// lucide のうちサイトで使うものだけを名前で引けるようにする。
// 作品にアイコンを足すときは https://lucide.dev/icons で名前を探し、ここに 1 行足す。
import Sprout from '@lucide/astro/icons/sprout';
import MessageCircle from '@lucide/astro/icons/message-circle';
import Scale from '@lucide/astro/icons/scale';
import Newspaper from '@lucide/astro/icons/newspaper';
import WandSparkles from '@lucide/astro/icons/wand-sparkles';
import Box from '@lucide/astro/icons/box';
import Code from '@lucide/astro/icons/code';
import ExternalLink from '@lucide/astro/icons/external-link';
import Cpu from '@lucide/astro/icons/cpu';

export const ICONS = {
  sprout: Sprout,
  'message-circle': MessageCircle,
  scale: Scale,
  newspaper: Newspaper,
  'wand-sparkles': WandSparkles,
  box: Box,
  code: Code,
  'external-link': ExternalLink,
  cpu: Cpu,
} as const;

export type IconName = keyof typeof ICONS;
export const SITE_ICON = Sprout;
