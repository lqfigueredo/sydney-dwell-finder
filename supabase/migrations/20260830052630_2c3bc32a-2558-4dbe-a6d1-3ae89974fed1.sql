ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS verified_by uuid;

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS photo_removed_note text;

CREATE OR REPLACE FUNCTION public.is_verified_member(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = _user_id AND p.verified_at IS NOT NULL
  )
$$;

CREATE OR REPLACE FUNCTION public.autoapprove_for_verified()
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

  IF _owner IS NOT NULL AND public.is_verified_member(_owner) THEN
    NEW.moderation_status := 'approved'::moderation_status;
    NEW.rejection_reason := NULL;
  END IF;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS listings_autoapprove_verified ON public.listings;
CREATE TRIGGER listings_autoapprove_verified
  BEFORE INSERT ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.autoapprove_for_verified();

DROP TRIGGER IF EXISTS wanted_autoapprove_verified ON public.wanted_ads;
CREATE TRIGGER wanted_autoapprove_verified
  BEFORE INSERT ON public.wanted_ads
  FOR EACH ROW EXECUTE FUNCTION public.autoapprove_for_verified();