CREATE TYPE public.app_role AS ENUM ('admin','moderator','user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY user_roles_read_own ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY user_roles_admin_write ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Admin visibility / moderation across the marketplace
CREATE POLICY listings_admin_read ON public.listings
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY listings_admin_update ON public.listings
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY listings_admin_delete ON public.listings
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY wanted_admin_update ON public.wanted_ads
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY wanted_admin_delete ON public.wanted_ads
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY applications_admin_read ON public.applications
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY comments_admin_delete ON public.comments
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY listing_photos_admin_delete ON public.listing_photos
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
