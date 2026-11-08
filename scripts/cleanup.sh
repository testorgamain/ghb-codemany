#!/usr/bin/env bash
# Runs after every bench job, pass or fail (2026-10-30). Frees disk on Codemany machines:
# the docker builder and image, the cold cache folder and the source checkout.
# Warm caches stay on purpose (nightly keys): that is what "warm" means.
set -uo pipefail

if [[ -n "${BENCH_BUILDER:-}" ]]; then
  docker buildx rm "$BENCH_BUILDER" >/dev/null 2>&1 || true
  docker image rm -f "bench/${BENCH_PROJECT:-none}" >/dev/null 2>&1 || true
fi

# Only ever delete a cold cache that lives inside this job's temp folder.
if [[ "${BENCH_MODE:-}" == cold && -n "${RUNNER_TEMP:-}" && "${BENCH_CACHE:-}" == "$RUNNER_TEMP"/* ]]; then
  chmod -R u+w "$BENCH_CACHE" 2>/dev/null
  rm -rf "$BENCH_CACHE"
fi
# 2026-11-02: per run (env.sh), the folder is saved/restored through GitHub's cache and
# emptied before every use, so nothing on disk is reused: free it in both modes.
if [[ "${BENCH_CACHE_SCOPE:-}" == run && "${BENCH_CACHE:-}" == "$GITHUB_WORKSPACE/.bench-cache/"?* ]]; then
  chmod -R u+w "$BENCH_CACHE" 2>/dev/null
  rm -rf "$BENCH_CACHE"
fi

# 2026-11-03: the per-job Android SDK and plain buildkitd.toml too (prepare, env.sh).
rm -rf "${GITHUB_WORKSPACE:?}/src" "${RUNNER_TEMP:-/nonexistent}/bin" \
  "${RUNNER_TEMP:-/nonexistent}/android-sdk" "${RUNNER_TEMP:-/nonexistent}/buildkitd-plain.toml"
exit 0
