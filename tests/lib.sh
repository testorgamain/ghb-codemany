#!/usr/bin/env bash
# Tiny assert helpers shared by tests/*.test.sh (2026-11-07, CMY-97). No framework: the
# bench repo has none, and these only need bash. Sourced, never run.
# Each test file calls `finish` last; it exits 1 if any assertion failed.

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DROP_SCRIPT="$REPO_ROOT/scripts/drop-cache-entry.sh"
FAILS=0
PASSES=0

pass() { PASSES=$((PASSES + 1)); printf '  ok   %s\n' "$1"; }
fail() { FAILS=$((FAILS + 1)); printf '  FAIL %s\n       %s\n' "$1" "$2"; }

# assert_eq <name> <expected> <actual>
assert_eq() {
  if [[ "$2" == "$3" ]]; then pass "$1"; else fail "$1" "expected [$2] got [$3]"; fi
}

# assert_contains <name> <needle> <haystack>
assert_contains() {
  if [[ "$3" == *"$2"* ]]; then pass "$1"; else fail "$1" "[$2] not in [$3]"; fi
}

# assert_not_contains <name> <needle> <haystack>
assert_not_contains() {
  if [[ "$3" != *"$2"* ]]; then pass "$1"; else fail "$1" "[$2] unexpectedly in [$3]"; fi
}

# Clean env for drop-cache-entry.sh: only what the prepare step gives it, plus overrides.
# stdin is /dev/null, so a regression that stops piping the token to curl fails (empty
# stdin) instead of hanging on the terminal.
# Usage: run_drop VAR=value ... ; sets OUT (stdout+stderr) and RC.
# shellcheck disable=SC2034 # OUT and RC are read by the sourcing test files
run_drop() {
  OUT=$(env -i PATH="${TEST_PATH:-$PATH}" HOME="${HOME:-/tmp}" "$@" bash "$DROP_SCRIPT" </dev/null 2>&1)
  RC=$?
}

finish() {
  printf '%s: %d passed, %d failed\n' "$(basename "$0")" "$PASSES" "$FAILS"
  [[ "$FAILS" -eq 0 ]]
}
