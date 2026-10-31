-- R123: Keep previously submitted ratings private until 5 voters; new topics can use 1.
ALTER TABLE public.topics
  ADD COLUMN IF NOT EXISTS community_minimum smallint NOT NULL DEFAULT 5
  CHECK (community_minimum IN (1,5));

CREATE OR REPLACE FUNCTION private.prevent_community_minimum_change()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $guard$
BEGIN
  IF NEW.community_minimum IS DISTINCT FROM OLD.community_minimum THEN
    RAISE EXCEPTION 'Community visibility threshold cannot be changed after publication.';
  END IF;
  RETURN NEW;
END;
$guard$;

DROP TRIGGER IF EXISTS prevent_community_minimum_change ON public.topics;
CREATE TRIGGER prevent_community_minimum_change
BEFORE UPDATE ON public.topics
FOR EACH ROW EXECUTE FUNCTION private.prevent_community_minimum_change();

CREATE OR REPLACE FUNCTION public.get_community_item_summary(p_topic_id uuid)
 RETURNS TABLE(item_id uuid, response_count bigint, avg_overall numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with topic_config as (
    select t.weighted
    from public.topics t
    where t.id = p_topic_id
      and t.show_community = true
      and t.visibility in ('public','unlisted')
  ),
  criterion_count as (
    select count(*)::bigint as n
    from public.criteria c
    where c.topic_id = p_topic_id
  ),
  participant_item as (
    select
      rs.id as rating_set_id,
      s.item_id,
      case
        when (select weighted from topic_config limit 1) then
          sum(s.score * greatest(coalesce(c.weight,1),0))
          / nullif(sum(greatest(coalesce(c.weight,1),0)),0)
        else avg(s.score)
      end as overall
    from public.rating_sets rs
    join public.scores s
      on s.rating_set_id = rs.id and s.topic_id = p_topic_id
    join public.criteria c
      on c.id = s.criterion_id and c.topic_id = p_topic_id
    where rs.topic_id = p_topic_id
      and rs.status = 'submitted'
      and exists (select 1 from topic_config)
    group by rs.id,s.item_id
    having count(distinct s.criterion_id) = (select n from criterion_count)
  ),
  aggregated as (
    select
      pi.item_id,
      count(*)::bigint as response_count,
      avg(pi.overall)::numeric as raw_average
    from participant_item pi
    where pi.overall is not null
    group by pi.item_id
  )
  select
    a.item_id,
    a.response_count,
    case when a.response_count >= coalesce((select t.community_minimum from public.topics t where t.id = p_topic_id), 5)
      then round(a.raw_average,2)
      else null::numeric
    end as avg_overall
  from aggregated a;
$function$;
CREATE OR REPLACE FUNCTION public.get_community_criterion_summary(p_topic_id uuid)
 RETURNS TABLE(item_id uuid, criterion_id uuid, response_count bigint, avg_score numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with aggregated as (
    select
      s.item_id,
      s.criterion_id,
      count(distinct rs.id)::bigint as response_count,
      avg(s.score)::numeric as raw_average
    from public.rating_sets rs
    join public.scores s
      on s.rating_set_id = rs.id and s.topic_id = p_topic_id
    where rs.topic_id = p_topic_id
      and rs.status = 'submitted'
      and exists (
        select 1 from public.topics t
        where t.id = p_topic_id
          and t.show_community = true
          and t.visibility in ('public','unlisted')
      )
    group by s.item_id,s.criterion_id
  )
  select
    a.item_id,
    a.criterion_id,
    a.response_count,
    case when a.response_count >= coalesce((select t.community_minimum from public.topics t where t.id = p_topic_id), 5)
      then round(a.raw_average,2)
      else null::numeric
    end as avg_score
  from aggregated a;
$function$;

COMMENT ON COLUMN public.topics.community_minimum IS
  'Immutable disclosure threshold. Legacy works default to 5; new works may explicitly use 1 on insert.';
