#!/usr/bin/env bash
# canary-watch.sh (2026-11-04, CMY-87): called by .github/workflows/canary-watch.yml.
# Reads the Beta version from codemany.com and dispatches canary.yml for it unless a run
# for exactly that version (run-name field 2, from main) already succeeded, is still
# queued / running, or has failed MAX_ATTEMPTS times. Fails loudly on any bad input.
#
# Env: GH_TOKEN (actions: write on REPO), REPO (owner/name), MAX_ATTEMPTS (default 6),
#      LATEST_URL (default https://codemany.com/download/latest.json)
set -euo pipefail

repo="${REPO:?REPO is not set}"
max="${MAX_ATTEMPTS:-6}"
url="${LATEST_URL:-https://codemany.com/download/latest.json}"

die() { echo "::error::$*"; exit 1; }
[[ "$max" =~ ^[0-9]+$ ]] || die "MAX_ATTEMPTS must be a whole number, got '$max'"

version="$(curl -fsSL --retry 3 --max-time 20 "$url" | jq -r '.beta.version // empty')" \
  || die "could not read $url"
[[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || die "beta.version in $url is not X.Y.Z: '$version'"

# One line per canary run for exactly $version on main: "<status> <conclusion>".
runs="$(gh run list -R "$repo" -w canary.yml -b main -L 200 \
  --json displayTitle,status,conclusion,headBranch \
  --jq ".[] | select(.headBranch == \"main\") | select((.displayTitle | split(\" \"))[0:2] == [\"canary\", \"$version\"]) | \"\(.status) \(.conclusion)\"")" \
  || die "could not list canary.yml runs in $repo"

if [[ -z "$runs" ]]; then
  failed=0
elif grep -qx 'completed success' <<<"$runs"; then
  echo "canary $version already passed; nothing to do"; exit 0
elif grep -qv '^completed' <<<"$runs"; then
  echo "canary $version is queued or running; nothing to do"; exit 0
else
  failed="$(grep -c '^completed' <<<"$runs")"
fi
if (( failed >= max )); then
  die "canary $version failed $failed times (max $max): fix the machines, then dispatch canary.yml by hand"
fi

nonce="watch-${GITHUB_RUN_ID:-local}"
gh workflow run canary.yml -R "$repo" --ref main -f version="$version" -f wait_minutes=5 -f nonce="$nonce" \
  || die "could not dispatch canary.yml for $version"
echo "::notice::dispatched canary $version ($nonce, attempt $((failed + 1)) of $max)"
