#!/usr/bin/env bash
# `docker build -t <tag> .` for the bench (2026-10-30), run inside ./src.
# Uses the fresh builder from env.sh, so nothing is left over from earlier jobs.
#   cold: --no-cache, reads no cache.
#   warm: reads layers from $BENCH_CACHE/buildx (same on both sides).
# 2026-11-05: no --cache-to in here any more. Cold used to save nothing (warm then rebuilt
# everything) and warm exported a cache nothing read, inside the timed step (run
# 42109643265). Cold's layers are now exported by docker-cache-export.sh, an untimed step
# after `build`, so the timed step on both sides is only the build itself.
set -euo pipefail
tag="bench/${1:?usage: docker-build.sh <tag>}"
args=(buildx build --builder "${BENCH_BUILDER:?}" --load -t "$tag")

if [[ "$BENCH_MODE" == cold ]]; then
  args+=(--no-cache)
elif [[ -d "$BENCH_CACHE/buildx" ]]; then
  args+=(--cache-from "type=local,src=$BENCH_CACHE/buildx")
else
  echo "::warning::no saved Docker layers in $BENCH_CACHE/buildx; building without them"
fi

docker "${args[@]}" .
