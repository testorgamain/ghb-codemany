// @ts-check
/**
 * The chart shown before there is any data (2026-10-30). Plain words, no numbers:
 * no fake data ever ships. Colours are the bench design tokens (brief, light/dark).
 */

/** @typedef {import('./types.mjs').ThemeName} ThemeName */

const TOKENS = {
  light: { surface: '#ffffff', ink: '#09090b', muted: '#71717a', grid: '#e4e4e7', accent: '#059669' },
  dark: { surface: '#0d1117', ink: '#f4f4f5', muted: '#a1a1aa', grid: '#27272a', accent: '#10b981' },
};
const FONT = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace";

/** @param {ThemeName} theme @param {string} title @param {string} line */
export function placeholderSVG(theme, title, line) {
  const t = TOKENS[theme];
  const w = 840;
  const h = 120;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${title}" font-family="${FONT}">`,
    `<rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="12" fill="${t.surface}" stroke="${t.grid}"/>`,
    `<circle cx="36" cy="50" r="5" fill="${t.accent}"/>`,
    `<text x="54" y="56" font-size="18" font-weight="600" fill="${t.ink}">${title}</text>`,
    `<text x="54" y="86" font-size="14" fill="${t.muted}">${line}</text>`,
    '</svg>',
    '',
  ].join('\n');
}
