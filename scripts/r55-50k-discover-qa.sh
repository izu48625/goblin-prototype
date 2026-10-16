#!/usr/bin/env bash
# Standalone GitHub Actions PostgreSQL service only. No production DB access.
set -euo pipefail
[[ "${PGHOST:-}" == '127.0.0.1' || "${PGHOST:-}" == 'localhost' ]] || {
  echo 'Unsafe database target, refusing' >&2;exit 1;
}
tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT
# Reuse the exact 10k fixture and the 14-case parity/EXPLAIN suite, only
# changing the synthetic population size. Do not touch the live SQL fixture.
sed 's/generate_series(1,10000)/generate_series(1,50000)/g' \
  scripts/r53-scale-fixture-init.sql > "$tmp"
grep -q 'generate_series(1,50000)' "$tmp"
echo 'R55: preparing 50,000 synthetic works in isolated PostgreSQL 17'
psql -X -v ON_ERROR_STOP=1 -f "$tmp" >/dev/null
actual=$(psql -X -A -t -v ON_ERROR_STOP=1 -c "select count(*) from public.topics")
[[ "$actual" == 50000 ]] || { echo "Expected 50k works, got $actual" >&2;exit 1; }
echo 'R55: 50k rows loaded; comparing 14 exact JSON result shapes'
psql -X -v ON_ERROR_STOP=1 -f scripts/r53-scale-parity.sql \
  | grep -E 'R53 BASELINE|R53 CANDIDATE|Execution Time:|R53 14 combinations'
echo 'R55: 50,000 synthetic works, 14 exact result parity cases PASS'
