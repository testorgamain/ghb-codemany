#!/usr/bin/env bash
# Integration tests for scripts/drop-cache-entry.sh (2026-11-07, CMY-97): the real curl
# against a local stub of GitHub's delete-by-key API (tests/github_caches_stub.py), which
# only answers a correct request. Needs bash, curl and python3.
set -uo pipefail
# shellcheck source=tests/lib.sh
source "$(dirname "$0")/lib.sh"

command -v python3 >/dev/null || { echo "python3 is required"; exit 1; }
command -v curl >/dev/null || { echo "curl is required"; exit 1; }

WORK=$(mktemp -d)
STUB_PID=""
cleanup() { [[ -n "$STUB_PID" ]] && kill "$STUB_PID" 2>/dev/null; rm -rf "$WORK"; }
trap cleanup EXIT

REPO=codemanyhq/bench
TOKEN=test-token
python3 -I "$REPO_ROOT/tests/github_caches_stub.py" \
  "$WORK/port" "$WORK/keys.log" "$REPO" "$TOKEN" &
STUB_PID=$!
for _ in $(seq 50); do [[ -s "$WORK/port" ]] && break; sleep 0.1; done
[[ -s "$WORK/port" ]] || { echo "stub server did not start"; exit 1; }
API="http://127.0.0.1:$(cat "$WORK/port")"

# real <side> <key> [token]  -> OUT, RC
real() {
  run_drop GH_TOKEN="${3:-$TOKEN}" GITHUB_API_URL="$API" GITHUB_REPOSITORY="$REPO" \
    BENCH_SIDE="$1" BENCH_CACHE_KEY="$2"
}

echo "real curl, both sides"
for side in github codemany; do
  key="bench-run-$side-p-sha-Linux-X64-1~200"
  real "$side" "$key"
  assert_eq "$side 200: deleted" "deleted cache entry $key" "$OUT"
  assert_eq "$side 200: step passes" 0 "$RC"
done

key="bench-run-codemany-excalidraw-sha-Linux-X64-42109643265~404"
real codemany "$key"
assert_eq "codemany 404: no warning" \
  "no GitHub cache entry $key: Codemany's job cache held it" "$OUT"
assert_eq "codemany 404: step passes" 0 "$RC"

key="bench-run-github-excalidraw-sha-Linux-X64-42109643265~404"
real github "$key"
assert_eq "github 404: warns" "::warning::could not delete cache entry $key (HTTP 404)" "$OUT"
assert_eq "github 404: step passes" 0 "$RC"

for status in 403 422 500 503; do
  real codemany "k~$status"
  assert_eq "codemany $status: warns" "::warning::could not delete cache entry k~$status (HTTP $status)" "$OUT"
done

echo "the stub really checks the request"
real codemany "k~200" wrong-token
assert_eq "wrong token -> stub 400 -> warning" "::warning::could not delete cache entry k~200 (HTTP 400)" "$OUT"

echo "key reaches GitHub intact (URL-encoding)"
: > "$WORK/keys.log"
odd='key with spaces&amp=+%/ü~200'
real github "$odd"
assert_eq "odd key: deleted" "deleted cache entry $odd" "$OUT"
assert_eq "odd key: decoded exactly" "$odd" "$(cat "$WORK/keys.log")"

echo "server gone: warns, step passes"
kill "$STUB_PID"; wait "$STUB_PID" 2>/dev/null; STUB_PID=""
real codemany "k~200"
assert_contains "unreachable -> HTTP 000 warning" \
  "::warning::could not delete cache entry k~200 (HTTP 000)" "$OUT"
assert_eq "unreachable: step passes" 0 "$RC"

finish
