-- ============================================================================
-- FinTalk Planner: read-only exchange connections (OKX, Binance, Bybit, Bitget)
-- planner_connections         one row per connected exchange; users can read their own rows (no secrets here)
-- planner_connection_secrets  the encrypted API key payload; RLS on with NO policies, so only the server
--                             (service role) can read or write it. Never exposed to the browser.
-- Safe to run more than once. Paste into the Supabase SQL Editor.
-- ============================================================================

create table if not exists public.planner_connections (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  exchange     text not null check (exchange in ('OKX', 'Binance', 'Bybit', 'Bitget')),
  status       text not null default 'active',            -- active | error
  last_error   text,
  last_sync_at timestamptz,
  created_at   timestamptz not null default now(),
  unique (user_id, exchange)
);

create table if not exists public.planner_connection_secrets (
  connection_id uuid primary key references public.planner_connections(id) on delete cascade,
  payload       text not null                              -- AES-256-GCM encrypted JSON {key, secret, passphrase?}
);

alter table public.planner_connections enable row level security;
alter table public.planner_connection_secrets enable row level security;

drop policy if exists planner_connections_own on public.planner_connections;
create policy planner_connections_own on public.planner_connections for select using (auth.uid() = user_id);

revoke insert, update, delete on public.planner_connections from anon, authenticated;
revoke all on public.planner_connection_secrets from anon, authenticated;
