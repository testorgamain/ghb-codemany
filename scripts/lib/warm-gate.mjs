// @ts-check
/**
 * Warm numbers only from restored caches (2026-11-02).
 *
 * A warm row counts only when its cache was restored (row.cacheHit === true, see
 * cache-hit.mjs). A project whose warm comparison lacks a hit on either side shows
 * "warming up" instead of a speed ratio, and stays out of the warm charts.
 */

/** @typedef {import('./types.mjs').ResultsFile} ResultsFile */
/** @typedef {import('./types.mjs').RunRow} RunRow */
/** @typedef {import('./types.mjs').Summary} Summary */

/** @param {RunRow} r */
const countsAsWarm = (r) => r.cacheHit === true;

/** Cold rows as they are; warm rows only with a restored cache. @param {ResultsFile} results @returns {ResultsFile} */
export function onlyRestoredWarm(results) {
  return { ...results, runs: results.runs.filter((r) => r.mode !== 'warm' || countsAsWarm(r)) };
}

/** Projects with a finished warm build that did not start from a restored cache. @param {ResultsFile} results */
export function unrestoredWarmProjects(results) {
  return new Set(results.runs
    .filter((r) => r.mode === 'warm' && r.buildSec != null && !countsAsWarm(r))
    .map((r) => r.project));
}

/**
 * Turns one-sided (or cache-less) warm comparisons into "warming up": no times, no ratio.
 * @param {Summary} warm  summarize() over onlyRestoredWarm() rows
 * @param {Set<string>} unrestored  from unrestoredWarmProjects()
 * @returns {Summary}
 */
export function markWarmingUp(warm, unrestored) {
  const projects = warm.projects.map((p) => {
    const oneSided = p.speedup == null && (p.github != null || p.codemany != null);
    const cacheLess = p.speedup == null && unrestored.has(p.id);
    if (!oneSided && !cacheLess) return p;
    return { ...p, github: null, codemany: null, speedup: null, githubCostUSD: null, codemanyCostUSD: null, trend: [], warmingUp: true };
  });
  return { ...warm, projects };
}
