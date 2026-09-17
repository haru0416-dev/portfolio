// lucide のうちサイトで使うものだけを名前で引けるようにする。
// 作品にアイコンを足すときは https://lucide.dev/icons で名前を探し、ここに 1 行足す。
import Sprout from '@lucide/astro/icons/sprout';
import MessageCircle from '@lucide/astro/icons/message-circle';
import Scale from '@lucide/astro/icons/scale';
import Newspaper from '@lucide/astro/icons/newspaper';
import WandSparkles from '@lucide/astro/icons/wand-sparkles';
import Dices from '@lucide/astro/icons/dices';
import Box from '@lucide/astro/icons/box';
import FlaskConical from '@lucide/astro/icons/flask-conical';
import Code from '@lucide/astro/icons/code';
import ExternalLink from '@lucide/astro/icons/external-link';
import Clock from '@lucide/astro/icons/clock';

export const ICONS = {
  sprout: Sprout,
  'message-circle': MessageCircle,
  scale: Scale,
  newspaper: Newspaper,
  'wand-sparkles': WandSparkles,
  dices: Dices,
  box: Box,
  'flask-conical': FlaskConical,
  code: Code,
  'external-link': ExternalLink,
  clock: Clock,
} as const;

export type IconName = keyof typeof ICONS;
export const SITE_ICON = Sprout;
