// @ts-check
/**
 * README generated blocks (2026-10-30): everything between
 * `<!-- name:start -->` and `<!-- name:end -->` is owned by scripts/render.mjs.
 */

/** @param {string} markdown @param {string} name @param {string} body */
export function replaceBlock(markdown, name, body) {
  const start = `<!-- ${name}:start -->`;
  const end = `<!-- ${name}:end -->`;
  const i = markdown.indexOf(start);
  const j = markdown.indexOf(end);
  if (i < 0 || j < i) throw new Error(`README.md is missing the "${name}" block markers`);
  return `${markdown.slice(0, i + start.length)}\n${body.trim()}\n${markdown.slice(j)}`;
}

/** A dark/light chart for GitHub markdown. @param {string} base e.g. charts/speed-cold @param {string} alt */
export function picture(base, alt) {
  return [
    '<picture>',
    `  <source media="(prefers-color-scheme: dark)" srcset="${base}-dark.svg">`,
    `  <img alt="${alt}" src="${base}-light.svg">`,
    '</picture>',
  ].join('\n');
}

/** Markdown table from a header and rows (pipes in cells are escaped). @param {string[]} head @param {string[][]} rows */
export function table(head, rows) {
  const line = (/** @type {string[]} */ cells) => `| ${cells.map((c) => c.replaceAll('|', '\\|')).join(' | ')} |`;
  return [line(head), line(head.map(() => '---')), ...rows.map(line)].join('\n');
}
