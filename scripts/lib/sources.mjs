// @ts-check
/**
 * Where bench runs come from (2026-11-01).
 *  - public:  this repo's bench.yml, nightly: GitHub's computers for public code + Codemany.
 *  - private: codemanyhq/bench-private's bench-private.yml, weekly: the same Linux builds
 *             on GitHub's smaller computer for private code (the only way to time it).
 *             Read with BENCH_PRIVATE_TOKEN (fine-grained, Actions: read on that repo,
 *             used for nothing else). No token = skipped, silently.
 */

/** @typedef {import('./types.mjs').BenchSource} BenchSource */

export const PRIVATE_REPO = 'codemanyhq/bench-private';

/** @returns {BenchSource} */
export function publicSource() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN is not set');
  return {
    repo: process.env.GITHUB_REPOSITORY || 'codemanyhq/bench',
    workflow: 'bench.yml',
    token,
    sides: ['github', 'codemany'],
    useRunId: true,
  };
}

/** @returns {BenchSource|null} null when BENCH_PRIVATE_TOKEN is not set */
export function privateSource() {
  const token = (process.env.BENCH_PRIVATE_TOKEN || '').trim();
  if (!token) return null;
  return { repo: PRIVATE_REPO, workflow: 'bench-private.yml', token, sides: ['github-private'], useRunId: false };
}

/** A job in the private repo: only we can open its link. @param {string} url */
export function isPrivateJobUrl(url) {
  return url.startsWith(`https://github.com/${PRIVATE_REPO}/`);
}
