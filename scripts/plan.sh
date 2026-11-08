#!/usr/bin/env bash
# Turns data/projects.json into the bench matrices, printed as GitHub step outputs (2026-10-30).
#   github_cold / github_warm = every project, one mode each (2026-11-02: GitHub's warm
#   jobs wait for all cold jobs, whose saves they restore; see bench.yml);
#   linux / macos = the Codemany halves by OS, each project's cold right before its warm.
#   linux_late (2026-11-07, CMY-99) = the warm jobs of Docker projects, run by bench.yml's
#   codemany-linux-late job AFTER codemany-linux, whose matrix ends with their cold jobs.
#   A Docker cold job can be refused on a machine's shared Docker and is re-run in a job
#   VM only once the run has ended; as a dependant job, its warm job is re-run with it.
# Keeping the matrix in projects.json means the pinned SHAs live in exactly one place.
set -euo pipefail
file="${1:-data/projects.json}"

# $1 = jq condition that picks projects; $2 = jq stream of modes, in order.
matrix() {
  jq -c "[.[] | select($1)
    | {project: .id, repo, sha, lang, os, toolchain} as \$p
    | ($2) | \$p + {mode: .}]" "$file"
}

# Concatenates the JSON arrays given as arguments into one compact array.
concat() {
  printf '%s\n' "$@" | jq -cs 'add // []'
}

echo "github_cold=$(matrix 'true' '"cold"')"
echo "github_warm=$(matrix 'true' '"warm"')"
echo "linux=$(concat "$(matrix '.os == "linux" and .lang != "Docker"' '"cold", "warm"')" \
                     "$(matrix '.os == "linux" and .lang == "Docker"' '"cold"')")"
echo "linux_late=$(matrix '.os == "linux" and .lang == "Docker"' '"warm"')"
echo "macos=$(matrix '.os == "macos"' '"cold", "warm"')"
