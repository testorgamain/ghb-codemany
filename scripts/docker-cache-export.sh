#!/usr/bin/env bash
# Cold Docker jobs only (2026-11-05), run inside ./src right AFTER the timed `build` step.
# Saves the layers cold just built to $BENCH_CACHE/buildx for the warm job (save cache
# uploads that folder). Same builder, same Dockerfile: every step is already in the
# builder, so this only writes them out. Kept out of `build` on purpose: the export is
# setup for warm, not part of building, and both sides skip its time the same way.
set -euo pipefail
docker buildx build --builder "${BENCH_BUILDER:?}" --output type=cacheonly \
  --cache-to "type=local,dest=$BENCH_CACHE/buildx,mode=max" .
