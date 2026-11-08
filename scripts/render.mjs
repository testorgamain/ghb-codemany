#!/usr/bin/env node
// @ts-check
/**
 * render — redraws charts/*.svg and the README's generated blocks from data/ (2026-10-30).
 *
 * Charts come from the shared modules on codemany.com/benchmarks (see lib/modules.mjs),
 * so the README and the website always draw the same thing. If those modules cannot be
 * loaded, the old charts and results block are kept and we exit 0 with a warning.
 *
 * Env (testing): BENCH_DATA_DIR (fixture data), BENCH_MODULES_DIR (local modules),
 * BENCH_NOW (pretend "now", ISO-8601).
 */
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { replaceBlock } from './lib/blocks.mjs';
import { ROOT, dataDir, readJson, writeText } from './lib/files.mjs';
import { loadModules } from './lib/modules.mjs';
import { placeholderSVG } from './lib/placeholder.mjs';
import { codeResultsBlock } from './lib/results-code-md.mjs';
import { NO_RESULTS, resultsBlock } from './lib/results-md.mjs';
import { summarizeAll } from './lib/summaries.mjs';
import { computersTable, projectsTable } from './lib/tables.mjs';

/** @typedef {import('./lib/types.mjs').BenchModules} BenchModules */
/** @typedef {import('./lib/types.mjs').Hardware} Hardware */
/** @typedef {import('./lib/types.mjs').Project} Project */
/** @typedef {import('./lib/types.mjs').ResultsFile} ResultsFile */
/** @typedef {import('./lib/types.mjs').Summaries} Summaries */
/** @typedef {import('./lib/types.mjs').Summary} Summary */
/** @typedef {import('./lib/types.mjs').ThemeName} ThemeName */
/** @typedef {{ results: ResultsFile, projects: Project[], hardware: Hardware }} Data */

const README = path.join(ROOT, 'README.md');
const CHARTS = path.join(ROOT, 'charts');
const WIDTH = 840;
/** @type {ThemeName[]} */
const THEMES = ['light', 'dark'];

/** @param {Summary} s */
const hasNumbers = (s) => s.projects.some((p) => p.github || p.codemany);

/** Speed charts with no numbers yet. @returns {Map<string, string>} */
function placeholderCharts() {
  const files = new Map();
  for (const theme of THEMES) for (const mode of ['cold', 'warm']) {
    files.set(`speed-${mode}-${theme}.svg`, placeholderSVG(theme,
      'Results arrive after the first nightly run', 'Every night at 03:17 UTC · GitHub vs Codemany'));
  }
  return files;
}

/** Every chart + the results block, all in memory first. @param {BenchModules} m @param {Data} d */
function draw(m, d) {
  const now = process.env.BENCH_NOW ? new Date(process.env.BENCH_NOW) : new Date();
  // 2026-11-01: trial projects run every night but stay out of the published numbers
  // until they have proven stable (data/projects.json "trial": true).
  const published = d.projects.filter((p) => !p.trial);
  // 2026-11-01: private code first when the site module knows about code (summaries.mjs).
  const sums = summarizeAll(m, d.results, published, d.hardware, now);
  const { cold, warm } = sums.main;
  if (!hasNumbers(cold) && !hasNumbers(warm)) return { files: placeholderCharts(), block: NO_RESULTS };
  const files = placeholderCharts();
  for (const theme of THEMES) {
    if (hasNumbers(cold)) files.set(`speed-cold-${theme}.svg`, m.chart.barsSVG(cold, { width: WIDTH, theme }));
    if (hasNumbers(warm)) files.set(`speed-warm-${theme}.svg`, m.chart.barsSVG(warm, { width: WIDTH, theme }));
    // 2026-11-02: no warm pair with restored caches on both sides yet (lib/warm-gate.mjs).
    else if (warm.projects.some((p) => p.warmingUp)) files.set(`speed-warm-${theme}.svg`, placeholderSVG(theme,
      'Warming up: saved files arrive after the next run', 'Warm builds count only when the saved cache was restored'));
    for (const p of cold.projects.filter((x) => x.trend.length > 0)) {
      files.set(`trend-${p.id}-${theme}.svg`, m.chart.trendSVG(p, { width: WIDTH, height: 220, theme }));
    }
  }
  const block = sums.publicCode
    ? codeResultsBlock(sums.main, sums.publicCode, m.data, now)
    : resultsBlock(cold, warm, m.data);
  return { files, block };
}

/** @returns {Promise<{ files: Map<string, string>, block: string } | null>} null = keep old files */
async function chartsAndBlock(/** @type {Data} */ d) {
  if (d.results.runs.length === 0) return { files: placeholderCharts(), block: NO_RESULTS };
  try {
    return draw(await loadModules(), d);
  } catch (err) {
    console.warn(`::warning::charts not redrawn, old files kept: ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

async function main() {
  const dir = dataDir();
  /** @type {Data} */
  const d = {
    results: await readJson(path.join(dir, 'results.json')),
    projects: await readJson(path.join(dir, 'projects.json')),
    hardware: await readJson(path.join(dir, 'hardware.json')),
  };
  let readme = await readFile(README, 'utf8');
  readme = replaceBlock(readme, 'projects', projectsTable(d.projects));
  readme = replaceBlock(readme, 'computers', computersTable(d.hardware));

  const out = await chartsAndBlock(d);
  if (out) {
    for (const [name, svg] of out.files) await writeText(path.join(CHARTS, name), svg);
    readme = replaceBlock(readme, 'bench', out.block);
  }
  await writeText(README, readme);
  console.log(out ? `rendered ${out.files.size} charts` : 'README fact tables updated; charts kept');
}

main().catch((err) => {
  console.error(`::error::render failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
