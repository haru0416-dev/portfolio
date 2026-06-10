import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import satori from 'satori';

const WIDTH = 1200;
const HEIGHT = 630;
const FONT_PATH = 'src/assets/fonts/NotoSerifJP-Medium.otf';

let fontData: Buffer | null = null;

async function loadFont(): Promise<Buffer> {
  if (!fontData) {
    fontData = await readFile(path.join(process.cwd(), FONT_PATH));
  }
  return fontData;
}

export interface OgInput {
  title: string;
  date?: string;
  subtitle?: string;
}

type SatoriNode = {
  type: string;
  props: {
    style?: Record<string, unknown>;
    children?: unknown;
  };
};

function div(style: Record<string, unknown>, children?: unknown): SatoriNode {
  return { type: 'div', props: { style: { display: 'flex', ...style }, children } };
}

function buildTree({ title, date, subtitle }: OgInput): SatoriNode {
  const titleSize = title.length > 60 ? 48 : title.length > 40 ? 56 : 68;

  return div(
    {
      width: '100%',
      height: '100%',
      flexDirection: 'column',
      justifyContent: 'space-between',
      backgroundColor: '#ffffff',
      color: '#111111',
      padding: '64px 72px',
      fontFamily: 'Noto Serif JP',
    },
    [
      div(
        {
          justifyContent: 'space-between',
          alignItems: 'baseline',
          paddingBottom: 28,
          borderBottom: '1px solid #e2e2e2',
          fontSize: 28,
          color: '#6b6b6b',
        },
        [div({}, 'haru0416.dev'), div({}, date ?? '')],
      ),
      div({ flexDirection: 'column', flexGrow: 1, justifyContent: 'center' }, [
        div(
          {
            fontSize: titleSize,
            lineHeight: 1.45,
            letterSpacing: '0.01em',
            lineClamp: 3,
          },
          title,
        ),
        ...(subtitle ? [div({ marginTop: 24, fontSize: 30, color: '#6b6b6b' }, subtitle)] : []),
      ]),
      div(
        {
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingTop: 28,
          borderTop: '1px solid #e2e2e2',
          fontSize: 28,
          color: '#6b6b6b',
        },
        [div({}, 'haru'), div({ width: 36, height: 4, backgroundColor: '#b8332a' })],
      ),
    ],
  );
}

export async function renderOgPng(input: OgInput): Promise<Uint8Array> {
  const font = await loadFont();
  const svg = await satori(buildTree(input), {
    width: WIDTH,
    height: HEIGHT,
    fonts: [{ name: 'Noto Serif JP', data: font, weight: 500, style: 'normal' }],
  });
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: WIDTH } }).render().asPng();
  return new Uint8Array(png);
}
