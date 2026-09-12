-- Daily at 06:00 UTC (03:00 Brasilia). The function is private and invoked by
-- the postgres-owned scheduler, without a public HTTP endpoint or API secret.
select cron.schedule(
  'purge-inactive-free-accounts',
  '0 6 * * *',
  $job$set local statement_timeout = '60s'; select private.purge_inactive_free_accounts(false);$job$
);
