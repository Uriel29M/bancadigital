-- account_email is used internally for username login and must not be
-- readable through the public profiles table.
revoke select (account_email) on public.profiles from anon, authenticated;

notify pgrst, 'reload schema';
