#!/usr/bin/env bash
# Deletes this run's used cache entry from GitHub's cache (prepare, "drop used cache entry").
# Per-run entries are read once; dropping them keeps the next projects' saves from pushing
# an unread entry out of GitHub's 10 GB per repo (env.sh).
#
# 2026-11-07 (CMY-97): on Codemany, HTTP 404 is expected and only logged: Codemany's job
# cache answers actions/cache, so the entry never reaches GitHub's cache API (and GitHub's
# 10 GB limit doesn't apply to it). The call still runs there, so an entry that did land
# in GitHub's cache is deleted. On GitHub, this step runs only after a hit on this exact
# key, so a 404 means something is wrong (key mismatch, entry removed mid-run) and warns.
# Any failure only warns: bench.yml's plan job sweeps leftovers next run, so a failed
# delete must not fail a measured build. Missing inputs fail the step.
# Inputs (env): GH_TOKEN BENCH_CACHE_KEY BENCH_SIDE GITHUB_API_URL GITHUB_REPOSITORY
set -uo pipefail

: "${GH_TOKEN:?}" "${BENCH_CACHE_KEY:?}" "${BENCH_SIDE:?}" "${GITHUB_API_URL:?}" "${GITHUB_REPOSITORY:?}"
case "$BENCH_SIDE" in
  github|codemany) ;;
  *) echo "::error::unknown BENCH_SIDE '$BENCH_SIDE'"; exit 1 ;;
esac

# -w prints the status even on 4xx/5xx (no -f); curl itself failing prints "000".
# The token goes in on stdin (-H @-), never in argv: `ps` shows any process's arguments
# to every local user, and public jobs on a Codemany host run as slot users side by side.
code=$(printf 'Authorization: Bearer %s\n' "$GH_TOKEN" |
  curl -sS -o /dev/null -w '%{http_code}' -X DELETE -G \
  -H @- -H "Accept: application/vnd.github+json" \
  --data-urlencode "key=$BENCH_CACHE_KEY" \
  "$GITHUB_API_URL/repos/$GITHUB_REPOSITORY/actions/caches") || code="${code:-000}"

case "$BENCH_SIDE:$code" in
  *:2??)         echo "deleted cache entry $BENCH_CACHE_KEY" ;;
  codemany:404)  echo "no GitHub cache entry $BENCH_CACHE_KEY: Codemany's job cache held it" ;;
  *)             echo "::warning::could not delete cache entry $BENCH_CACHE_KEY (HTTP $code)" ;;
esac
exit 0
