// @ts-check
/**
 * Loads the shared chart modules that codemany.com/benchmarks itself uses, so the README
 * charts and the website are drawn by the very same code (2026-10-30).
 *
 * Default: download bench-data.js + bench-chart.js (and every `./x.js` they import) from
 * MODULES_BASE into a fresh temp folder. BENCH_MODULES_DIR=<dir> uses a local copy instead.
 */
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/** @typedef {import('./types.mjs').BenchModules} BenchModules */

export const MODULES_BASE = 'https://codemany.com/benchmarks/';
const ENTRIES = ['bench-data.js', 'bench-chart.js'];
/** Relative sibling imports only: `from './bench-svg.js'` or `import './x.js'`. */
const SIBLING_IMPORT = /(?:from|import)\s*['"]\.\/([\w-]+(?:\.[\w-]+)*\.js)['"]/g;

/** @param {string} dir */
async function download(dir) {
  const queue = [...ENTRIES];
  const seen = new Set();
  while (queue.length > 0) {
    const name = /** @type {string} */ (queue.shift());
    if (seen.has(name)) continue;
    seen.add(name);
    const res = await fetch(MODULES_BASE + name);
    if (!res.ok) throw new Error(`${MODULES_BASE}${name} → HTTP ${res.status}`);
    const code = await res.text();
    await writeFile(path.join(dir, name), code);
    for (const m of code.matchAll(SIBLING_IMPORT)) queue.push(m[1]);
  }
}

/** @returns {Promise<BenchModules>} */
export async function loadModules() {
  let dir = process.env.BENCH_MODULES_DIR;
  if (!dir) {
    dir = await mkdtemp(path.join(tmpdir(), 'bench-modules-'));
    await download(dir);
  }
  const url = (/** @type {string} */ name) => pathToFileURL(path.join(/** @type {string} */ (dir), name)).href;
  return { data: await import(url('bench-data.js')), chart: await import(url('bench-chart.js')) };
}
