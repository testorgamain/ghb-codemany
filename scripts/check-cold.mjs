#!/usr/bin/env node
// @ts-check
/**
 * check-cold — fails the bench run when a cache could warm a "from scratch" (cold) build
 * on one side and not the other (2026-11-03). bench.yml's plan job runs it first.
 *
 * Why: GitHub starts every job on a fresh computer, and the plan job empties GitHub's cache
 * service. A Codemany machine keeps state between jobs (its own job cache serves
 * actions/cache on codemany-linux-01, plus Docker images and the tool cache), and the plan
 * job can't empty that. So a cold build must never ask any cache for anything:
 *   - no `restore-keys` anywhere (a prefix could match an earlier run's save);
 *   - no combined actions/cache (it restores in every mode); actions/cache/restore only
 *     when BENCH_MODE is warm;
 *   - setup-node / setup-go: their own cache explicitly off; setup-python / setup-java:
 *     no `cache:` value; get-cmake: local and cloud cache off;
 *   - no action that caches on its own (rust-cache, setup-gradle, sccache, ccache);
 *   - scripts/env.sh: per-run keys, and a plain buildkitd.toml for cold Docker builders
 *     (else BuildKit pulls through a Codemany machine's Docker Hub mirror).
 * Usage: node scripts/check-cold.mjs   (from the repo root; exit 1 on any problem)
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

/** One workflow step: where it starts and its lines. @typedef {{ file: string, line: number, text: string }} Step */
/** One rule: a name and a check that returns a problem, or null. @typedef {{ test: (s: Step) => string|null }} Rule */

/** Lines that start a step (`- uses:`, `- name:` ...), never a matrix or cron list item. */
const STEP_START = /^(\s*)- (uses|name|id|if|run|shell|with|env|working-directory):/;
const CACHING_ACTIONS = ['Swatinem/rust-cache', 'gradle/actions/setup-gradle', 'gradle/gradle-build-action',
  'mozilla-actions/sccache-action', 'hendrikmuhs/ccache-action'];

/** @param {string} line */
const indent = (line) => line.length - line.trimStart().length;

/** Every step of one YAML file, split by indentation. @param {string} file @returns {Step[]} */
export function stepsOf(file) {
  const lines = readFileSync(file, 'utf8').split('\n');
  /** @type {Step[]} */
  const out = [];
  for (let i = 0; i < lines.length; i += 1) {
    const m = STEP_START.exec(lines[i]);
    if (!m) continue;
    const ind = m[1].length;
    let j = i + 1;
    while (j < lines.length && (lines[j].trim() === '' || indent(lines[j]) > ind)) j += 1;
    out.push({ file, line: i + 1, text: lines.slice(i, j).join('\n') });
  }
  return out;
}

/** @param {Step} s @param {string} action */
const uses = (s, action) => new RegExp(`uses:\\s*${action.replace(/[/.]/g, '\\$&')}@`).test(s.text);
/** A `key: value` inside the step, or null. @param {Step} s @param {string} key */
const value = (s, key) => new RegExp(`^\\s*${key}:\\s*(.*?)\\s*(#.*)?$`, 'm').exec(s.text)?.[1] ?? null;
const OFF = new Set(['false', "''", '""', '']);

/** @type {Rule[]} */
const RULES = [
  { test: (s) => (/restore-keys/.test(s.text) ? 'restore-keys can match an earlier run\'s save' : null) },
  { test: (s) => (uses(s, 'actions/cache') ? 'actions/cache restores in every mode: use actions/cache/restore (warm only) + actions/cache/save' : null) },
  { test: (s) => (uses(s, 'actions/cache/restore') && !/if:.*BENCH_MODE == 'warm'/.test(s.text)
    ? 'actions/cache/restore must run only when BENCH_MODE is warm' : null) },
  { test: (s) => (uses(s, 'actions/setup-node') && value(s, 'package-manager-cache') !== 'false'
    ? 'setup-node needs `package-manager-cache: false`' : null) },
  { test: (s) => (uses(s, 'actions/setup-go') && value(s, 'cache') !== 'false' ? 'setup-go needs `cache: false`' : null) },
  { test: (s) => ((uses(s, 'actions/setup-python') || uses(s, 'actions/setup-java') || uses(s, 'actions/setup-node'))
    && !OFF.has(value(s, 'cache') ?? '') ? 'this setup action must not set `cache:`' : null) },
  { test: (s) => (uses(s, 'lukka/get-cmake') && (value(s, 'useLocalCache') !== 'false' || value(s, 'useCloudCache') !== 'false')
    ? 'get-cmake needs `useLocalCache: false` and `useCloudCache: false`' : null) },
  { test: (s) => (CACHING_ACTIONS.some((a) => uses(s, a)) ? 'this action caches on its own' : null) },
];

/** Problems in scripts/env.sh, the one place cache keys and Docker builders are made. @param {string} root */
function envProblems(root) {
  const env = readFileSync(path.join(root, 'scripts/env.sh'), 'utf8');
  const out = [];
  if (!/BENCH_CACHE_KEY "bench-run-.*\$\{GITHUB_RUN_ID:\?\}"/.test(env)) out.push('per-run cache keys must end with the run id');
  if (!/BENCH_MODE" == cold \]\]; then[\s\S]{0,200}--buildkitd-config/.test(env)) out.push('cold Docker builders need a plain --buildkitd-config');
  return out.map((p) => `scripts/env.sh: ${p}`);
}

/**
 * Workflows that measure nothing (2026-11-04): canary.yml is the Codemany release gate's
 * save-then-restore check in ONE run (bench#13), never a bench build, so its restores need
 * no warm-only guard. Listed by name so a new workflow is still checked by default.
 * 2026-11-05: canary-mac.yml too (bench#19): the Mac part of the same gate, called only
 * by canary.yml; its pcm-save -> pcm-restore pair is the same one-run check.
 */
const NOT_BENCH = new Set(['canary.yml', 'canary-mac.yml']);

/** @param {string} root @returns {string[]} */
export function problems(root) {
  const wf = path.join(root, '.github/workflows');
  const actions = path.join(root, '.github/actions');
  const files = [
    ...readdirSync(wf).filter((f) => f.endsWith('.yml') && !NOT_BENCH.has(f)).map((f) => path.join(wf, f)),
    ...readdirSync(actions).map((d) => path.join(actions, d, 'action.yml')).filter((f) => existsSync(f)),
  ];
  const out = files.flatMap(stepsOf).flatMap((s) => RULES.map((r) => r.test(s))
    .filter((p) => p !== null).map((p) => `${path.relative(root, s.file)}:${s.line}: ${p}`));
  return [...out, ...envProblems(root)];
}

const found = problems(process.cwd());
for (const p of found) console.log(`::error::${p}`);
console.log(found.length ? `check-cold: ${found.length} problem(s)` : 'check-cold: cold builds ask no cache for anything');
process.exit(found.length ? 1 : 0);
