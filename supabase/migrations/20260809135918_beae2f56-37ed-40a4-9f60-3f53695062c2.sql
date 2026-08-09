REVOKE EXECUTE ON FUNCTION public.get_shared_presentation(text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_presentation_view(text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.respond_to_presentation(text, text, text) FROM anon, authenticated;