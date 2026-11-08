#!/usr/bin/env bash
# shellcheck disable=SC2016 # the single-quoted $… strings are literal YAML text to find
# Wiring tests (2026-11-07, CMY-97): the prepare action's "drop used cache entry" step
# calls scripts/drop-cache-entry.sh with the inputs it needs, and every bench.yml job that
# uses prepare sets a valid BENCH_SIDE and, when it can run warm, `actions: write`.
# Text checks on purpose: no YAML parser is guaranteed on every runner.
set -uo pipefail
# shellcheck source=tests/lib.sh
source "$(dirname "$0")/lib.sh"

ACTION="$REPO_ROOT/.github/actions/prepare/action.yml"
BENCH="$REPO_ROOT/.github/workflows/bench.yml"

# Lines of one step of the action: from "- name: <name>" up to the next "- name:".
step_block() {
  awk -v n="    - name: $1" '$0 == n {on=1; print; next} on && /^    - name: / {exit} on {print}' "$ACTION"
}

echo "prepare: drop used cache entry"
step=$(step_block "drop used cache entry")
assert_contains "step exists" "drop used cache entry" "$step"
assert_contains "calls the script" 'run: bash "$GITHUB_WORKSPACE/bench/scripts/drop-cache-entry.sh"' "$step"
assert_contains "passes the job token" 'GH_TOKEN: ${{ github.token }}' "$step"
assert_contains "warm only" "env.BENCH_MODE == 'warm'" "$step"
assert_contains "per-run entries only" "env.BENCH_CACHE_SCOPE == 'run'" "$step"
assert_contains "only after a hit" "steps.restore.outputs.cache-hit == 'true'" "$step"
assert_not_contains "no inline curl left" "curl" "$step"
if [[ -f "$DROP_SCRIPT" ]]; then pass "script exists"; else fail "script exists" "$DROP_SCRIPT missing"; fi

# BENCH_CACHE_KEY must come from the earlier "wire caches" step (env.sh).
assert_contains "env.sh exports BENCH_CACHE_KEY" 'put BENCH_CACHE_KEY' "$(cat "$REPO_ROOT/scripts/env.sh")"

echo "bench.yml: every job that uses prepare"
# One record per job: "<job>|<side>|<actions perm>|<uses prepare>".
records=$(awk '
  function flush() { if (job != "") print job "|" side "|" perm "|" prep }
  /^  [a-z0-9-]+:$/ { flush(); job=$1; sub(":", "", job); side=""; perm=""; prep="no"; next }
  /^[a-z]/          { flush(); job="" }
  job != "" && /BENCH_SIDE:/          { side=$2 }
  job != "" && /^      actions:/      { perm=$2 }
  job != "" && /actions\/prepare/     { prep="yes" }
  END { flush() }' "$BENCH")

found=0
while IFS='|' read -r job side perm prep; do
  [[ "$prep" == yes ]] || continue
  found=$((found + 1))
  case "$side" in
    github|codemany) pass "$job: BENCH_SIDE=$side" ;;
    *) fail "$job: BENCH_SIDE" "got [$side], want github or codemany" ;;
  esac
  # A job that can run warm deletes its restored entry, so it needs actions: write.
  if [[ "$job" == *cold* ]]; then continue; fi
  assert_eq "$job: actions: write" write "$perm"
done <<< "$records"
assert_eq "four bench jobs use prepare" 4 "$found"

finish
