REVOKE ALL ON FUNCTION public.require_complete_profile() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_profile_complete(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_profile_complete(uuid) TO authenticated, service_role;