// @ts-check
/** Turns one GitHub job into one results.json row (2026-10-30; cacheHit 2026-11-02). */
import { cacheHitOf } from './cache-hit.mjs';

/** @typedef {import('./types.mjs').ApiJob} ApiJob */
/** @typedef {import('./types.mjs').ApiRun} ApiRun */
/** @typedef {import('./types.mjs').Project} Project */
/** @typedef {import('./types.mjs').RunRow} RunRow */
/** @typedef {import('./types.mjs').Side} Side */
/** @typedef {import('./types.mjs').Mode} Mode */
/** @typedef {import('./types.mjs').Conclusion} Conclusion */

/**
 * Bench job names are `<project> · <side> · <mode>` (see bench.yml; 2026-11-01:
 * bench-private.yml in codemanyhq/bench-private uses side `github-private`).
 */
const JOB_NAME = /^(.+) · (github-private|github|codemany) · (cold|warm)$/;
const CONCLUSIONS = new Set(['success', 'failure', 'cancelled']);

/** @param {string} name @returns {{ project: string, side: Side, mode: Mode } | null} */
export function parseJobName(name) {
  const m = JOB_NAME.exec(name.trim());
  if (!m) return null;
  return { project: m[1], side: /** @type {Side} */ (m[2]), mode: /** @type {Mode} */ (m[3]) };
}

/** Seconds between two ISO times, one decimal. @param {string} from @param {string} to */
export function seconds(from, to) {
  return Math.round((Date.parse(to) - Date.parse(from)) / 100) / 10;
}

/** Duration of the `build` step, only when it succeeded. @param {ApiJob} job */
function buildSeconds(job) {
  const step = job.steps?.find((s) => s.name === 'build');
  if (!step || step.conclusion !== 'success' || !step.started_at || !step.completed_at) return null;
  return seconds(step.started_at, step.completed_at);
}

/**
 * @param {ApiRun} run
 * @param {ApiJob} job
 * @param {Map<string, Project>} projects  by id
 * @returns {RunRow|null}  null for non-bench jobs (e.g. `plan`) and unfinished jobs
 */
export function toRow(run, job, projects) {
  const name = parseJobName(job.name);
  const project = name && projects.get(name.project);
  if (!name || !project || job.status !== 'completed') return null;
  if (!job.started_at || !job.completed_at || !CONCLUSIONS.has(job.conclusion ?? '')) return null;
  return {
    runId: run.id,
    jobId: job.id,
    runUrl: run.html_url,
    jobUrl: job.html_url,
    date: job.started_at,
    project: project.id,
    mode: name.mode,
    side: name.side,
    os: project.os,
    // GitHub's runner names are throwaway VMs; the runs-on label is the useful bit.
    runner: name.side === 'codemany' ? (job.runner_name ?? 'codemany') : (job.labels[0] ?? 'github'),
    queueSec: Math.max(0, seconds(job.created_at, job.started_at)),
    jobSec: seconds(job.started_at, job.completed_at),
    buildSec: buildSeconds(job),
    conclusion: /** @type {Conclusion} */ (job.conclusion),
    cacheHit: cacheHitOf(job, name.side, name.mode),
  };
}
