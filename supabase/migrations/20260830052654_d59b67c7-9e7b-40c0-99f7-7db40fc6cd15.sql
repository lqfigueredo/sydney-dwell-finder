REVOKE EXECUTE ON FUNCTION public.is_verified_member(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.autoapprove_for_verified() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_active_account(uuid) FROM anon;