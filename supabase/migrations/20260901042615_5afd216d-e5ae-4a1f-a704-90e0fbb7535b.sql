ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_business boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS company_name text,
  ADD COLUMN IF NOT EXISTS abn text;

CREATE TABLE IF NOT EXISTS public.profile_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  path text NOT NULL,
  label text NOT NULL DEFAULT 'ID document',
  mime_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.profile_documents TO authenticated;
GRANT ALL ON public.profile_documents TO service_role;

ALTER TABLE public.profile_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY pd_own_insert ON public.profile_documents
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY pd_own_read ON public.profile_documents
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY pd_own_delete ON public.profile_documents
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS profile_documents_user_idx ON public.profile_documents(user_id);

-- Storage policies for the private avatars bucket: members own their folder.
CREATE POLICY "avatars_own_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'avatars' AND (owner = auth.uid() OR public.has_role(auth.uid(), 'admin')));
CREATE POLICY "avatars_own_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "avatars_own_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "avatars_own_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE OR REPLACE FUNCTION public.is_profile_complete(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = _user_id
      AND coalesce(btrim(p.display_name), '') <> ''
      AND coalesce(btrim(p.avatar_url), '') <> ''
      AND coalesce(btrim(p.phone), '') <> ''
      AND (
        p.is_business = false
        OR (coalesce(btrim(p.company_name), '') <> '' AND coalesce(btrim(p.abn), '') <> '')
      )
      AND EXISTS (SELECT 1 FROM public.profile_documents d WHERE d.user_id = p.id)
  )
$$;

CREATE OR REPLACE FUNCTION public.require_complete_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _owner uuid;
BEGIN
  IF TG_TABLE_NAME = 'listings' THEN
    _owner := NEW.owner_id;
  ELSE
    _owner := NEW.seeker_id;
  END IF;

  IF _owner IS NOT NULL AND NOT public.is_profile_complete(_owner) THEN
    RAISE EXCEPTION 'PROFILE_INCOMPLETE: complete your profile (photo, name, phone, ID document) before publishing';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS listings_require_profile ON public.listings;
CREATE TRIGGER listings_require_profile
  BEFORE INSERT ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.require_complete_profile();

DROP TRIGGER IF EXISTS wanted_require_profile ON public.wanted_ads;
CREATE TRIGGER wanted_require_profile
  BEFORE INSERT ON public.wanted_ads
  FOR EACH ROW EXECUTE FUNCTION public.require_complete_profile();