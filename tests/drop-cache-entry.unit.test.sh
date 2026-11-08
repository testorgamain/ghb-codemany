#!/usr/bin/env bash
# Unit tests for scripts/drop-cache-entry.sh (2026-11-07, CMY-97). A fake `curl` first on
# PATH prints a chosen status and exit code and logs its arguments, so every side × status
# branch and the exact request shape are checked without a network.
set -uo pipefail
# shellcheck source=tests/lib.sh
source "$(dirname "$0")/lib.sh"

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
CURL_LOG="$WORK/curl.args"

# Fake curl: one argument per line to $CURL_LOG, its stdin to $CURL_LOG.stdin; prints
# $FAKE_OUT; exits $FAKE_EXIT.
mkdir -p "$WORK/bin"
cat > "$WORK/bin/curl" <<'EOF'
#!/usr/bin/env bash
printf '%s\n' "$@" > "$FAKE_CURL_LOG"
cat > "$FAKE_CURL_LOG.stdin"
printf '%s' "$FAKE_OUT"
exit "$FAKE_EXIT"
EOF
chmod +x "$WORK/bin/curl"
TEST_PATH="$WORK/bin:$PATH"

KEY='bench-run-codemany-excalidraw-abc123-Linux-X64-42109643265'
BASE=(GH_TOKEN=secret-token GITHUB_API_URL=https://api.github.com
      GITHUB_REPOSITORY=codemanyhq/bench "FAKE_CURL_LOG=$CURL_LOG")

# fake <side> <printed status> <curl exit>  -> OUT, RC
fake() {
  rm -f "$CURL_LOG"
  run_drop "${BASE[@]}" "BENCH_CACHE_KEY=$KEY" "BENCH_SIDE=$1" "FAKE_OUT=$2" "FAKE_EXIT=$3"
}

echo "decision table (side x status)"
WARN="::warning::could not delete cache entry $KEY"
#      side     status curl-exit expected output
cases=(
  "github   200 0 deleted cache entry $KEY"
  "github   204 0 deleted cache entry $KEY"
  "github   404 0 $WARN (HTTP 404)"
  "github   403 0 $WARN (HTTP 403)"
  "github   500 0 $WARN (HTTP 500)"
  "codemany 200 0 deleted cache entry $KEY"
  "codemany 404 0 no GitHub cache entry $KEY: Codemany's job cache held it"
  "codemany 401 0 $WARN (HTTP 401)"
  "codemany 403 0 $WARN (HTTP 403)"
  "codemany 503 0 $WARN (HTTP 503)"
  "codemany 000 7 $WARN (HTTP 000)"
  "github   000 28 $WARN (HTTP 000)"
)
for c in "${cases[@]}"; do
  read -r side status cexit expected <<< "$c"
  fake "$side" "$status" "$cexit"
  assert_eq "$side $status (curl exit $cexit): output" "$expected" "$OUT"
  assert_eq "$side $status (curl exit $cexit): step passes" 0 "$RC"
done

echo "curl prints nothing and fails: treated as 000"
fake codemany "" 6
assert_eq "empty status -> 000 warning" "$WARN (HTTP 000)" "$OUT"
assert_eq "empty status: step passes" 0 "$RC"

echo "request shape"
fake codemany 404 0
args=$(cat "$CURL_LOG")
assert_contains "DELETE method" $'-X\nDELETE' "$args"
assert_contains "-G puts the key in the query" $'\n-G\n' "$args"
assert_contains "key is url-encoded" $'--data-urlencode\nkey='"$KEY" "$args"
assert_contains "headers read from stdin" $'-H\n@-' "$args"
assert_eq "bearer token on stdin" "Authorization: Bearer secret-token" "$(cat "$CURL_LOG.stdin")"
assert_not_contains "token never in argv (ps shows it)" "secret-token" "$args"
assert_contains "API version header" $'-H\nAccept: application/vnd.github+json' "$args"
assert_contains "endpoint" "https://api.github.com/repos/codemanyhq/bench/actions/caches" "$args"
assert_contains "status via -w" $'-w\n%{http_code}' "$args"
assert_not_contains "no -f (would hide the status)" $'\n-f\n' "$args"
assert_not_contains "token never printed" "secret-token" "$OUT"

echo "bad inputs fail the step before any request"
for missing in GH_TOKEN BENCH_CACHE_KEY BENCH_SIDE GITHUB_API_URL GITHUB_REPOSITORY; do
  rm -f "$CURL_LOG"
  vars=()
  for v in "${BASE[@]}" "BENCH_CACHE_KEY=$KEY" BENCH_SIDE=codemany FAKE_OUT=200 FAKE_EXIT=0; do
    [[ "$v" == "$missing="* ]] || vars+=("$v")
  done
  run_drop "${vars[@]}"
  assert_eq "missing $missing: step fails" 1 "$RC"
  assert_contains "missing $missing: names it" "$missing" "$OUT"
  assert_eq "missing $missing: no request" no "$([[ -e "$CURL_LOG" ]] && echo yes || echo no)"
done
for side in gh GitHub CODEMANY ""; do
  rm -f "$CURL_LOG"
  fake "$side" 200 0
  assert_eq "side '$side': step fails" 1 "$RC"
  assert_eq "side '$side': no request" no "$([[ -e "$CURL_LOG" ]] && echo yes || echo no)"
done

finish
