-- ============================================================================
-- Chainlabs Planner: Lifetime Pro purchases (NOWPayments)
-- planner_orders       one row per checkout attempt (created by the server, updated by the IPN webhook)
-- planner_entitlements one row per user that currently owns Lifetime Pro
-- Only the server (service role) can write. Users can read their own rows.
-- Safe to run more than once. Paste into the Supabase SQL Editor.
-- ============================================================================

create table if not exists public.planner_orders (
  order_id       text primary key,                          -- "<user_id>_<random>" sent to NOWPayments
  user_id        uuid not null references public.profiles(id) on delete cascade,
  invoice_id     text,
  payment_id     text,
  status         text not null default 'pending',           -- pending | waiting | confirming | confirmed | sending | partially_paid | finished | failed | refunded | expired
  price_amount   numeric not null,
  price_currency text not null default 'usd',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists planner_orders_user_idx on public.planner_orders(user_id, created_at desc);

create table if not exists public.planner_entitlements (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  order_id   text references public.planner_orders(order_id),
  granted_at timestamptz not null default now()
);

alter table public.planner_orders enable row level security;
alter table public.planner_entitlements enable row level security;

drop policy if exists planner_orders_own on public.planner_orders;
create policy planner_orders_own on public.planner_orders for select using (auth.uid() = user_id);
drop policy if exists planner_entitlements_own on public.planner_entitlements;
create policy planner_entitlements_own on public.planner_entitlements for select using (auth.uid() = user_id);

revoke insert, update, delete on public.planner_orders from anon, authenticated;
revoke insert, update, delete on public.planner_entitlements from anon, authenticated;
