CREATE TYPE public.moderation_status AS ENUM ('pending','approved','rejected','paused');

ALTER TABLE public.listings
  ADD COLUMN moderation_status public.moderation_status NOT NULL DEFAULT 'pending',
  ADD COLUMN rejection_reason text;

ALTER TABLE public.wanted_ads
  ADD COLUMN moderation_status public.moderation_status NOT NULL DEFAULT 'pending',
  ADD COLUMN rejection_reason text;

UPDATE public.listings SET moderation_status = 'approved';
UPDATE public.wanted_ads SET moderation_status = 'approved';

ALTER TABLE public.profiles ADD COLUMN deactivated_at timestamptz;

CREATE OR REPLACE FUNCTION public.is_active_account(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = _user_id AND p.deactivated_at IS NOT NULL
  )
$$;

REVOKE EXECUTE ON FUNCTION public.is_active_account(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_active_account(uuid) TO authenticated, anon, service_role;

DROP POLICY IF EXISTS listings_public_read ON public.listings;
CREATE POLICY listings_public_read ON public.listings
  FOR SELECT TO public
  USING (published = true AND moderation_status = 'approved' AND public.is_active_account(owner_id));

DROP POLICY IF EXISTS wanted_public_read ON public.wanted_ads;
CREATE POLICY wanted_public_read ON public.wanted_ads
  FOR SELECT TO public
  USING (moderation_status = 'approved' AND public.is_active_account(seeker_id));

CREATE POLICY wanted_owner_read ON public.wanted_ads
  FOR SELECT TO authenticated
  USING (auth.uid() = seeker_id);

CREATE POLICY wanted_admin_read ON public.wanted_ads
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.admin_error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message text NOT NULL,
  detail text,
  route text,
  source text NOT NULL DEFAULT 'server',
  severity text NOT NULL DEFAULT 'error',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, DELETE ON public.admin_error_logs TO authenticated;
GRANT ALL ON public.admin_error_logs TO service_role;

ALTER TABLE public.admin_error_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_error_logs_admin_read ON public.admin_error_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY admin_error_logs_admin_delete ON public.admin_error_logs
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX admin_error_logs_created_at_idx ON public.admin_error_logs (created_at DESC);