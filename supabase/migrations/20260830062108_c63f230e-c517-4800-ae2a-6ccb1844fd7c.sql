ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS verified_until timestamptz;

CREATE OR REPLACE FUNCTION public.is_verified_member(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = _user_id
      AND p.verified_at IS NOT NULL
      AND (p.verified_until IS NULL OR p.verified_until > now())
  )
$$;

REVOKE ALL ON FUNCTION public.is_verified_member(uuid) FROM PUBLIC, anon, authenticated;