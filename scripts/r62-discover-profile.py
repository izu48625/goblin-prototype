#!/usr/bin/env python3
"""R62: audit the exact R60 SQL shape in isolated PostgreSQL only.

Direct-body EXPLAIN substitutes literal arguments so the planner may choose a
different plan than the stored RPC. These results are diagnostic, NOT production
network or function execution timings.
"""
import json
import os
from pathlib import Path
import re
import subprocess
import sys

CASES = [
    ("newest_empty", "", "all", "all", "newest", "ja"),
    ("popular_empty", "", "all", "all", "popular", "ja"),
    ("community_short", "サ", "all", "community", "community", "ja"),
    ("japanese_one_char", "サ", "all", "all", "newest", "ja"),
    ("english_hero_popular", "hero", "all", "all", "popular", "en"),
    ("category_sports", "サッカー", "sports", "all", "popular", "ja"),
]
ANCHOR="'2026-10-16 00:00:00+00'::timestamptz"
PG=["psql","-X","-q","-A","-t","-v","ON_ERROR_STOP=1"]

def lit(s):
    return "'" + s.replace("'", "''") + "'"

def explain(sql):
    command="SET ROLE anon; SET statement_timeout='45s'; EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) "+sql.rstrip().rstrip(";")+";"
    r=subprocess.run(PG+["-c",command],capture_output=True,text=True,timeout=54,check=False)
    if r.returncode:
        raise RuntimeError(r.stderr[-1700:])
    parsed=json.loads(r.stdout.strip())
    if not isinstance(parsed,list) or not parsed:
        raise RuntimeError("Invalid EXPLAIN result")
    return parsed[0]

def summarize(report):
    entries=[]
    def walk(node,depth=0):
        entries.append({
            "depth":depth,"type":node.get("Node Type"),
            "cte":node.get("CTE Name"),"relation":node.get("Relation Name"),
            "join":node.get("Join Type"),
            "rows":node.get("Actual Rows"),"loops":node.get("Actual Loops"),
            "time_ms":round(node.get("Actual Total Time",0)*node.get("Actual Loops",1),3),
            "shared_hit":node.get("Shared Hit Blocks",0),
            "shared_read":node.get("Shared Read Blocks",0),
            "temp_written":node.get("Temp Written Blocks",0),
            "temp_read":node.get("Temp Read Blocks",0),
            "sort_method":node.get("Sort Method"),
        })
        for key in ("Plans",):
            for ch in node.get(key,[]): walk(ch,depth+1)
    walk(report["Plan"])
    return {
        "planning_ms":round(report.get("Planning Time",0),2),
        "execution_ms":round(report.get("Execution Time",0),2),
        "top_nodes":sorted(entries,key=lambda x:x["time_ms"],reverse=True)[:18],
        "all_nodes":entries,
    }

def main():
    allowed={1000,10000,50000,100000}
    if len(sys.argv)!=2 or not sys.argv[1].isdigit() or int(sys.argv[1]) not in allowed:
        raise SystemExit("usage: r62-profile.py 1000|10000|50000|100000")
    size=int(sys.argv[1])
    if tuple(os.environ.get(x) for x in ("PGHOST","PGPORT","PGUSER","PGDATABASE")) != (
        "127.0.0.1","5432","postgres","postgres"):
        raise SystemExit("Refusing any non-local isolated postgres host")
    if os.getenv("SUPABASE_DB_URL") or os.getenv("DATABASE_URL"):
        raise SystemExit("No external DB URLs allowed")
    sql=Path("R60_DISCOVER_FUSED_COUNTS_RPC_CANDIDATE.sql").read_text(encoding="utf-8")
    body=sql.split("AS $function$",1)[1].split("$function$;",1)[0].strip().rstrip(";")
    if not body.lower().startswith("with args as"):
        raise SystemExit("Not an R60 query body")
    output={"size":size,"environment":"disposable postgres 17 local ONLY",
            "caution":"Literal-substituted direct body EXPLAIN, may differ from plan in actual SQL RPC",
            "cases":{},"components":{}}
    for name,query,category,view,sort,locale in CASES:
        replacements={"p_query":lit(query),"p_category":lit(category),"p_view":lit(view),
                      "p_sort":lit(sort),"p_locale":lit(locale),
                      "p_offset":"0","p_limit":"12","p_anchor":ANCHOR}
        plain=body
        for key,val in replacements.items():
            plain=re.sub(r"\b"+key+r"\b",lambda _:val,plain)
        report=summarize(explain(plain))
        output["cases"][name]=report
        print(f"R62 {size} {name}: execution {report['execution_ms']}ms; "
              f"top={[(v['type'],v['time_ms'],v['rows']) for v in report['top_nodes'][:4]]}",
              flush=True)
    components={
        "public_count": "SELECT count(*) FROM public.topics t WHERE t.visibility='public' AND (t.published_at IS NULL OR t.published_at<="+ANCHOR+")",
        "one_char_search_count": "SELECT count(*) FROM public.topics t WHERE t.visibility='public' AND t.discover_search_text_ja LIKE '%サ%'",
        "sports_category_count": "SELECT count(*) FROM public.topics t WHERE t.visibility='public' AND t.snapshot#>>'{metadata,category}'='sports'",
        "all_public_pair_lookup": "SELECT sum((public.discover_public_rank_pair_v1(t.id))[1]) FROM public.topics t WHERE t.visibility='public'",
        "newest_top12": "SELECT t.id FROM public.topics t WHERE t.visibility='public' ORDER BY coalesce(t.published_at,t.snapshot_updated_at,'epoch'::timestamptz) DESC,t.id ASC LIMIT 12"
    }
    for name,sql in components.items():
        report=summarize(explain(sql))
        output["components"][name]={
            "execution_ms":report["execution_ms"],
            "top_nodes":report["top_nodes"][:7]
        }
        print(f"R62 COMPONENT {size} {name}: {report['execution_ms']}ms",flush=True)
    Path("artifacts").mkdir(exist_ok=True)
    out=Path("artifacts")/f"r62-profile-{size}.json"
    out.write_text(json.dumps(output,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
    summary=os.getenv("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary,"a",encoding="utf-8") as f:
            f.write(f"## R62 Discover SQL profile ({size:,} works)\n\n")
            f.write("|Full RPC body case|EXPLAIN exec ms|Highest top-node elapsed ms|\n|---|---:|---:|\n")
            for name,record in output["cases"].items():
                f.write(f"|{name}|{record['execution_ms']}|{record['top_nodes'][0]['time_ms']}|\n")
            f.write("\n|Microprobe|EXPLAIN exec ms|\n|---|---:|\n")
            for name,record in output["components"].items():
                f.write(f"|{name}|{record['execution_ms']}|\n")
            f.write("\nThe microprobes are **not** summable to the actual RPC; direct query plans can differ. Full details in artifact JSON.\n")

if __name__=="__main__":
    main()
