-- Candidate rollback. The service row must first be removed by the same
-- provision process with its current-run receipt and zero Workflow references.
BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.users
     WHERE identity_kind = 'workflow-reviewer-service'
  ) THEN
    RAISE EXCEPTION 'workflow reviewer service identity must be retained or explicitly removed before schema rollback';
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS reject_workflow_reviewer_service_community_profiles ON public.community_profiles;
DROP TRIGGER IF EXISTS reject_workflow_reviewer_service_profile_avatars ON public.profile_avatars;
DROP TRIGGER IF EXISTS reject_workflow_reviewer_service_devices ON public.devices;
DROP TRIGGER IF EXISTS reject_workflow_reviewer_service_sessions ON public.sessions;
DROP TRIGGER IF EXISTS reject_workflow_reviewer_service_community_handoffs ON public.community_handoffs;
DROP TRIGGER IF EXISTS reject_workflow_reviewer_service_email_change_challenges ON public.email_change_challenges;
DROP FUNCTION IF EXISTS public.reject_workflow_reviewer_service_browser_relation();
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_identity_kind_contract;
ALTER TABLE public.users ALTER COLUMN email SET NOT NULL;
ALTER TABLE public.users ALTER COLUMN normalized_email SET NOT NULL;
ALTER TABLE public.users ALTER COLUMN password_hash SET NOT NULL;
ALTER TABLE public.users DROP COLUMN IF EXISTS identity_kind;

COMMIT;
