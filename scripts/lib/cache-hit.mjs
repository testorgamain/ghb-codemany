// @ts-check
/**
 * Did a warm job really start from restored saved files? (2026-11-02; since the per-run
 * scheme the files come from the same run's cold job, see scripts/env.sh)
 *
 * A warm number is only fair when its cache was restored: on 2026-10-31 (run 41189686531)
 * Codemany's warm Excalidraw build had no restore at all and was compared with GitHub's
 * restored one. Read from the job's top-level steps (composite steps are not in the API):
 *   1. `cache hit`  — bench.yml's marker step, runs only on a hit (from 2026-11-02).
 *   2. `save cache` — runs only on a miss, so `skipped` after a good build = hit
 *                     (older bench.yml runs and bench-private.yml).
 *   3. neither, on Codemany — bench.yml before #6 restored the GitHub side only, so a
 *      Codemany warm job of that era never had its cache restored: a miss.
 * Cold jobs, and anything we cannot prove, are null.
 */

/** @typedef {import('./types.mjs').ApiJob} ApiJob */
/** @typedef {import('./types.mjs').Mode} Mode */
/** @typedef {import('./types.mjs').Side} Side */

/** @param {ApiJob} job @param {string} name */
const stepOf = (job, name) => job.steps?.find((s) => s.name === name);

/** @param {ApiJob} job @param {Side} side @param {Mode} mode @returns {boolean|null} */
export function cacheHitOf(job, side, mode) {
  if (mode !== 'warm') return null;
  const marker = stepOf(job, 'cache hit');
  if (marker) return marker.conclusion === 'success';
  const save = stepOf(job, 'save cache');
  if (save) {
    if (save.conclusion !== 'skipped') return false;
    return stepOf(job, 'build')?.conclusion === 'success' ? true : null;
  }
  return side === 'codemany' ? false : null;
}
