// @ts-check
/**
 * The README "Results" block when the site module knows about code (2026-11-01):
 * private code first (what teams pay for), public code under "More numbers".
 * Private Linux GitHub times come from codemanyhq/bench-private, every night (2026-11-06). Until a
 * project has one, its public 4-core time stands in, marked † with a plain note.
 */
import { picture } from './blocks.mjs';
import { modeTable, plainView, simpleTable, trendPictures } from './results-tables.mjs';
import { isPrivateJobUrl } from './sources.mjs';

/** @typedef {import('./types.mjs').DataModule} DataModule */
/** @typedef {import('./types.mjs').ModePair} ModePair */
/** @typedef {import('./types.mjs').ProjectSummary} ProjectSummary */
/** @typedef {import('./results-tables.mjs').TableView} TableView */

/** The private run starts every night 05:17 UTC; by noon its times should be in. */
const PRIVATE_DONE_HOUR_UTC = 12;
/** UTC weekdays the private run starts (every day since 2026-11-06; bench-private.yml). */
const PRIVATE_DAYS = [0, 1, 2, 3, 4, 5, 6];

/** A private-code Linux row whose GitHub time is really the public 4-core one. @param {ProjectSummary} p */
const isStandIn = (p) => p.os === 'linux' && p.github != null && !isPrivateJobUrl(p.github.lastJobUrl);

/** When private times arrive, in words: "Sunday, November 8". @param {Date} now */
export function nextPrivateRun(now) {
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (!PRIVATE_DAYS.includes(day.getUTCDay()) || now.getUTCHours() >= PRIVATE_DONE_HOUR_UTC) {
    do day.setUTCDate(day.getUTCDate() + 1); while (!PRIVATE_DAYS.includes(day.getUTCDay()));
  }
  return day.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

/** Private code: † on stand-in times; private runs can't be opened, so no link. @param {DataModule} fmt @returns {TableView} */
function privateView(fmt) {
  return {
    githubTime: (p) => `${fmt.formatDuration(p.github?.medianSec)}${isStandIn(p) ? ' †' : ''}`,
    proof: (p) => {
      const links = [];
      if (p.github) links.push(isPrivateJobUrl(p.github.lastJobUrl) ? 'GitHub (private run)' : `[GitHub](${p.github.lastJobUrl})`);
      if (p.codemany) links.push(`[Codemany](${p.codemany.lastJobUrl})`);
      return links.join(' · ') || '—';
    },
    price: true,
  };
}

/** @param {ModePair} priv @param {ModePair} pub @param {DataModule} fmt @param {Date} now */
export function codeResultsBlock(priv, pub, fmt, now) {
  const pv = privateView(fmt);
  const uv = { ...plainView(fmt), price: false };
  const standIn = [...priv.cold.projects, ...priv.warm.projects].some(isStandIn);
  const updated = (priv.cold.updatedAt ?? '').slice(0, 10);
  return [
    `Time to build each project from scratch, for **private code** (the middle of the last ${priv.cold.windowDays} days). Updated ${updated}.`,
    '',
    simpleTable(priv.cold, fmt, pv),
    '',
    ...(standIn ? [`† Timed on GitHub's public 4-core computer. Private times arrive ${nextPrivateRun(now)}.`, ''] : []),
    'Public code? GitHub runs it for free, on a bigger Linux computer. See **More numbers**.',
    '',
    // 2026-11-06: night by night is always shown (no longer folded), so readers see the bench runs every night.
    `### Every night, the last ${priv.cold.windowDays} days (private code, from scratch)`,
    '',
    ...trendPictures(priv.cold),
    '<details>',
    '<summary><b>More numbers</b>: public code, with saved files, prices</summary>',
    '',
    '### Private code, from scratch',
    '',
    modeTable(priv.cold, fmt, pv),
    '',
    '### Private code, with saved files',
    '',
    picture('charts/speed-warm', 'Build time with saved files: GitHub vs Codemany'),
    '',
    modeTable(priv.warm, fmt, pv),
    '',
    '### Public code (free on GitHub), from scratch',
    '',
    modeTable(pub.cold, fmt, uv),
    '',
    '### Public code (free on GitHub), with saved files',
    '',
    modeTable(pub.warm, fmt, uv),
    '',
    '¹ What one GitHub build costs for private code, at the prices in [The computers](#the-computers). Public code is free.',
    '',
    '</details>',
  ].join('\n');
}
