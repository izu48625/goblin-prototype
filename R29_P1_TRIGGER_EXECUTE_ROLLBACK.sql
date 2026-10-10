-- R29 P1 rollback: restore original effective (PUBLIC) EXECUTE.
-- Original proacl for each of these five functions was NULL, hence PostgreSQL
-- default granted EXECUTE to PUBLIC. This restores those effective grants.
GRANT EXECUTE ON FUNCTION
  public.prevent_locked_criterion_structure(),
  public.prevent_locked_item_structure(),
  public.prevent_locked_topic_structure(),
  public.validate_rating_submission(),
  public.validate_score_range()
TO PUBLIC;
REVOKE EXECUTE ON FUNCTION
  public.prevent_locked_criterion_structure(),
  public.prevent_locked_item_structure(),
  public.prevent_locked_topic_structure(),
  public.validate_rating_submission(),
  public.validate_score_range()
FROM service_role;
