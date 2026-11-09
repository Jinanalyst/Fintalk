-- ============================================================================
-- 모의투자 포지션 공유 카드
-- 카드의 모든 숫자는 서버에 저장된 포지션/거래 기록에서 이 함수들이 직접 계산합니다.
-- 클라이언트가 수익률·손익을 입력하거나 고칠 수 없습니다. (insert/update 권한 없음)
-- 여러 번 실행해도 안전합니다. Supabase SQL Editor 에 통째로 붙여넣어 실행하세요.
-- ============================================================================

create table if not exists public.trade_shares (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  kind         text not null check (kind in ('position','trade')),
  source_id    uuid not null,                       -- 공유한 포지션 또는 거래 기록의 id
  symbol       text not null,
  side         text not null check (side in ('long','short')),
  leverage     int  not null,
  entry_price  numeric not null,
  mark_price   numeric not null,                    -- 진행 중이면 공유 시점 현재가, 종료면 청산가
  pnl          numeric not null,                    -- 진행 중: 미실현, 종료: 수수료 반영 확정 손익
  roe          numeric not null,                    -- 증거금 대비 수익률(%) — 계좌 전체 수익률과 다른 지표
  closed       boolean not null,
  close_reason text,
  post_id      uuid references public.posts(id) on delete set null,
  created_at   timestamptz not null default now(),
  unique (user_id, kind, source_id)                 -- 같은 포지션을 반복 공유해 중복 생성 불가
);
create index if not exists trade_shares_user_idx on public.trade_shares(user_id, created_at desc);

alter table public.trade_shares enable row level security;
drop policy if exists trade_shares_read on public.trade_shares;
create policy trade_shares_read on public.trade_shares for select using (true);  -- 공유 링크는 공개
revoke insert, update, delete on public.trade_shares from anon, authenticated;

-- 진행 중 포지션 공유. 이미 공유한 포지션이면 같은 링크를 유지하고 수치만 지금 기준으로 갱신합니다.
create or replace function public.paper_share_position(p_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  pos public.paper_positions%rowtype;
  mark numeric; gross numeric; roe_v numeric; sid uuid;
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
  select * into pos from public.paper_positions where id = p_id and user_id = auth.uid();
  if not found then raise exception '포지션을 찾을 수 없습니다.'; end if;
  select price into mark from public.paper_prices where symbol = pos.symbol;
  if mark is null then mark := pos.entry_price; end if;

  gross := (mark - pos.entry_price) * pos.qty * (case when pos.side = 'long' then 1 else -1 end);
  roe_v := case when pos.margin > 0 then gross / pos.margin * 100 else 0 end;

  insert into public.trade_shares(user_id, kind, source_id, symbol, side, leverage, entry_price, mark_price, pnl, roe, closed)
  values (auth.uid(), 'position', pos.id, pos.symbol, pos.side, pos.leverage, pos.entry_price, mark, gross, roe_v, false)
  on conflict (user_id, kind, source_id) do update
    set mark_price = excluded.mark_price, pnl = excluded.pnl, roe = excluded.roe
  returning id into sid;
  return sid;
end $$;

-- 종료된 거래 공유 (확정 손익, 변경 불가)
create or replace function public.paper_share_trade(p_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  t public.paper_trades%rowtype;
  sid uuid;
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
  select * into t from public.paper_trades where id = p_id and user_id = auth.uid();
  if not found then raise exception '거래 기록을 찾을 수 없습니다.'; end if;

  insert into public.trade_shares(user_id, kind, source_id, symbol, side, leverage, entry_price, mark_price, pnl, roe, closed, close_reason)
  values (auth.uid(), 'trade', t.id, t.symbol, t.side, t.leverage, t.entry_price, t.exit_price, t.pnl,
          case when t.margin > 0 then t.pnl / t.margin * 100 else 0 end, true, t.reason)
  on conflict (user_id, kind, source_id) do nothing;
  select id into sid from public.trade_shares where user_id = auth.uid() and kind = 'trade' and source_id = t.id;
  return sid;
end $$;

-- 공유 카드를 커뮤니티 글과 연결 (내 카드 + 내 글만, 한 카드당 글 1개)
create or replace function public.paper_share_attach_post(p_share uuid, p_post uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
  if not exists (select 1 from public.posts where id = p_post and author_id = auth.uid()) then
    raise exception '내 게시글만 연결할 수 있습니다.';
  end if;
  update public.trade_shares set post_id = p_post
   where id = p_share and user_id = auth.uid() and post_id is null;
end $$;

revoke all on function public.paper_share_position(uuid), public.paper_share_trade(uuid), public.paper_share_attach_post(uuid, uuid) from public, anon;
grant execute on function public.paper_share_position(uuid), public.paper_share_trade(uuid), public.paper_share_attach_post(uuid, uuid) to authenticated;
