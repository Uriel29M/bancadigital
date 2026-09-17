# Profile data boundary

- `auth.users.email` is the authoritative private email. There is no email copy in `public.profiles` and no `get_login_email` RPC.
- `profiles_public` is a read-only, explicitly projected `security_invoker` view. Existing profile visibility/block RLS applies. Public identity, presentation, shelf visibility, rank, last-seen time and public ban/visibility flags are included.
- Legacy `profiles` relationships retain SELECT only on those same public columns. Internal preferences, moderation expiration and account timestamps are not directly readable by browser roles. New columns are private by default.
- `get_my_profile()` returns the signed-in owner's profile, including internal settings; it accepts no target ID. Email remains available only from that user's authenticated Auth session.
- `get_profile_moderation_status(uuid)` exposes moderation expiration only to staff.
- `resolve_username_login(text)` is callable only by `service_role`. It resolves against Auth and limits existing accounts to ten username login attempts per fifteen minutes. Unknown usernames do not allocate rate-limit rows. Email login remains available independently.
- The `username-login` Edge Function verifies the password with Auth and returns only session tokens after success. Lookup emails and detailed Auth failures never become response payloads. A successful Auth session/JWT can contain the authenticated user's own email.

## Release coordination

Publish the updated `js/app.js` with the backend migration. Old frontend versions reference the removed email lookup and directly select internal columns; username login and account loading require the new frontend. Supabase changes and Edge Functions were applied directly; static-site publication is separate.

## Verification

Run `node --test scripts/test-username-login.mjs` and `node --check js/app.js`.
Run `supabase/tests/profile_privacy.sql` and `supabase/tests/profile_write_security.sql` as the database owner. Both create temporary identities inside a rolled-back transaction. They check anonymous/authenticated read boundaries, hidden-profile RLS, owner preferences, server-only email lookup, confirmed-email changes, rate limiting and administrative write authorization.
