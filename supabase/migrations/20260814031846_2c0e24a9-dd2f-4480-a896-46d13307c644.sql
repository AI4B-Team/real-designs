REVOKE EXECUTE ON FUNCTION public.get_presentation_share(text, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_presentation_share_view(text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.add_presentation_comment(text, text, text, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.decide_presentation_share(text, text, text, text) FROM anon, authenticated;