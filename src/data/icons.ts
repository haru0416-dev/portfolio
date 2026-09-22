import { ICON_NAMES, type IconName } from './icon-names';

import Sprout from '@lucide/astro/icons/sprout';
import MessageCircle from '@lucide/astro/icons/message-circle';
import Scale from '@lucide/astro/icons/scale';
import Newspaper from '@lucide/astro/icons/newspaper';
import WandSparkles from '@lucide/astro/icons/wand-sparkles';
import Box from '@lucide/astro/icons/box';
import Code from '@lucide/astro/icons/code';
import ExternalLink from '@lucide/astro/icons/external-link';
import Cpu from '@lucide/astro/icons/cpu';
import Bug from '@lucide/astro/icons/bug';

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
  bug: Bug,
} as const;


export type { IconName };
export { ICON_NAMES };

const registered = Object.keys(ICONS);
if (registered.length !== ICON_NAMES.length || ICON_NAMES.some((name) => !registered.includes(name))) {
  throw new Error('ICON_NAMES と ICONS が一致しません。');
}
export const SITE_ICON = Sprout;
