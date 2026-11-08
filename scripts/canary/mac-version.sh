#!/usr/bin/env bash
# mac-version.sh (2026-11-05): canary-mac.yml's first step. The job's Mac must already run
# WANT (canary.yml's `macos` job waited for the update; this one does not wait). Reads
# CODEMANY_VERSION first, else the app's bundled binary, and fails loudly on a mismatch.
# Env: WANT (X.Y.Z, required).
set -euo pipefail
want="${WANT:?WANT is not set}"; want="${want#v}"
bin=/Applications/Codemany.app/Contents/Resources/bin/codemany
if [[ -n "${CODEMANY_VERSION:-}" ]]; then got="${CODEMANY_VERSION#v}"
elif [[ -x "$bin" ]]; then got="$("$bin" version 2>/dev/null | awk '{print $2}' || true)"; got="${got#v}"
else echo "::error::$RUNNER_NAME: no CODEMANY_VERSION and no $bin"; exit 1; fi
if [[ "$got" != "$want" ]]; then
  echo "::error::$RUNNER_NAME runs Codemany ${got:-unknown}, not $want (still updating? re-run the gate)"
  exit 1
fi
echo "::notice::$RUNNER_NAME runs Codemany $got as $(id -un) in $PWD"
