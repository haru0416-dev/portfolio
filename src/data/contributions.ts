// ほかの人のリポジトリへの貢献。取り込まれた PR と、報告して直った(直りつつある)Issue。About の Contributions に並べる。
// 載せるものは手で選ぶ(自動で並べると、題だけでは何をしたか分からないものまで出るため)。
// summary の `…` はコードとして表示する。
// 増えていく前提なので、ページでは新しい順に CONTRIBUTIONS_SHOWN 件だけ出し、残りは畳んでおく。

export const CONTRIBUTIONS_SHOWN = 4;

/** リポジトリと、それが何か(1 行)。 */
export const REPOS = {
  'lindera/lindera': { name: 'lindera', about: '多言語の形態素解析ライブラリ' },
  'yksr-melt/Meltype': { name: 'Meltype', about: '半角/全角の切り替えをなくす日本語入力' },
  'ccusage/ccusage': { name: 'ccusage', about: 'Claude Code などの使用量を集計する CLI' },
  'oven-sh/bun': { name: 'Bun', about: 'JavaScript のランタイム' },
  'niaka3dayo/agent-skills-vrc-udon': { name: 'agent-skills-vrc-udon', about: 'UdonSharp のコードを書く AI 向けのスキル集' },
  'ProjectTesca/MenSharp': { name: 'MenSharp', about: 'UdonSharp より C# に近い VRChat 向けのコンパイラ' },
} as const;

export type Contribution = {
  repo: keyof typeof REPOS;
  kind: 'pr' | 'issue';
  number: number;
  date: string;
  summary: string;
  /** まだ直っていないときだけ付ける。 */
  status?: string;
};

export const CONTRIBUTIONS: Contribution[] = [
  { repo: 'yksr-melt/Meltype', kind: 'pr', number: 512, date: '2026-10-12', summary: '日本語の途中の英単語で「つ」が崩れるのと、助詞の「と」で英単語が割れるのを直した' },
  { repo: 'ProjectTesca/MenSharp', kind: 'issue', number: 1, date: '2026-09-10', summary: '副作用のある呼び出しをまたぐと、先に計算した値がコード生成で失われるのを報告した。v0.1.1 で直った' },
  { repo: 'lindera/lindera', kind: 'pr', number: 922, date: '2026-08-16', summary: 'Node.js 版に、トークンを素のオブジェクトで返す `tokenizeObjects` を足した。大きな文書を続けて解析してもメモリが増え続けない' },
  { repo: 'lindera/lindera', kind: 'pr', number: 923, date: '2026-08-16', summary: 'SudachiDict を、汎用の辞書ビルダーだけで Lindera の辞書にする手順を書いた' },
  { repo: 'oven-sh/bun', kind: 'issue', number: 33593, date: '2026-07-07', summary: '子プロセスの IPC の `channel` に `ref` などがなく、execa の `execaNode()` が動かないのを報告した', status: '修正中' },
  { repo: 'ccusage/ccusage', kind: 'issue', number: 1105, date: '2026-05-20', summary: 'Codex のログを読む順番が決まらず、テストがたまに落ちるのを報告した。読む前に並べ替える形で直った' },
  { repo: 'niaka3dayo/agent-skills-vrc-udon', kind: 'issue', number: 164, date: '2026-04-30', summary: '`--force` を付けずに入れ直すと、古いファイルが残ったまま版だけ上がるのを、再現手順と直し方を付けて報告した' },
  { repo: 'niaka3dayo/agent-skills-vrc-udon', kind: 'issue', number: 165, date: '2026-04-30', summary: '`jq` が入っていない環境で、コードを検証するフックが正しく動かないのを報告した' },
];
