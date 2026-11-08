#!/usr/bin/env bash
# Points every cache of one project at ONE folder, $BENCH_CACHE, and exports it to the
# next steps through $GITHUB_ENV (2026-10-30).
#   cold: $RUNNER_TEMP/bench-cache, emptied now and deleted by cleanup.sh (both sides).
#   warm: $HOME/.cache/codemany-bench/<project>, restored from actions/cache on BOTH sides.
#         2026-11-02: the bench repo is public, and Codemany runs a public repo's job on a
#         fresh, wiped machine (its "public twin"), so last night's folder is never on disk.
#         2026-11-03: public jobs now run on the host as a slot user whose home Codemany
#         wipes after every job; machine-wide state (tool cache, Docker images, job cache)
#         stays, and the README says so ("What stays on a Codemany computer").
#         Each side keeps its own key: Codemany never builds with files GitHub saved.
# Same folder layout on both sides, so cold vs warm is the only difference that matters.
#
# 2026-11-02, BENCH_CACHE_SCOPE=run (bench.yml): the cold build SAVES its folder and the
# warm build of the same project, same run, RESTORES it (then deletes it, prepare). Why:
# both sides' nightly caches (~2 x 7 GB) did not fit GitHub's 10 GB per repo, so they
# pushed each other out and warm jobs missed (run 41507481012: Now in Android). Then:
#   - cold and warm use the SAME folder: actions/cache only matches a save made with
#     the same path, and a cold save from $RUNNER_TEMP never matched a warm restore;
#   - that folder is inside the workspace and actions/cache gets it as a RELATIVE path
#     ($BENCH_CACHE_PATH): a Codemany public job runs in a job VM (HOME=/home/runner) or
#     as a slot user (HOME=/var/lib/codemany/slots/<user>), and an absolute $HOME path
#     changed the entry's version, so the save never matched (run 41523326203: Now in
#     Android cold in a VM, warm as _codemany10);
#   - the folder is emptied first in both modes, so warm only ever has restored files;
#   - the key carries the run id, so every run saves fresh keys (no "another job may be
#     creating this cache" clash with an older run's entry).
# Unset (bench-private.yml): nightly keys, as before.
# Inputs (env): BENCH_PROJECT BENCH_MODE BENCH_LANG BENCH_SHA BENCH_TOOLCHAIN [BENCH_CACHE_SCOPE]
set -euo pipefail

put() { echo "$1=$2" >> "$GITHUB_ENV"; }
src="${GITHUB_WORKSPACE:?}/src"

per_run=false; [[ "${BENCH_CACHE_SCOPE:-}" == run ]] && per_run=true
case "$BENCH_MODE" in
  cold) cache="${RUNNER_TEMP:?}/bench-cache"
        # 2026-11-04 (honesty): from scratch, skip Codemany's local package mirror.
        put npm_config_registry      https://registry.npmjs.org/
        put YARN_NPM_REGISTRY_SERVER https://registry.npmjs.org
        put GOPROXY                  https://proxy.golang.org,direct ;;
  warm) cache="$HOME/.cache/codemany-bench/$BENCH_PROJECT" ;;
  *)    echo "::error::unknown mode '$BENCH_MODE'"; exit 1 ;;
esac
cache_path="$cache"                        # what actions/cache is given
if $per_run; then
  cache_path=".bench-cache/$BENCH_PROJECT" # relative to $GITHUB_WORKSPACE
  cache="$GITHUB_WORKSPACE/$cache_path"
fi
# Empty it first: cold always, warm too per run (only restored files may be in it).
if [[ "$BENCH_MODE" == cold ]] || $per_run; then
  if [[ -d "$cache" ]]; then chmod -R u+w "$cache"; rm -rf "$cache"; fi
fi
mkdir -p "$cache"
put BENCH_CACHE "$cache"
put BENCH_CACHE_PATH "$cache_path"
side="${BENCH_SIDE:-github}"
if $per_run; then
  put BENCH_CACHE_KEY "bench-run-$side-$BENCH_PROJECT-$BENCH_SHA-$RUNNER_OS-$RUNNER_ARCH-${GITHUB_RUN_ID:?}"
else
  prefix="bench-v1"; [[ "$side" == codemany ]] && prefix="bench-v1-codemany"
  put BENCH_CACHE_KEY "$prefix-$BENCH_PROJECT-$BENCH_SHA-$RUNNER_OS-$RUNNER_ARCH"
fi
put BENCH_SCRIPTS "$GITHUB_WORKSPACE/bench/scripts"

# 2026-11-03 (honesty): the per-user caches a tool falls back to live in $cache too, on
# both sides and in both modes. They are the folders Codemany's per-owner dependency cache
# (internal/helper/depcache.go: private repos only, so this public repo gets none) keeps
# between jobs. Pointed here, a cold build never finds one, even in a private copy of this
# bench. The language blocks below point some of them at other folders in $cache.
for v in GOMODCACHE:go/mod GOCACHE:go/build CARGO_HOME:cargo npm_config_cache:npm \
         YARN_CACHE_FOLDER:yarn PIP_CACHE_DIR:pip GRADLE_USER_HOME:gradle \
         XDG_CACHE_HOME:xdg HOMEBREW_CACHE:homebrew; do
  put "${v%%:*}" "$cache/${v#*:}"
