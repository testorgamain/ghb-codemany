// @ts-check
/**
 * The README's summaries (2026-11-01). A site module that knows about code echoes
 * `code` in summarize()'s result: then the README shows private code first and public
 * code under "More numbers". An older module ignores `code`: today's single pair.
 */

import { markWarmingUp, onlyRestoredWarm, unrestoredWarmProjects } from './warm-gate.mjs';

/** @typedef {import('./types.mjs').BenchModules} BenchModules */
/** @typedef {import('./types.mjs').Code} Code */
/** @typedef {import('./types.mjs').Hardware} Hardware */
/** @typedef {import('./types.mjs').Mode} Mode */
/** @typedef {import('./types.mjs').Project} Project */
/** @typedef {import('./types.mjs').ResultsFile} ResultsFile */
/** @typedef {import('./types.mjs').Summaries} Summaries */

/**
 * @param {BenchModules} m
 * @param {ResultsFile} results
 * @param {Project[]} projects
 * @param {Hardware} hardware
 * @param {Date} now
 * @returns {Summaries}
 */
export function summarizeAll(m, results, projects, hardware, now) {
  // 2026-11-02: warm numbers only from restored caches (warm-gate.mjs).
  const counted = onlyRestoredWarm(results);
  const unrestored = unrestoredWarmProjects(results);
  /** @param {Mode} mode @param {Code} [code] */
  const run = (mode, code) => {
    const s = m.data.summarize(counted, projects, hardware, { mode, code, now });
    return mode === 'warm' ? markWarmingUp(s, unrestored) : s;
  };
  const probe = run('cold', 'private');
  if (probe.code !== 'private') return { main: { cold: probe, warm: run('warm') }, publicCode: null };
  return {
    main: { cold: probe, warm: run('warm', 'private') },
    publicCode: { cold: run('cold', 'public'), warm: run('warm', 'public') },
  };
}
