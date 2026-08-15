-- Allowed only before the publisher row and every Workflow reference are absent.
BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.users WHERE identity_kind = 'workflow-official-publisher-service') THEN
    RAISE EXCEPTION 'official Workflow publisher identity must be absent before rollback';
  END IF;
END;
$$;

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_identity_kind_contract;
ALTER TABLE public.users ADD CONSTRAINT users_identity_kind_contract CHECK (
  (
    identity_kind = 'person' AND email IS NOT NULL AND normalized_email IS NOT NULL
    AND password_hash IS NOT NULL
  ) OR (
    identity_kind = 'workflow-reviewer-service'
    AND id = '5f16d5ac-6663-5905-b920-c2140ac6769c'::uuid
    AND status = 'disabled' AND email IS NULL AND normalized_email IS NULL
    AND phone IS NULL AND normalized_phone IS NULL AND password_hash IS NULL
    AND username = '__workflow_reviewer_service__'
    AND normalized_username = '__workflow_reviewer_service__'
    AND community_username = 'zx_5f16d5ac66635905b920c2140ac'
  )
);

CREATE OR REPLACE FUNCTION public.reject_workflow_reviewer_service_browser_relation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.users WHERE id = NEW.user_id
      AND identity_kind = 'workflow-reviewer-service'
  ) THEN
    RAISE EXCEPTION 'workflow reviewer service identity cannot have browser relations';
  END IF;
  RETURN NEW;
END;
$$;

COMMIT;
