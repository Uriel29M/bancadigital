// Retired: automatic account retention runs inside Postgres via pg_cron.
// See private.purge_inactive_free_accounts and its migration. Do not restore
// the old unrestricted service-role deletion loop or expose it over HTTP.
Deno.serve(() => Response.json(
  { error: "Account retention is managed by the private database scheduler." },
  { status: 410 },
));
