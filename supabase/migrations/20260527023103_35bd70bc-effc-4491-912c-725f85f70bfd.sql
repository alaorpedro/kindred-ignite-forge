ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS clinic_name text,
  ADD COLUMN IF NOT EXISTS clinic_logo_url text;

-- Migrate existing per-funnel values: pick most recent non-null per owner
UPDATE public.profiles p
SET clinic_name = sub.clinic_name,
    clinic_logo_url = sub.clinic_logo_url
FROM (
  SELECT DISTINCT ON (owner_id) owner_id, clinic_name, clinic_logo_url
  FROM public.funnels
  WHERE clinic_name IS NOT NULL OR clinic_logo_url IS NOT NULL
  ORDER BY owner_id, updated_at DESC
) sub
WHERE p.id = sub.owner_id
  AND p.clinic_name IS NULL
  AND p.clinic_logo_url IS NULL;