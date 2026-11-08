// @ts-check
/** Merges new rows into results.json's runs (2026-10-30). */

/** @typedef {import('./types.mjs').RunRow} RunRow */

/** How long rows are kept. */
export const KEEP_DAYS = 120;
const DAY_MS = 86_400_000;

/**
 * Dedupe by job id (a re-collected job replaces its old row), drop rows older than
 * keepDays, and sort oldest → newest so the file reads as an append-only log.
 * @param {RunRow[]} existing
 * @param {RunRow[]} incoming
 * @param {Date} now
 * @param {number} [keepDays]
 * @returns {RunRow[]}
 */
export function mergeRuns(existing, incoming, now, keepDays = KEEP_DAYS) {
  /** @type {Map<number, RunRow>} */
  const byJob = new Map();
  for (const row of [...existing, ...incoming]) byJob.set(row.jobId, row);
  const cutoff = now.getTime() - keepDays * DAY_MS;
  return [...byJob.values()]
    .filter((row) => Date.parse(row.date) >= cutoff)
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date) || a.jobId - b.jobId);
}
