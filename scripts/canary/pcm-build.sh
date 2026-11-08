#!/usr/bin/env bash
# pcm-build.sh (2026-11-05, codemany #924): swift build of the canary package in
# ./canary-pcm (a workspace-relative path, like the bench caches). Mode (arg 1):
#   save     first build; the ModuleCache (.pcm files) must exist for the cache save.
#   restore  build again on top of the restored .build. A restored .pcm built under another
#            slot user's path used to fail: "was compiled with module cache path ..."
#            (bench swiftlint warm, run 42015074066).
set -euo pipefail
die() { echo "::error::$*"; exit 1; }
mode="${1:?usage: pcm-build.sh save|restore}"
here="$(cd "$(dirname "$0")" && pwd)"
pkg="$PWD/canary-pcm"

case "$mode" in
  save) rm -rf "$pkg" && "$here/make-package.sh" "$pkg" ;;
  restore) [[ -d "$pkg/.build" ]] || die "restored cache has no canary-pcm/.build" ;;
  *) die "unknown mode '$mode'" ;;
esac
pcms() { find "$pkg/.build" -name '*.pcm' 2>/dev/null | wc -l | tr -d ' '; }
echo "::notice::$mode: $(pcms) .pcm files in .build before the build (built in $pkg as $(id -un))"
(cd "$pkg" && swift build)
n="$(pcms)"
[[ "$n" -gt 0 ]] || die "swift build left no .pcm files (no ModuleCache: the canary tests nothing)"
echo "::notice::$mode: swift build passed, $n .pcm files"
