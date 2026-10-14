-- R41 QA on production-like existing data, run transactionally ONLY.
-- Requires R41 migration statements placed between BEGIN and assertion block.
-- No persistence when ROLLBACK used.
create temp table r41_before as
select x.sort,public.discover_public_works_v1(p_sort=>x.sort) as payload
from (values ('newest'),('popular'),('community'),('remix')) x(sort);
grant select on r41_before to anon;
-- [INSERT R41_DISCOVER_COUNTERS.sql]
-- [INSERT R41_DISCOVER_COUNTER_READERS.sql]
-- [INSERT R41_DISCOVER_RPC_COUNTER_CUTOVER.sql]
set local role anon;
select b.sort,
 (b.payload->>'total')::int expected_count,
 (public.discover_public_works_v1(p_sort=>b.sort)->>'total')::int actual_count,
 (select array_agg(e.value->>'id' order by e.ordinality)
  from jsonb_array_elements(b.payload->'rows') with ordinality e(value,ordinality))
 =
 (select array_agg(e.value->>'id' order by e.ordinality)
  from jsonb_array_elements(public.discover_public_works_v1(p_sort=>b.sort)->'rows')
  with ordinality e(value,ordinality)) as id_order_equal
from r41_before b;
-- [ROLLBACK]
