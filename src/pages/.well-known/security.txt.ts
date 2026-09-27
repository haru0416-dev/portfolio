// 脆弱性の連絡先(RFC 9116)。Expires は 1 年以内でなければならないので、ビルドのたびにその日から 1 年後にする。
import { SITE } from '../../site';

export function GET({ site }: { site: URL }) {
  const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  expires.setUTCHours(0, 0, 0, 0);
  const body = [
    `Contact: ${SITE.repo}/security/advisories/new`,
    `Expires: ${expires.toISOString()}`,
    'Preferred-Languages: ja, en',
    `Canonical: ${new URL('/.well-known/security.txt', site)}`,
  ].join('\n');
  return new Response(`${body}\n`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
