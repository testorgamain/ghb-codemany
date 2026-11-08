// @ts-check
/** Paths and small JSON/text file helpers shared by collect + render (2026-10-30). */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Repo root (scripts/lib/../..). */
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** data/ folder; BENCH_DATA_DIR points it at a test fixture. */
export function dataDir() {
  return process.env.BENCH_DATA_DIR || path.join(ROOT, 'data');
}

/**
 * @template T
 * @param {string} file
 * @returns {Promise<T>}
 */
export async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

/** @param {string} file @param {unknown} value */
export async function writeJson(file, value) {
  await writeText(file, `${JSON.stringify(value, null, 2)}\n`);
}

/** @param {string} file @param {string} text */
export async function writeText(file, text) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, text);
}
