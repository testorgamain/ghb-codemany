#!/usr/bin/env bash
# xctest.sh (2026-11-05, codemany #923): XCTest runs as the job's slot user. Before the fix
# xcodebuild test failed with "Couldn't communicate with a helper application" because
# testmanagerd would not talk to a _codemanyN user (bench tca, run 42015074066).
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
pkg="$RUNNER_TEMP/canary-xctest"
rm -rf "$pkg" && "$here/make-package.sh" "$pkg" && cd "$pkg"

echo "::group::swift test"
swift test
echo "::endgroup::"

# A one-product package gets scheme "Canary"; more products add "Canary-Package".
scheme=Canary
xcodebuild -list | grep -q 'Canary-Package' && scheme=Canary-Package
echo "::group::xcodebuild test -scheme $scheme"
xcodebuild test -scheme "$scheme" -destination platform=macOS \
  -derivedDataPath "$RUNNER_TEMP/canary-dd" -quiet
echo "::endgroup::"
echo "::notice::swift test and xcodebuild test passed as $(id -un)"
