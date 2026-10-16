#!/usr/bin/env python3
"""R58-P4 isolated localhost Postgres search stress. Never connects to production."""
import concurrent.futures
import json
import os
import pathlib
import statistics
import subprocess
import sys
import threading
import time

SIZES = {1000, 10000, 50000, 100000}
CONCURRENCY = (1, 5, 20, 50)
# Diverse actual RPC paths, including expensive popular rank and one-character search.
CASES = (
    ("newest-all", "", "all", "all", "newest", "ja"),
    ("ja-short", "サ", "all", "all", "newest", "ja"),
    ("ja-multi", "サッカー 日本チーム", "all", "all", "newest", "ja"),
    ("en-short", "h", "all", "all", "newest", "en"),
    ("en-popular", "hero", "all", "all", "popular", "en"),
    ("community-sort", "サッカー", "all", "community", "community", "ja"),
    ("category", "サッカー", "sports", "all", "popular", "ja"),
)
ANON_SQL = "SET ROLE anon; "
ANCHOR = "'2026-10-16 00:00:00+00'::timestamptz"
PG_ARGS = ["psql", "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1"]

def percentile(data, p):
    if not data:
        return None
    seq = sorted(data)
    return round(seq[max(0, (len(seq) * p + 99) // 100 - 1)], 2)

def sql_string(value):
    return "'" + value.replace("'", "''") + "'"

def query_sql(case):
    _, q, category, view, sort, locale = case
    params = ",".join(sql_string(v) for v in (q, category, view, sort, locale))
    return f"""WITH started AS MATERIALIZED
 (SELECT clock_timestamp() AS at),
 payload AS MATERIALIZED
 (SELECT public.discover_public_works_v1({params},0,12,{ANCHOR}) AS j FROM started)
 SELECT json_build_object(
  'db_ms',ROUND((extract(epoch FROM clock_timestamp() -
             (SELECT at FROM started))*1000)::numeric,3),
  'bytes',octet_length(payload.j::text),
  'total',(payload.j->>'total')::bigint,
  'rows',jsonb_array_length(payload.j->'rows'),
  'public_only',NOT EXISTS (
     SELECT 1 FROM jsonb_array_elements(payload.j->'rows') AS item
      WHERE item->>'visibility' IS DISTINCT FROM 'public'
  )
 ) FROM payload;"""

def run_one(case, timeout=36):
    started = time.perf_counter()
    env = os.environ.copy()
    env["PGOPTIONS"] = "-c statement_timeout=30000 -c lock_timeout=2000"
    try:
        p = subprocess.run(PG_ARGS + ["-c", ANON_SQL + query_sql(case)],
                           capture_output=True, text=True, timeout=timeout, env=env)
        wall_ms = (time.perf_counter() - started) * 1000
        if p.returncode:
            return {"name":case[0], "wall_ms":round(wall_ms,2),
                    "error":("psql "+p.stderr.strip())[:350]}
        values = [line.strip() for line in p.stdout.splitlines() if line.strip()]
        obj = json.loads(values[-1])
        if not obj["public_only"]:
            raise AssertionError("Private/Unlisted data appeared in discover output")
        if obj["rows"] > 12 or obj["total"] < obj["rows"]:
            raise AssertionError("Invalid pagination")
        return {"name":case[0], "wall_ms":round(wall_ms,2),
                "db_ms":float(obj["db_ms"]), "bytes":obj["bytes"],
                "total":obj["total"], "rows":obj["rows"]}
    except subprocess.TimeoutExpired:
        return {"name":case[0], "wall_ms":round((time.perf_counter()-started)*1000,2),
                "error":"client timeout (36s)"}
    except Exception as exc:
        return {"name":case[0], "wall_ms":round((time.perf_counter()-started)*1000,2),
                "error":str(exc)[:350]}

class CpuSampler:
    """Best-effort Docker CPU and memory snapshots; not reliable CPU totals."""
    def __init__(self):
        self.stop = threading.Event()
        self.samples = []
        self.name = None
        try:
            p = subprocess.run(["docker", "ps", "--format", "{{.Names}}"],
                               capture_output=True, text=True, timeout=5)
            self.name = next((line for line in p.stdout.splitlines()
                              if "postgres" in line.lower()), None)
        except (OSError, subprocess.TimeoutExpired):
            pass

    def sample(self):
        while not self.stop.is_set():
            if self.name:
                try:
                    p = subprocess.run(
                        ["docker", "stats", "--no-stream",
                         "--format", "{{.CPUPerc}}|{{.MemUsage}}", self.name],
                        capture_output=True, text=True, timeout=7)
                    a = p.stdout.strip().split("|")
                    if len(a) == 2:
                        self.samples.append({"cpu_pct":float(a[0].strip().rstrip("%")),
                                             "memory":a[1].strip()})
                except (OSError, ValueError, subprocess.TimeoutExpired):
                    pass
            self.stop.wait(2)

def report(values):
    good = [v for v in values if not v.get("error")]
    return {
        "requests":len(values), "ok":len(good), "errors":len(values)-len(good),
        "wall_p50_ms":percentile([v["wall_ms"] for v in good],50),
        "wall_p95_ms":percentile([v["wall_ms"] for v in good],95),
        "wall_p99_ms":percentile([v["wall_ms"] for v in good],99),
        "server_p50_ms":percentile([v["db_ms"] for v in good],50),
        "server_p95_ms":percentile([v["db_ms"] for v in good],95),
        "server_p99_ms":percentile([v["db_ms"] for v in good],99),
        "mean_response_bytes":round(statistics.mean(v["bytes"] for v in good)) if good else None,
        "errors_sample":[v["error"] for v in values if v.get("error")][:3],
    }

def psql_scalar(sql):
    p = subprocess.run(PG_ARGS + ["-c", sql], capture_output=True, text=True,timeout=40,check=True)
    return p.stdout.strip()

def main():
    if len(sys.argv) != 2 or not sys.argv[1].isdigit() or int(sys.argv[1]) not in SIZES:
        raise SystemExit("Usage: r58-p4-load.py 1000|10000|50000|100000")
    size = int(sys.argv[1])
    if (os.getenv("PGHOST"),os.getenv("PGPORT"),os.getenv("PGUSER"),os.getenv("PGDATABASE")) != (
        "127.0.0.1","5432","postgres","postgres"):
        raise SystemExit("Refusing non-local disposable PostgreSQL")
    if os.getenv("DATABASE_URL") or os.getenv("SUPABASE_DB_URL"):
        raise SystemExit("Refusing external database URL")
    total = int(psql_scalar("SELECT count(*) FROM public.topics;"))
    if total != size:
        raise SystemExit(f"Fixture mismatch {total} != {size}")
    # This sentinel only exists in one Private fixture. As anon it must yield zero.
    hidden = run_one(("private-isolation","R58_P4_PRIVATE_HIDDEN_MARKER","all","all","newest","en"))
    if hidden.get("error") or hidden["total"] != 0:
        raise SystemExit(f"SECURITY FAIL: hidden fixture leaked or unavailable: {hidden}")
    stats = {"size":size,"environment":"Postgres 17 GitHub Actions ephemeral DB; psql-local HTTP not tested",
             "actual_works":total,"private_isolation":"PASS","initial":{},"concurrency":{},
             "cpu_note":"Docker cpu_pct is intermittent instantaneous sampling, not CPU time or production CPU"}
    print(f"R58-P4 START size={size}, private isolation PASS",flush=True)
    # Immediately after fixture/index builds: first-request probe (NOT a flushed OS cold cache).
    initial = [run_one(case) for case in CASES]
    stats["initial"] = report(initial)
    print(f"R58-P4 initial: {stats['initial']}",flush=True)
    sampler = CpuSampler()
    t = threading.Thread(target=sampler.sample,daemon=True)
    t.start()
    try:
        for concurrency in CONCURRENCY:
            n = max(35, concurrency * 2)
            cases = [CASES[i % len(CASES)] for i in range(n)]
            started = time.perf_counter()
            with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as pool:
                results = list(pool.map(run_one,cases))
            elapsed = time.perf_counter() - started
            summary = report(results)
            summary["throughput_req_s"] = round(n / elapsed,2)
            summary["wall_clock_seconds"] = round(elapsed,2)
            summary["by_case"] = {case[0]:report([x for x in results if x["name"]==case[0]])
                                  for case in CASES}
            stats["concurrency"][str(concurrency)] = summary
            print(f"R58-P4 size={size} parallel={concurrency}: {summary['ok']}/{n} OK, "
                  f"wall p95={summary['wall_p95_ms']}ms server p95={summary['server_p95_ms']}ms "
                  f"throughput={summary['throughput_req_s']}/s errors={summary['errors']}",flush=True)
    finally:
        sampler.stop.set()
        t.join(timeout=9)
    stats["cpu_samples"]={"n":len(sampler.samples),
                          "max_cpu_pct":max((a["cpu_pct"] for a in sampler.samples),default=None),
                          "last_memory":sampler.samples[-1]["memory"] if sampler.samples else None}
    stats["db_bytes"] = int(psql_scalar("SELECT pg_database_size(current_database());"))
    directory = pathlib.Path("artifacts")
    directory.mkdir(exist_ok=True)
    (directory / f"r58-p4-load-{size}.json").write_text(
        json.dumps(stats,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    path = os.getenv("GITHUB_STEP_SUMMARY")
    if path:
        with open(path,"a",encoding="utf-8") as f:
            f.write(f"### R58-P4 isolated {size:,} works\n\n")
            f.write("|Parallel|Success|p50 local ms|p95 local ms|p99 local ms|p95 DB ms|req/s|\n")
            f.write("|--:|--:|--:|--:|--:|--:|--:|\n")
            for k,val in stats["concurrency"].items():
                f.write(f"|{k}|{val['ok']}/{val['requests']}|{val['wall_p50_ms']}|"
                        f"{val['wall_p95_ms']}|{val['wall_p99_ms']}|{val['server_p95_ms']}|"
                        f"{val['throughput_req_s']}|\n")
            f.write(f"\nPrivate isolation **PASS**. DB approx {stats['db_bytes']:,} bytes. "
                    "Local psql wall time, **NOT HTTPS/Cloudflare/Supabase production latency**. "
                    "Any DB errors are reported in uploaded JSON. "
                    "Cache first-request is not a forced cold-OS-cache test.\n")
    if any(v["errors"] for v in stats["concurrency"].values()):
        print("R58-P4 WARNING: one or more stressed requests timed out / failed; see JSON",flush=True)
    print(f"R58-P4 DONE {size} works. Detail: artifacts/r58-p4-load-{size}.json",flush=True)

if __name__ == "__main__":
    main()
