#!/usr/bin/env bash
# R65: test actual PostgREST JSON name projections against a disposable
# PostgreSQL fixture. No public service, external URL or real user data.
set -euo pipefail
[[ "${PGHOST:-}" == "127.0.0.1" && "${PGPORT:-}" == "5432" &&
   "${PGUSER:-}" == "postgres" && "${PGDATABASE:-}" == "postgres" ]] || exit 2
[[ -z "${DATABASE_URL:-}" && -z "${SUPABASE_DB_URL:-}" ]] || exit 2
psql -X -v ON_ERROR_STOP=1 <<'SQL' >/dev/null
CREATE ROLE authenticator LOGIN PASSWORD 'r65_qa_disposable_only' NOINHERIT;
GRANT anon TO authenticator;
SQL
cid=''
cleanup(){ if [[ -n "$cid" ]]; then docker rm -f "$cid" >/dev/null 2>&1 || :; fi; }
trap cleanup EXIT
cid=$(docker run -d --network host \
  -e PGRST_DB_URI="postgres://authenticator:r65_qa_disposable_only@127.0.0.1:5432/postgres" \
  -e PGRST_DB_SCHEMAS=public -e PGRST_DB_ANON_ROLE=anon \
  -e PGRST_SERVER_PORT=3000 -e PGRST_DB_POOL=5 postgrest/postgrest:v14.18)
for i in $(seq 1 45); do
  code=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/ || :)
  [[ "$code" == 200 ]] && break
  sleep 1
done
python3 - <<'PY'
import urllib.parse, urllib.request, json
BASE='http://127.0.0.1:3000/topics?'
def get(select, extra={}):
  p={'select':select,'visibility':'eq.public','limit':1,**extra}
  req=urllib.request.Request(BASE+urllib.parse.urlencode(p))
  with urllib.request.urlopen(req,timeout=40) as r:
    assert r.status==200
    return json.load(r)
full=get('id,snapshot')
assert len(full)==1
raw=full[0]['snapshot']
projection=['id','title','description','language_code','published_at',
            'snapshot_updated_at','visibility']
projection.extend(f'seo_row_{i}:snapshot->rows->{i}->>name' for i in range(18))
projection.extend(f'seo_metric_{i}:snapshot->criteria->{i}' for i in range(10))
reduced=get(','.join(projection))
assert len(reduced)==1
item=reduced[0]
assert item['id']==full[0]['id']
assert 'snapshot' not in item
for i in range(18):
  source=raw.get('rows',[])
  expected=source[i].get('name') if i<len(source) and isinstance(source[i],dict) else None
  assert item.get(f'seo_row_{i}')==expected,(i,item.get(f'seo_row_{i}'),expected)
for i in range(10):
  source=raw.get('criteria',[])
  expected=source[i] if i<len(source) else None
  assert item.get(f'seo_metric_{i}')==expected,(i,item.get(f'seo_metric_{i}'),expected)
hidden=get('id',{'id':'eq.00000000-0000-0000-0000-000000000000'})
assert hidden==[]
print('R65 real PostgREST JSON projection PASS: 18 row labels/10 metrics, no snapshot, Public-only',flush=True)
PY
