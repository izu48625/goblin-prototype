#!/usr/bin/env bash
# R58-P4: disposable GitHub Actions PostgreSQL only. NEVER run against Supabase.
set -euo pipefail
size="${1:-}"
case "$size" in 1000|10000|50000|100000) ;; *) echo "Invalid synthetic size: $size" >&2; exit 2;; esac
[[ "${PGHOST:-}" == "127.0.0.1" && "${PGPORT:-}" == "5432" &&
   "${PGUSER:-}" == "postgres" && "${PGDATABASE:-}" == "postgres" ]] || {
  echo "Refusing non-disposable database target" >&2; exit 2;
}
[[ -z "${SUPABASE_DB_URL:-}" && -z "${DATABASE_URL:-}" ]] || {
  echo "Unexpected external database URL; refusing" >&2; exit 2;
}
temp=$(mktemp --suffix=.sql)
trap 'rm -f "$temp"' EXIT
sed "s/generate_series(1,10000)/generate_series(1,$size)/g" scripts/r53-scale-fixture-init.sql > "$temp"
grep -Fq "generate_series(1,$size)" "$temp"
echo "R58-P4: creating $size synthetic works in disposable localhost PostgreSQL 17"
psql -X -v ON_ERROR_STOP=1 -f "$temp" >/dev/null
echo 'R58-P4: installing R57 search generated columns / live-compatible candidate RPC'
psql -X -v ON_ERROR_STOP=1 -f R57_DISCOVER_PRECOMPUTED_SEARCH_SCHEMA_CANDIDATE.sql >/dev/null
psql -X -v ON_ERROR_STOP=1 -f R57_DISCOVER_PRECOMPUTED_SEARCH_RPC_CANDIDATE.sql >/dev/null
actual=$(psql -X -A -t -v ON_ERROR_STOP=1 -c 'SELECT COUNT(*) FROM public.topics')
[[ "$actual" == "$size" ]] || { echo "Wrong topic count $actual vs $size" >&2; exit 1; }
# Mutate ONLY isolated fake works to verify live recalculation and hidden-visibility behavior.
psql -X -v ON_ERROR_STOP=1 <<'SQL' >/dev/null
DO $$
DECLARE marker uuid;
BEGIN
  SELECT id INTO marker FROM public.topics WHERE visibility='private' LIMIT 1;
  IF marker IS NULL THEN RAISE EXCEPTION 'No private fixture'; END IF;
  UPDATE public.topics SET title='R58_P4_PRIVATE_HIDDEN_MARKER'
    WHERE id=marker;
  IF NOT EXISTS(SELECT 1 FROM public.topics
     WHERE id=marker AND discover_search_text_en LIKE '%r58_p4_private_hidden_marker%')
  THEN RAISE EXCEPTION 'Generated columns did not update'; END IF;
END $$;
SQL
echo "R58-P4: $size works ready; Private update consistency OK"
