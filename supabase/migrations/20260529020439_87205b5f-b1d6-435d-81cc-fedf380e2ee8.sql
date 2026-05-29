
-- 1) Strengthen guard on crm_lead_cards: prevent non-owners from changing
--    assignee_id to any user other than NULL or themselves, and lock stage moves
--    to the same pipeline. Also explicitly forbid altering owner_id/lead_id/pipeline_id.
CREATE OR REPLACE FUNCTION public.crm_lead_cards_guard_member_updates()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  -- Owner has unrestricted update rights (RLS already scopes to their owner_id)
  IF auth.uid() = OLD.owner_id THEN
    RETURN NEW;
  END IF;

  -- Non-owner (CRM member) restrictions:
  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
    RAISE EXCEPTION 'Apenas o dono pode transferir cards';
  END IF;
  IF NEW.lead_id IS DISTINCT FROM OLD.lead_id THEN
    RAISE EXCEPTION 'Não é permitido trocar o lead vinculado';
  END IF;
  IF NEW.pipeline_id IS DISTINCT FROM OLD.pipeline_id THEN
    RAISE EXCEPTION 'Apenas o dono pode mover cards entre pipelines';
  END IF;
  -- Members may only (un)assign themselves
  IF NEW.assignee_id IS DISTINCT FROM OLD.assignee_id
     AND NEW.assignee_id IS NOT NULL
     AND NEW.assignee_id <> auth.uid() THEN
    RAISE EXCEPTION 'Membros só podem atribuir cards a si mesmos';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS crm_lead_cards_guard_member_updates_trg ON public.crm_lead_cards;
CREATE TRIGGER crm_lead_cards_guard_member_updates_trg
BEFORE UPDATE ON public.crm_lead_cards
FOR EACH ROW
EXECUTE FUNCTION public.crm_lead_cards_guard_member_updates();

-- 2) Defense in depth: ensure anon role cannot read funnel secrets, even if a
--    future policy is added. Public funnel rendering uses the admin client.
REVOKE SELECT (sheets_webhook_url) ON public.funnels FROM anon;
