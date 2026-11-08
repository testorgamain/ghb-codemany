// @ts-check
/** README result tables shared by both results blocks (2026-11-01, split from results-md.mjs). */
import { picture, table } from './blocks.mjs';

/** @typedef {import('./types.mjs').DataModule} DataModule */
/** @typedef {import('./types.mjs').ProjectSummary} ProjectSummary */
/** @typedef {import('./types.mjs').Summary} Summary */

/**
 * How one block shows the GitHub side of each row.
 * @typedef {object} TableView
 * @property {(p: ProjectSummary) => string} githubTime  the GitHub time cell (may carry a † mark)
 * @property {(p: ProjectSummary) => string} proof       the "Check it" cell
 * @property {boolean} price                             show the "GitHub price¹" column
 */

/** "[GitHub](job) · [Codemany](job)": every number links to its real run. @param {ProjectSummary} p */
export function proofLinks(p) {
  const links = [];
  if (p.github) links.push(`[GitHub](${p.github.lastJobUrl})`);
  if (p.codemany) links.push(`[Codemany](${p.codemany.lastJobUrl})`);
  return links.join(' · ') || '—';
}

/** Today's view: plain times, public links, private-code prices. @param {DataModule} fmt @returns {TableView} */
export function plainView(fmt) {
  return { githubTime: (p) => fmt.formatDuration(p.github?.medianSec), proof: proofLinks, price: true };
}

/** The one table most readers need (2026-11-01): who is faster, and by how much. @param {Summary} s @param {DataModule} fmt @param {TableView} view */
export function simpleTable(s, fmt, view) {
  return table(
    ['Project', 'GitHub', 'Codemany', 'Codemany is…', 'Check it'],
    s.projects.map((p) => [
      p.name,
      view.githubTime(p),
      fmt.formatDuration(p.codemany?.medianSec),
      p.warmingUp ? 'warming up' : p.speedup == null ? 'not measured yet' : `**${fmt.formatSpeedup(p.speedup)}**`,
      view.proof(p),
    ]),
  );
}

/** True once the site module reports waits (2026-11-03: SideStat.waitSec). @param {Summary} s */
const hasWaits = (s) => s.projects.some((p) => typeof p.github?.waitSec === 'number' || typeof p.codemany?.waitSec === 'number');

/**
 * The fuller table, under "More numbers". 2026-11-03: with waits, each time is followed by
 * how long that job waited for a computer (never part of the build time).
 * @param {Summary} s @param {DataModule} fmt @param {TableView} view
 */
export function modeTable(s, fmt, view) {
  const waits = hasWaits(s);
  const head = waits ? ['Project', 'GitHub', 'Waited', 'Codemany', 'Waited', 'Result'] : ['Project', 'GitHub', 'Codemany', 'Result'];
  return table(
    view.price ? [...head, 'GitHub price¹'] : head,
    s.projects.map((p) => {
      const gh = [view.githubTime(p), ...(waits ? [fmt.formatDuration(p.github?.waitSec)] : [])];
      const cm = [fmt.formatDuration(p.codemany?.medianSec), ...(waits ? [fmt.formatDuration(p.codemany?.waitSec)] : [])];
      const cells = [p.name, ...gh, ...cm, p.warmingUp ? 'warming up' : p.speedup == null ? '—' : fmt.formatSpeedup(p.speedup)];
      return view.price ? [...cells, fmt.formatUSD(p.githubCostUSD)] : cells;
    }),
  );
}

/** One night-by-night chart per project that has a trend. @param {Summary} s */
export function trendPictures(s) {
  return s.projects
    .filter((p) => p.trend.length > 0)
    .flatMap((p) => [`**${p.name}**`, '', picture(`charts/trend-${p.id}`, `${p.name}: build time per night`), '']);
}
