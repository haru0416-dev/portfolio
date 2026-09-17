// curl / wget / HTTPie で来たときだけ、HTML の代わりに名刺のような 1 枚のテキストを返す。
// ブラウザには影響しない。curl でも ?html を付ければ HTML が取れる。
// Cloudflare Pages Functions として dist と一緒に配信される。

type Meta = {
  name: string; tagline: string; github: string;
  posts: { title: string; date: string; path: string }[];
  works: { name: string; status: string; url: string | null }[];
  lab: { title: string; description: string; path: string }[];
};

const CLI = /^(curl|wget|httpie|xh|aria2|fetch)\b/i;

export const onRequest: PagesFunction = async (ctx) => {
  const req = ctx.request;
  const url = new URL(req.url);
  const ua = req.headers.get('user-agent') ?? '';
  const accept = req.headers.get('accept') ?? '';
  const wantsText = CLI.test(ua) && !accept.includes('text/html') && !url.searchParams.has('html');
  if (!wantsText || url.pathname !== '/') return ctx.next();

  const meta = (await (await ctx.env.ASSETS.fetch(new URL('/meta.json', url))).json()) as Meta;
  const color = !url.searchParams.has('plain') && !/\bwget\b/i.test(ua);
  const body = render(meta, url.origin, color);
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=300', Vary: 'User-Agent, Accept' },
  });
};

/** 端末の幅(表示上の列数)。全角は 2、半角は 1 として数える */
const width = (s: string) => [...s].reduce((n, c) => n + (/[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/.test(c) ? 2 : 1), 0);
const pad = (s: string, w: number) => s + ' '.repeat(Math.max(0, w - width(s)));

function render(m: Meta, origin: string, color: boolean) {
  const c = color
    ? { b: (s: string) => `\x1b[1m${s}\x1b[0m`, p: (s: string) => `\x1b[38;2;242;109;153m${s}\x1b[0m`, d: (s: string) => `\x1b[2m${s}\x1b[0m` }
    : { b: (s: string) => s, p: (s: string) => s, d: (s: string) => s };
  const L = (label: string, text: string) => `  ${c.d(pad(label, 8))}${text}`;
  const lines: string[] = [];
  lines.push('');
  lines.push(`  ${c.b(m.name)}${c.p('.')}`);
  lines.push(`  ${m.tagline}`);
  lines.push('');
  const tw = Math.max(...m.posts.map((p) => width(p.title)));
  m.posts.forEach((p, i) => lines.push(L(i === 0 ? 'blog' : '', `${pad(p.title, tw)}  ${c.d(p.date.replaceAll('-', '.'))}`)));
  lines.push('');
  lines.push(L('works', m.works.map((w) => (w.status === 'soon' ? c.d(`${w.name} (soon)`) : w.name)).join(c.d(' · '))));
  m.lab.forEach((l, i) => lines.push(L(i === 0 ? 'lab' : '', `${l.title}  ${c.d(l.description)}`)));
  lines.push('');
  lines.push(L('web', `${origin}/`));
  lines.push(L('rss', `${origin}/rss.xml`));
  lines.push(L('github', m.github));
  lines.push('');
  lines.push(`  ${c.d('curl に ?html を付けると HTML、?plain を付けると色なし')}`);
  lines.push('');
  return lines.join('\n') + '\n';
}
