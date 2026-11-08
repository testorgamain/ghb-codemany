#!/usr/bin/env bash
# The measured `build` step (2026-10-30), run inside ./src.
# Each line is the project's OWN CI build command (source named on the right).
# Extra flags only point caches at $BENCH_CACHE (see env.sh); nothing else is changed.
set -euo pipefail

# 2026-11-04: a restored CMake build dir made under another absolute path (Codemany host
# slots each have their own workspace, e.g. _codemany4 vs _codemany2) makes cmake refuse
# it ("CMakeCache.txt directory ... is different"). Drop only the stale configure state;
# downloads and built objects stay, so warm still reuses what it can.
forget_moved_cmake() {
  [[ -d $1 ]] || return 0
  local cache dir
  # Every CMakeCache.txt below $1 (ExternalProject sub-builds have their own).
  while IFS= read -r -d '' cache; do
    dir=$(cd "$(dirname "$cache")" && pwd -P)
    grep -qxF "CMAKE_CACHEFILE_DIR:INTERNAL=$dir" "$cache" && continue
    echo "cmake cache in $dir was made elsewhere; reconfiguring it"
    rm -rf "$cache" "$dir/CMakeFiles"
  done < <(find "$1" -name CMakeCache.txt -print0)
}

case "$BENCH_PROJECT" in
  ripgrep)    cargo build --release ;;                                  # ripgrep ci.yml / README
  hugo)       go install ;;                                             # hugo test.yml
  react-dev)  yarn install --frozen-lockfile                            # react.dev analyze.yml
              ./node_modules/.bin/next build ;;
  excalidraw) bash "$BENCH_SCRIPTS/docker-build.sh" excalidraw ;;       # build-docker.yml
  swiftlint)  swift build --configuration release -Xlinker -dead_strip \
                --product swiftlint \
                --scratch-path "$BENCH_CACHE/build" \
                --cache-path "$BENCH_CACHE/swiftpm" ;;                  # SwiftLint Makefile
  typescript) npm ci                                                    # TypeScript ci.yml:27-28
              npx hereby build ;;
  ruff)       cargo build --release --locked --bin ruff ;;              # ruff build-binaries.yml:330
  django)     python -m venv "$RUNNER_TEMP/venv-django"                 # django tests.yml:72-77
              . "$RUNNER_TEMP/venv-django/bin/activate"
              python -m pip install --upgrade pip wheel
              python -m pip install -r tests/requirements/py3-free-threading.txt -e .
              python -Wall tests/runtests.py -v2 ;;
  kubernetes) make WHAT=cmd/kubectl ;;                                  # build/root/Makefile:96-97
  # 2026-11-02: no `-sdk iphonesimulator` (bitrise has it): it forces the host-only Swift
  # macro targets onto the simulator SDK, where the macOS swift-syntax prebuilts can't be
  # found ("Unable to resolve module dependency: 'SwiftSyntax'", both sides, run 41507481012).
  # The destination alone still builds the app for the iOS Simulator.
  firefox-ios) ./bootstrap.sh firefox                                   # firefox-ios bitrise.yml:78-79
              cd firefox-ios
              xcodebuild -resolvePackageDependencies -onlyUsePackageVersionsFromResolvedFile \
                -project Client.xcodeproj -scheme Fennec -clonedSourcePackagesDirPath "$BENCH_CACHE/spm"
              xcodebuild -project Client.xcodeproj -scheme Fennec -configuration Debug \
                -destination 'generic/platform=iOS Simulator' build-for-testing \
                COMPILER_INDEX_STORE_ENABLE=NO CODE_SIGN_IDENTITY= CODE_SIGNING_REQUIRED=NO \
                CODE_SIGNING_ALLOWED=NO ARCHS=arm64 -derivedDataPath "$BENCH_CACHE/DerivedData" \
                -clonedSourcePackagesDirPath "$BENCH_CACHE/spm" -skipMacroValidation \
                -skipPackagePluginValidation ;;
  tca)        xcodebuild test -configuration Debug -scheme ComposableArchitecture \
                -workspace .github/package.xcworkspace -destination platform=macOS \
                -derivedDataPath "$BENCH_CACHE/DerivedData" \
                -clonedSourcePackagesDirPath "$BENCH_CACHE/spm" -skipMacroValidation ;;  # TCA ci.yml:47
  nowinandroid) mkdir -p "$GRADLE_USER_HOME"                            # nowinandroid Build.yaml:31,137
              cp .github/ci-gradle.properties "$GRADLE_USER_HOME/gradle.properties"
              ./gradlew :app:assemble -PminifyWithR8=false ;;
  neovim)     forget_moved_cmake "$DEPS_BUILD_DIR"; forget_moved_cmake build
              cmake -S cmake.deps --preset ci -B "$DEPS_BUILD_DIR" -D CMAKE_BUILD_TYPE=Debug  # neovim test.yml:210-218
              cmake --build "$DEPS_BUILD_DIR"
              cmake --preset ci -D CMAKE_BUILD_TYPE=Release   # translations off on both sides: no gettext without sudo
              cmake --build build ;;
  *) echo "::error::no build command for '$BENCH_PROJECT'"; exit 1 ;;
esac
