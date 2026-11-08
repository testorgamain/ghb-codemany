#!/usr/bin/env node
// @ts-check
/**
 * collect — reads bench runs from the GitHub API and appends their jobs to
 * data/results.json (2026-10-30).
 *
 *   BENCH_RUN_ID=<id> node scripts/collect.mjs   one bench.yml run (collect.yml passes it)
 *   node scripts/collect.mjs                      the last 10 completed bench runs
 *
 * Env: GITHUB_TOKEN (actions: read), GITHUB_REPOSITORY (default codemanyhq/bench).
 * 2026-11-01: with BENCH_PRIVATE_TOKEN set, also the last 10 runs of
 * codemanyhq/bench-private's bench-private.yml (side `github-private`, see lib/sources.mjs);
 * without it, those are skipped. A failing private read only warns: public results still land.
 * Per job: queueSec = created→started, jobSec = started→completed, buildSec = the
 * `build` step. Rows are deduped by job id, kept for 120 days, newest last.
 */
import path from 'node:path';
import { dataDir, readJson, writeJson } from './lib/files.mjs';
import { getRun, listJobs, listRecentRuns } from './lib/github.mjs';
import { toRow } from './lib/rows.mjs';
import { privateSource, publicSource } from './lib/sources.mjs';
import { mergeRuns } from './lib/store.mjs';

/** @typedef {import('./lib/types.mjs').ApiRun} ApiRun */
/** @typedef {import('./lib/types.mjs').BenchSource} BenchSource */
/** @typedef {import('./lib/types.mjs').Project} Project */
/** @typedef {import('./lib/types.mjs').ResultsFile} ResultsFile */
/** @typedef {import('./lib/types.mjs').RunRow} RunRow */

const RECENT_RUNS = 10;
/** Both bench workflows only have these triggers; anything else is not ours to trust. */
const TRUSTED_EVENTS = new Set(['schedule', 'workflow_dispatch']);

/** @param {BenchSource} src @returns {Promise<ApiRun[]>} */
async function runsToCollect(src) {
  const id = src.useRunId ? (process.env.BENCH_RUN_ID || process.argv[2] || '').trim() : '';
  if (!id) return listRecentRuns(src, RECENT_RUNS);
  if (!/^\d+$/.test(id)) throw new Error(`run id must be a number, got "${id}"`);
  return [await getRun(src, Number(id))];
}

/** @param {BenchSource} src @param {ApiRun} run */
function isBenchRun(src, run) {
  return run.path.startsWith(`.github/workflows/${src.workflow}`)
    && run.status === 'completed'
    && TRUSTED_EVENTS.has(run.event);
}

/** @param {BenchSource} src @param {Map<string, Project>} projects @returns {Promise<RunRow[]>} */
async function collectRows(src, projects) {
  /** @type {RunRow[]} */
  const rows = [];
  for (const run of await runsToCollect(src)) {
    if (!isBenchRun(src, run)) {
      console.warn(`skip ${src.repo} run ${run.id}: not a finished scheduled/dispatched ${src.workflow} run`);
      continue;
    }
    for (const job of await listJobs(src, run.id)) {
      const row = toRow(run, job, projects);
      // Each repo may only report its own sides (bench-private can't add Codemany rows).
      if (row && src.sides.includes(row.side)) rows.push(row);
    }
  }
  return rows;
}

/** Private-code rows, or none (no token, or the read failed). @param {Map<string, Project>} projects */
async function privateRows(projects) {
  const src = privateSource();
  if (!src) return [];
  try {
    const rows = await collectRows(src, projects);
    console.log(`collected ${rows.length} jobs from ${src.repo}`);
    return rows;
  } catch (err) {
    console.warn(`::warning::${src.repo} not read: ${err instanceof Error ? err.message : String(err)}`);
    return [];
  }
}

async function main() {
  const dir = dataDir();
  const resultsFile = path.join(dir, 'results.json');
  /** @type {ResultsFile} */
  const results = await readJson(resultsFile);
  /** @type {Project[]} */
  const projectList = await readJson(path.join(dir, 'projects.json'));
  const projects = new Map(projectList.map((p) => [p.id, p]));

  const rows = [...await collectRows(publicSource(), projects), ...await privateRows(projects)];
  const now = new Date();
  /** @type {ResultsFile} */
  const next = {
    schema: 1,
    updatedAt: rows.length > 0 ? now.toISOString() : results.updatedAt,
    runs: mergeRuns(results.runs, rows, now),
  };
  await writeJson(resultsFile, next);
  console.log(`collected ${rows.length} jobs; results.json now holds ${next.runs.length} rows`);
}

main().catch((err) => {
  console.error(`::error::collect failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