done

case "$BENCH_LANG" in
  Rust)
    put RUSTUP_TOOLCHAIN "$BENCH_TOOLCHAIN"
    put CARGO_HOME "$cache/cargo"          # crate downloads
    put CARGO_TARGET_DIR "$cache/target"   # compiled crates
    put CARGO_TERM_COLOR never ;;
  Go)
    put GOMODCACHE "$cache/gomod"
    put GOCACHE "$cache/gobuild"
    put GOFLAGS -modcacherw                # lets cleanup.sh delete the module cache
    put GOTOOLCHAIN local                  # never download a different Go mid-build
    put CGO_ENABLED 0                      # Hugo's standard (non-extended) release build
    put GOBIN "$RUNNER_TEMP/bin" ;;
  Next.js)
    put YARN_CACHE_FOLDER "$cache/yarn"
    put COREPACK_HOME "$cache/corepack"
    put COREPACK_ENABLE_DOWNLOAD_PROMPT 0
    put NEXT_TELEMETRY_DISABLED 1
    corepack enable                        # yarn version from package.json "packageManager"
    mkdir -p "$cache/next" "$src/.next"
    ln -sfn "$cache/next" "$src/.next/cache" ;;
  Node.js)                                 # TypeScript 7: npm + a Go compile (hereby)
    put npm_config_cache "$cache/npm"
    put npm_config_update_notifier false
    put GOMODCACHE "$cache/gomod"
    put GOCACHE "$cache/gobuild"
    put GOFLAGS -modcacherw
    put GOTOOLCHAIN local ;;
  Python)
    put PIP_CACHE_DIR "$cache/pip"
    put PIP_DISABLE_PIP_VERSION_CHECK 1
    put PYTHONUNBUFFERED 1 ;;
  iOS)                                     # xcodebuild caches go by flag (build.sh)
    put npm_config_cache "$cache/npm"
    put npm_config_update_notifier false ;;
  Android)
    put GRADLE_USER_HOME "$cache/gradle"           # wrapper, dependencies, build cache
    put ANDROID_USER_HOME "$cache/android-user"
    put GRADLE_OPTS "-Dorg.gradle.welcome=never" ;;
  C)                                       # Neovim: its deps dir is its cache (CI caches .deps)
    put DEPS_BUILD_DIR "$cache/deps"
    put CC gcc
    put CCACHE_DISABLE 1 ;;
  Docker)
    # A fresh BuildKit builder per job: base images are pulled on both sides.
    # 2026-11-03 (honesty): from scratch, the builder starts with a plain buildkitd.toml, so
    # it pulls base images (node, nginx) from Docker Hub itself on both sides. Otherwise a
    # Codemany Linux machine's builders use its local Docker Hub mirror (internal/regmirror),
    # which still holds them from earlier jobs: a head start GitHub doesn't get. With saved
    # files the mirror stays on: it is how a Codemany machine works (README "What stays").
    builder="bench-$GITHUB_RUN_ID-$GITHUB_RUN_ATTEMPT-$BENCH_PROJECT-$BENCH_MODE"
    conf=()
    if [[ "$BENCH_MODE" == cold ]]; then
      echo "# bench, from scratch (2026-11-03): no registry mirror" > "$RUNNER_TEMP/buildkitd-plain.toml"
      conf=(--buildkitd-config "$RUNNER_TEMP/buildkitd-plain.toml")
    fi
    docker buildx create --name "$builder" --driver docker-container ${conf[@]+"${conf[@]}"} --bootstrap >/dev/null
    put BENCH_BUILDER "$builder" ;;
  Swift) ;;
  *) echo "::error::unknown lang '$BENCH_LANG'"; exit 1 ;;
esac

# Print the machine and tool versions so every run log shows what it ran on.
# (`sed -n 1p` reads all input: `head -1` could SIGPIPE the tool and fail under pipefail.)
echo "machine: $(uname -sm), $(getconf _NPROCESSORS_ONLN) CPUs"
case "$BENCH_LANG" in
  Rust)    rustc --version ;;
  Go)      go version ;;
  Next.js) node --version ;;
  Node.js) node --version; go version ;;
  Python)  python --version ;;
  iOS)     xcodebuild -version | sed -n 1p; node --version ;;
  Android) java -version 2>&1 | sed -n 1p ;;
  C)       gcc --version | sed -n 1p; cmake --version | sed -n 1p ;;
  Docker)  docker version --format 'docker {{.Server.Version}}' ;;
  Swift)   xcodebuild -version | sed -n 1p; swift --version 2>&1 | sed -n 1p ;;
esac
