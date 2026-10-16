#!/usr/bin/env bash
# R64: disposable GitHub Actions only. Confirm the internal helper is NOT
# directly reachable through the PostgREST public data API.
set -euo pipefail
[[ "${PGHOST:-}" == "127.0.0.1" && "${PGPORT:-}" == "5432" &&
   "${PGUSER:-}" == "postgres" && "${PGDATABASE:-}" == "postgres" ]] || exit 2
[[ -z "${DATABASE_URL:-}" && -z "${SUPABASE_DB_URL:-}" ]] || exit 2
psql -X -v ON_ERROR_STOP=1 <<'SQL' >/dev/null
CREATE ROLE authenticator LOGIN PASSWORD 'r64_qa_not_production' NOINHERIT;
GRANT anon TO authenticator;
SQL
cid=''
cleanup(){ if [[ -n "$cid" ]]; then docker rm -f "$cid" >/dev/null 2>&1 || :; fi; }
trap cleanup EXIT
cid=$(docker run --detach --network host \
  -e PGRST_DB_URI="postgres://authenticator:r64_qa_not_production@127.0.0.1:5432/postgres" \
  -e PGRST_DB_SCHEMAS=public \
  -e PGRST_DB_ANON_ROLE=anon \
  -e PGRST_SERVER_PORT=3000 \
  -e PGRST_DB_POOL=5 \
  postgrest/postgrest:v14.18)
for x in $(seq 1 45); do
  code=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/ || :)
  [[ "$code" == "200" ]] && break
  sleep 1
done
python3 - <<'PY'
import json
import urllib.request
import urllib.error

BASE='http://127.0.0.1:3000'
def get(path, headers=None):
    req=urllib.request.Request(BASE+path, headers=headers or {})
    try:
        r=urllib.request.urlopen(req, timeout=40)
        return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()
a, body=get('/rpc/discover_public_works_v1')
assert a==200, ('Existing Public Discover RPC broken',a,body[:250])
obj=json.loads(body)
assert isinstance(obj,dict) and 'rows' in obj and 'total' in obj and 'has_more' in obj
assert all(x.get('visibility')=='public' for x in obj['rows'])
b, leak=get('/rpc/discover_public_rank_rows_v1')
assert b==404, ('Unexpected public bulk RPC endpoint',b,leak[:250])
c, hidden=get('/rpc/discover_public_rank_rows_v1',
              {'Accept-Profile':'discover_internal'})
assert c==406, ('Internal schema accidentally exposed',c,hidden[:250])
print(f'R64 HTTP security PASS: Public Discover {a}; direct helper {b}; internal profile {c}',flush=True)
print(f'R64 HTTP functional PASS: {len(obj["rows"])} Public-only cards; total={obj["total"]}',flush=True)
PY
