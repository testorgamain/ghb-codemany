#!/usr/bin/env bash
# ios-sim.sh (2026-11-05, codemany #922): the iOS Simulator runtime that matches the
# selected Xcode's iphonesimulator SDK is installed and available. Without it xcodebuild
# fails with "iOS X.Y is not installed" (bench firefox-ios, run 42015074066).
set -euo pipefail
die() { echo "::error::$*"; exit 1; }

xcode="$(xcode-select -p)"
sdk="$(xcrun --sdk iphonesimulator --show-sdk-version)" \
  || die "$RUNNER_NAME: no iphonesimulator SDK in $xcode"
[[ "$sdk" =~ ^[0-9]+\.[0-9]+(\.[0-9]+)?$ ]] || die "odd iphonesimulator SDK version '$sdk'"

runtimes="$(xcrun simctl list runtimes)" || die "$RUNNER_NAME: simctl list runtimes failed"
echo "$runtimes"
# A matching line reads "iOS 26.5 (26.5 - 23F77) - com.apple.CoreSimulator.SimRuntime.iOS-26-5";
# a patch release (26.5.1) also matches; "(unavailable, ...)" does not count.
match="$(grep -E "^iOS ${sdk//./\\.}(\.[0-9]+)? " <<<"$runtimes" | grep -v unavailable || true)"
[[ -n "$match" ]] || die "$RUNNER_NAME: no available iOS $sdk simulator runtime for $xcode (codemany #922)"
echo "::notice::iOS $sdk simulator runtime present: $match"
