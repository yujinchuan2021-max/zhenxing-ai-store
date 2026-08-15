-- Candidate only. Apply explicitly after identity/schema.sql and before any
-- production Workflow reviewer write. Do not add to identity/schema.sql or a
-- runtime entrypoint.
BEGIN;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS identity_kind TEXT NOT NULL DEFAULT 'person';
ALTER TABLE public.users ALTER COLUMN email DROP NOT NULL;
ALTER TABLE public.users ALTER COLUMN normalized_email DROP NOT NULL;
ALTER TABLE public.users ALTER COLUMN password_hash DROP NOT NULL;

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_identity_kind_contract;
ALTER TABLE public.users ADD CONSTRAINT users_identity_kind_contract CHECK (
  (
    identity_kind = 'person' AND email IS NOT NULL AND normalized_email IS NOT NULL
    AND password_hash IS NOT NULL
  ) OR (
    identity_kind = 'workflow-reviewer-service'
    AND id = '5f16d5ac-6663-5905-b920-c2140ac6769c'::uuid
    AND status = 'disabled'
    AND email IS NULL AND normalized_email IS NULL
    AND phone IS NULL AND normalized_phone IS NULL
    AND password_hash IS NULL
    AND username = '__workflow_reviewer_service__'
    AND normalized_username = '__workflow_reviewer_service__'
    AND community_username = 'zx_5f16d5ac66635905b920c2140ac'
  )
);

CREATE OR REPLACE FUNCTION public.reject_workflow_reviewer_service_browser_relation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.users
     WHERE id = NEW.user_id AND identity_kind = 'workflow-reviewer-service'
  ) THEN
    RAISE EXCEPTION 'workflow reviewer service identity cannot have browser relations';
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  target text;
BEGIN
  FOREACH target IN ARRAY ARRAY[
    'community_profiles', 'profile_avatars', 'devices', 'sessions',
    'community_handoffs', 'email_change_challenges'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS reject_workflow_reviewer_service_%I ON public.%I', target, target);
    EXECUTE format(
      'CREATE TRIGGER reject_workflow_reviewer_service_%I BEFORE INSERT OR UPDATE OF user_id ON public.%I FOR EACH ROW EXECUTE FUNCTION public.reject_workflow_reviewer_service_browser_relation()',
      target, target
    );
  END LOOP;
END;
$$;

COMMIT;
