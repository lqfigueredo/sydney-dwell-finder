CREATE TYPE public.verification_status AS ENUM ('none','pending','needs_info','approved','rejected','revoked');
CREATE TYPE public.verification_member_kind AS ENUM ('owner','agent','seeker');

ALTER TABLE public.profiles
  ADD COLUMN verification_status public.verification_status NOT NULL DEFAULT 'none',
  ADD COLUMN verification_note text;

UPDATE public.profiles SET verification_status = 'approved' WHERE verified_at IS NOT NULL;

CREATE TABLE public.verification_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_kind public.verification_member_kind NOT NULL DEFAULT 'owner',
  full_name text NOT NULL,
  phone text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  status public.verification_status NOT NULL DEFAULT 'pending',
  decision_reason text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.verification_requests TO authenticated;
GRANT ALL ON public.verification_requests TO service_role;
ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY vr_own_read ON public.verification_requests FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY vr_own_insert ON public.verification_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'pending');
CREATE POLICY vr_admin_update ON public.verification_requests FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER verification_requests_updated_at BEFORE UPDATE ON public.verification_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX verification_requests_user_idx ON public.verification_requests(user_id, created_at DESC);

CREATE TABLE public.verification_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.verification_requests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  path text NOT NULL,
  label text NOT NULL DEFAULT 'Document',
  mime_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.verification_documents TO authenticated;
GRANT ALL ON public.verification_documents TO service_role;
ALTER TABLE public.verification_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY vd_own_read ON public.verification_documents FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY vd_own_insert ON public.verification_documents FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND EXISTS (
    SELECT 1 FROM public.verification_requests r WHERE r.id = request_id AND r.user_id = auth.uid()
  ));

CREATE POLICY verification_docs_own_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'verification-docs'
    AND (public.has_role(auth.uid(),'admin') OR (storage.foldername(name))[1] = auth.uid()::text));
CREATE POLICY verification_docs_own_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'verification-docs' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY verification_docs_admin_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'verification-docs'
    AND (public.has_role(auth.uid(),'admin') OR (storage.foldername(name))[1] = auth.uid()::text));