#!/usr/bin/env bash
# Isolated PostgreSQL only: 10,000 synthetic works, 20 parallel anon readers.
set -euo pipefail
tmpdir=$(mktemp -d)
trap 'rm -rf "$tmpdir"' EXIT
for i in $(seq 1 20); do
  (
    if ((i%2==0)); then sort_mode=newest; else sort_mode=popular; fi
    begin=$(date +%s%3N)
    n=$(psql -X -q -A -t -v ON_ERROR_STOP=1 -c "
      BEGIN READ ONLY;
      SET LOCAL ROLE anon;
      SELECT jsonb_array_length(public.discover_public_works_v1(
        p_sort=>'$sort_mode',p_limit=>12,
        p_anchor=>'2026-10-16 00:00:00+00'::timestamptz)->'rows');
      ROLLBACK;")
    case "$n" in
      ''|*[!0-9]*) echo "Unexpected Discover response" >&2; exit 1;;
    esac
    if ((n>12)); then echo "Too many cards" >&2;exit 1;fi
    elapsed=$(( $(date +%s%3N) - begin ))
    echo "$elapsed" > "$tmpdir/read-$i.ms"
  ) &
done
wait
count=$(find "$tmpdir" -name 'read-*.ms' | wc -l)
[[ $count -eq 20 ]] || { echo "Parallel queries failed: completed=$count" >&2;exit 1; }
cat "$tmpdir"/read-*.ms | sort -n > "$tmpdir/latencies"
p50=$(sed -n '10p' "$tmpdir/latencies")
p95=$(sed -n '19p' "$tmpdir/latencies")
max=$(tail -n 1 "$tmpdir/latencies")
echo "R54 isolated 10k-works, 20 parallel anon reads PASS; client wallclock p50=$p50 ms p95=$p95 ms max=$max ms"
echo "Isolated Postgres process+query timing ONLY, not production HTTP or iPhone p95."
