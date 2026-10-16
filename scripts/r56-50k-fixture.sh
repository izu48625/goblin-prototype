#!/usr/bin/env bash
# GitHub Actions ephemeral DB only. Never point at production.
set -euo pipefail
case "${PGHOST:-}" in
  127.0.0.1|localhost) ;;
  *) echo 'R56: unsafe PGHOST' >&2; exit 1;;
esac
temp=$(mktemp --suffix=.sql)
trap 'rm -f "$temp"' EXIT
sed 's/generate_series(1,10000)/generate_series(1,50000)/g' scripts/r53-scale-fixture-init.sql > "$temp"
grep -q 'generate_series(1,50000)' "$temp"
psql -X -v ON_ERROR_STOP=1 -f "$temp" >/dev/null
rows=$(psql -X -A -t -v ON_ERROR_STOP=1 -c 'SELECT count(*) FROM public.topics')
[[ "$rows" == 50000 ]] || { echo "Bad R56 fixture: $rows" >&2; exit 1; }
echo 'R56 isolated 50k rows loaded; no production database touched'
