#!/usr/bin/env bash
# Runs every tests/*.test.sh (2026-11-07, CMY-97) and fails if any one fails.
# Local only: this public repo has self-hosted runners, so no workflow may run on
# pull_request or push (bench.yml SAFETY). Run before merging: bash tests/run.sh
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1

failed=()
for t in tests/*.test.sh; do
  echo "== $t"
  bash "$t" </dev/null || failed+=("$t")   # never waits on the terminal
done
if ((${#failed[@]})); then
  printf 'FAILED: %s\n' "${failed[@]}"
  exit 1
fi
echo "all test files passed"
