-- R42: light indexes for Public-only Discover filtering.
-- Search RPC remains compatible and is NOT changed in this stage.
-- Category expression index will be usable by a future predicate pushdown query.
create index if not exists topics_discover_public_category_idx
on public.topics ((coalesce(snapshot#>>'{metadata,category}','other')),published_at desc,id)
where visibility='public';

-- R42: No new extension, external search service, table exposure, or pay-per-query provider.
-- Full NFKC substring search includes JSON arrays; do not claim that an
-- expression index on title alone would accelerate the current predicate.
