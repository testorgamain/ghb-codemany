// @ts-check
/** README fact tables built from data/projects.json and data/hardware.json (2026-10-30). */
import { table } from './blocks.mjs';

/** @typedef {import('./types.mjs').Code} Code */
/** @typedef {import('./types.mjs').GithubRunner} GithubRunner */
/** @typedef {import('./types.mjs').Hardware} Hardware */
/** @typedef {import('./types.mjs').Os} Os */
/** @typedef {import('./types.mjs').Project} Project */

/** @param {Os} os */
const osName = (os) => (os === 'macos' ? 'macOS' : 'Linux');
/** @param {number} gb */
const size = (gb) => (gb >= 1000 ? `${Math.round(gb / 100) / 10} TB` : `${gb} GB`);

/** GitHub's computers, grouped by whose code they run (2026-11-01). @type {{ code: Code, title: string }[]} */
const CODE_GROUPS = [
  { code: 'private', title: '**For private code**' },
  { code: 'public', title: '**For public code (free)**' },
];

/** "How we test": what gets built, exactly. @param {Project[]} projects */
export function projectsTable(projects) {
  return table(
    ['Project', 'Language', 'Computer', 'Build command', 'Exact commit'],
    projects.map((p) => [
      `[${p.name}](${p.url})${p.trial ? ' *(new: results appear after 3 clean nights)*' : ''}`,
      p.lang,
      osName(p.os),
      `\`${p.command}\``,
      `[\`${p.sha.slice(0, 7)}\`](https://github.com/${p.repo}/commit/${p.sha})`,
    ]),
  );
}

/** Plain words: "2 vCPU (x64)" → "2 cores", "3 vCPU (Apple M1)" → "3 cores (Apple M1)". @param {string} cpu */
function plainCores(cpu) {
  const n = /^\d+/.exec(cpu)?.[0];
  const chip = /Apple M\d+/.exec(cpu)?.[0];
  return n ? `${n} cores${chip ? ` (${chip})` : ''}` : cpu;
}

/** One table of GitHub computers for one kind of code. @param {GithubRunner[]} list */
function githubTable(list) {
  return table(
    ["GitHub's computer", "What's inside", 'Price per minute'],
    list.map((g) => [
      `\`${g.label}\` (${g.label.startsWith('macos') ? 'macOS' : 'Linux'})`,
      `${plainCores(g.cpu)}, ${size(g.ramGB)} memory, ${size(g.diskGB)} disk`,
      g.perMinuteUSD === 0 ? 'Free' : `[$${g.perMinuteUSD}](${g.source})`,
    ]),
  );
}

/** "The computers", in plain words (2026-11-01): what is inside, and where to get ours. @param {Hardware} hw */
export function computersTable(hw) {
  const ours = table(
    ['Our computer', "What's inside", 'Get one'],
    hw.codemany.map((m) => [
      `${m.name} (${osName(m.os)})`,
      `${m.cores} cores, ${size(m.ramGB)} memory, ${size(m.diskGB)} disk`,
      m.buyUrl ? `[Get one](${m.buyUrl})${m.buyNote ? ` (${m.buyNote})` : ''}` : '—',
    ]),
  );
  const theirs = CODE_GROUPS.flatMap(({ code, title }) => {
    const list = hw.github.filter((g) => g.code === code);
    return list.length > 0 ? [title, '', githubTable(list), ''] : [];
  });
  const first = hw.github[0];
  return [
    'You buy a Codemany computer once and keep it.',
    '',
    ours,
    '',
    'You rent a GitHub computer by the minute. What you get depends on your code.',
    '',
    ...theirs,
    `Checked ${first?.asOf ?? ''} on GitHub's [price list](${first?.source ?? ''}) and [computer list](${first?.specsSource ?? ''}).`,
  ].join('\n');
}
