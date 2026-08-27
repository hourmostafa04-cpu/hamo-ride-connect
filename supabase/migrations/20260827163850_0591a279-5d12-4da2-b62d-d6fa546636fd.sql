REVOKE EXECUTE ON FUNCTION public.can_access_chat_load(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.owns_load(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_bid_on_load(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.can_access_chat_load(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.owns_load(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_bid_on_load(text) TO authenticated, service_role;
