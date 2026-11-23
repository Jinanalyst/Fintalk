-- Season 1: registration closes at 2026-11-30 23:59:59 UTC (was 2026-12-01 00:00 UTC).
-- Data update only (one row). Safe to run more than once. Requires 20261130_season_accounts.sql.
update public.contests
   set registration_ends_at = '2026-11-30 23:59:59+00'
 where name = 'FinTalk Season 1'
   and registration_ends_at is distinct from '2026-11-30 23:59:59+00';
