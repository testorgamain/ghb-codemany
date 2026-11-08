// @ts-check
/**
 * Shared JSDoc types for the bench scripts (2026-10-30).
 * They mirror the data contract in data/*.json that codemany.com/benchmarks reads,
 * and the Summary returned by the shared module bench-data.js. Keep them in sync.
 */

/**
 * Who ran a job. 'github-private' (2026-11-01): GitHub's computer for private code, timed
 * weekly in codemanyhq/bench-private (Linux only; see sources.mjs).
 * @typedef {'github'|'github-private'|'codemany'} Side
 */
/** Whose code GitHub is running: private code pays by the minute, public code is free. @typedef {'private'|'public'} Code */
/** @typedef {'cold'|'warm'} Mode */
/** @typedef {'linux'|'macos'} Os */
/** @typedef {'light'|'dark'} ThemeName */
/** @typedef {'success'|'failure'|'cancelled'} Conclusion */

/**
 * One measured bench job (data/results.json → runs[]).
 * @typedef {object} RunRow
 * @property {number} runId
 * @property {number} jobId          dedupe key
 * @property {string} runUrl
 * @property {string} jobUrl
 * @property {string} date           ISO-8601 job start
 * @property {string} project        Project.id
 * @property {Mode} mode
 * @property {Side} side
 * @property {Os} os
 * @property {string} runner         runs-on label (GitHub) or runner name (Codemany)
 * @property {number} queueSec       created → started
 * @property {number} jobSec         started → completed
 * @property {number|null} buildSec  the `build` step; null when it did not succeed
 * @property {Conclusion} conclusion
 * @property {boolean|null} [cacheHit]  warm only: was the saved cache restored? null = cold or unknown (2026-11-02)
 */

/**
 * @typedef {object} ResultsFile
 * @property {1} schema
 * @property {string|null} updatedAt
 * @property {RunRow[]} runs
 */

/**
 * One pinned open-source build (data/projects.json).
 * @typedef {object} Project
 * @property {string} id
 * @property {string} name
 * @property {string} repo       owner/name
 * @property {string} sha        full commit SHA
 * @property {string} lang
 * @property {Os} os
 * @property {string} command    the project's own CI build command
 * @property {string} url
 * @property {string} toolchain
 * @property {boolean} [trial]  runs nightly, kept out of the published numbers (2026-11-01)
 */

/**
 * @typedef {object} CodemanyMachine
 * @property {string} id
 * @property {string} name
 * @property {Os} os
 * @property {string} cpu
 * @property {number} cores
 * @property {number} ramGB
 * @property {number} diskGB
 * @property {number|null} priceUSD
 * @property {number} lifeYears
 * @property {number|null} watts
 * @property {string|null} buyUrl    only a real product page, never a guess
 * @property {string|null} buyNote
 */

/**
 * One GitHub computer for one kind of code (2026-11-01: `code` added; the same label
 * appears once per code, private first).
 * @typedef {object} GithubRunner
 * @property {string} label
 * @property {Code} code
 * @property {string} cpu
 * @property {number} ramGB
 * @property {number} diskGB
 * @property {number} perMinuteUSD   0 = free (public code)
 * @property {string} priceNote
 * @property {string} source
 * @property {string} specsSource
 * @property {string} asOf
 */

/** @typedef {{ codemany: CodemanyMachine[], github: GithubRunner[] }} Hardware */

/** waitSec (2026-11-03): median created → started of the same jobs, from a site module that has it. @typedef {{ medianSec: number, p90Sec: number, n: number, runner: string, lastJobUrl: string, waitSec?: number }} SideStat */
/** @typedef {{ date: string, github: number|null, codemany: number|null }} TrendPoint */

/**
 * @typedef {object} ProjectSummary
 * @property {string} id
 * @property {string} name
 * @property {string} lang
 * @property {Os} os
 * @property {SideStat|null} github
 * @property {SideStat|null} codemany
 * @property {number|null} speedup
 * @property {number|null} githubCostUSD
 * @property {number|null} codemanyCostUSD
 * @property {TrendPoint[]} trend
 * @property {boolean} [warmingUp]  set here, not by the site module: warm comparison lacks a restored cache (2026-11-02)
 */

/**
 * @typedef {object} Summary
 * @property {Mode} mode
 * @property {Code} [code]   echoed only by a site module that knows about code (2026-11-01)
 * @property {number} windowDays
 * @property {string|null} updatedAt
 * @property {number} nights
 * @property {{ speedup: number|null, githubMedianSec: number|null, codemanyMedianSec: number|null }} overall
 * @property {ProjectSummary[]} projects
 */

/** @typedef {{ mode: Mode, code?: Code, days?: number, now?: Date }} SummarizeOptions */

/** One summary per mode. @typedef {{ cold: Summary, warm: Summary }} ModePair */
/**
 * What the README draws (2026-11-01, see summaries.mjs).
 * @typedef {object} Summaries
 * @property {ModePair} main               charts + first table: private code when the module knows code
 * @property {ModePair|null} publicCode    null with a site module that predates code support
 */

/**
 * The two shared modules served by codemany.com/benchmarks.
 * @typedef {object} DataModule
 * @property {(r: ResultsFile, p: Project[], h: Hardware, o: SummarizeOptions) => Summary} summarize
 * @property {(sec: number|null|undefined) => string} formatDuration
 * @property {(x: number|null|undefined) => string} formatSpeedup
 * @property {(usd: number|null|undefined) => string} formatUSD
 */
/**
 * @typedef {object} ChartModule
 * @property {(s: Summary, o: { width: number, theme: ThemeName }) => string} barsSVG
 * @property {(p: ProjectSummary, o: { width: number, height?: number, theme: ThemeName }) => string} trendSVG
 */
/** @typedef {{ data: DataModule, chart: ChartModule }} BenchModules */

/**
 * One repo + workflow the collector reads (2026-11-01, see sources.mjs).
 * @typedef {object} BenchSource
 * @property {string} repo        owner/name
 * @property {string} workflow    workflow file name, e.g. bench.yml
 * @property {string} token       bearer token used for this repo's API calls only
 * @property {Side[]} sides       job sides this source may report
 * @property {boolean} useRunId   whether BENCH_RUN_ID (a bench.yml run) applies
 */

/** GitHub REST shapes (only the fields we read). */
/** @typedef {{ name: string, conclusion: string|null, started_at: string|null, completed_at: string|null }} ApiStep */
/**
 * @typedef {object} ApiJob
 * @property {number} id
 * @property {string} html_url
 * @property {string} name
 * @property {string} status
 * @property {string|null} conclusion
 * @property {string} created_at
 * @property {string|null} started_at
 * @property {string|null} completed_at
 * @property {string|null} runner_name
 * @property {string[]} labels
 * @property {ApiStep[]=} steps
 */
/**
 * @typedef {object} ApiRun
 * @property {number} id
 * @property {string} html_url
 * @property {string} path
 * @property {string} event
 * @property {string} status
 */

export {};
