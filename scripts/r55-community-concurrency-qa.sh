#!/usr/bin/env bash
# R55 isolated GitHub Actions PostgreSQL. Never point PGHOST at production.
set -euo pipefail
if [[ "${PGHOST:-}" != "127.0.0.1" && "${PGHOST:-}" != "localhost" ]]; then
  echo "Refusing nonlocal PostgreSQL host" >&2
  exit 1
fi
declare -a pids=()
topic=00000000-0000-4000-8000-000000000101
assert_count() {
  local expected="$1" actual
  actual=$(psql -X -A -t -v ON_ERROR_STOP=1 -c "select participants from private.discover_counters where topic_id='$topic'")
  [[ "$actual" == "$expected" ]] || { echo "Expected $expected, observed $actual" >&2;exit 1; }
}
run_parallel() {
  local phase="$1" count="$2" i id sql pid
  pids=()
  for i in $(seq 1 "$count"); do
    id=$(printf '00000000-0000-4000-8000-%012d' "$((1000+i))")
    case "$phase" in
      insert)
        sql="insert into public.rating_sets(id,topic_id,status) values('$id','$topic','submitted');"
        ;;
      draft)
        sql="update public.rating_sets set status='draft' where id='$id';"
        ;;
      submit)
        sql="update public.rating_sets set status='submitted' where id='$id';"
        ;;
      delete)
        sql="delete from public.rating_sets where id='$id';"
        ;;
      *) echo "Invalid phase" >&2;exit 1;;
    esac
    psql -X -q -v ON_ERROR_STOP=1 -c "$sql" >/dev/null &
    pids+=("$!")
  done
  local failed=0
  for pid in "${pids[@]}"; do
    if ! wait "$pid"; then failed=$((failed+1));fi
  done
  [[ $failed -eq 0 ]] || { echo "$phase: $failed requests failed" >&2;exit 1; }
}
assert_count 0
run_parallel insert 64
assert_count 64
echo 'R55 64 concurrent Community submissions, 0 missed increments PASS'
run_parallel draft 64
assert_count 0
echo 'R55 64 concurrent Community submissions -> draft, 0 missed decrements PASS'
run_parallel submit 64
assert_count 64
echo 'R55 64 concurrent resubmissions, 0 missed increments PASS'
run_parallel delete 64
assert_count 0
echo 'R55 64 concurrent rating deletions, 0 residual participants PASS'
# Repeated status writes are idempotent and must not inflate counters.
psql -X -q -v ON_ERROR_STOP=1 -c "insert into public.rating_sets(id,topic_id,status) values('00000000-0000-4000-8000-000000009999','$topic','submitted')"
psql -X -q -v ON_ERROR_STOP=1 -c "update public.rating_sets set status='submitted' where id='00000000-0000-4000-8000-000000009999'"
assert_count 1
psql -X -q -v ON_ERROR_STOP=1 -c "delete from public.rating_sets where id='00000000-0000-4000-8000-000000009999'"
assert_count 0
echo 'R55 duplicate-submit counter idempotency PASS'
