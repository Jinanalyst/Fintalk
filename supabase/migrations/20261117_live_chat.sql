-- ============================================================================
-- 실시간 채팅 + 포지션 청산 라이브 피드
-- 여러 번 실행해도 안전합니다. Supabase SQL Editor 에 통째로 붙여넣어 실행하세요.
-- ============================================================================

-- 채팅 메시지('msg')와 청산 알림('close')을 한 타임라인에 담습니다.
-- 닉네임/아바타를 함께 저장해 Realtime 이벤트만으로 바로 그릴 수 있습니다.
create table if not exists public.chat_messages (
  id         bigint generated always as identity primary key,
  user_id    uuid references public.profiles(id) on delete set null,
  kind       text not null check (kind in ('msg', 'close')),
  nickname   text not null,
  avatar_url text,
  body       text not null default '',
  meta       jsonb,
  created_at timestamptz not null default now()
);
create index if not exists chat_messages_created_idx on public.chat_messages(created_at desc);

alter table public.chat_messages enable row level security;
drop policy if exists chat_messages_read on public.chat_messages;
create policy chat_messages_read on public.chat_messages for select using (true);
revoke insert, update, delete on public.chat_messages from anon, authenticated;

-- 메시지 전송: 로그인 필요, 1~300자, 1초에 1개까지
create or replace function public.chat_send(p_body text)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  txt text := btrim(coalesce(p_body, ''));
  prof public.profiles%rowtype;
begin
  if uid is null then raise exception '로그인이 필요합니다.'; end if;
  if char_length(txt) < 1 then raise exception '메시지를 입력해 주세요.'; end if;
  if char_length(txt) > 300 then raise exception '메시지는 300자까지 보낼 수 있습니다.'; end if;
  if exists (select 1 from public.chat_messages where user_id = uid and kind = 'msg' and created_at > now() - interval '1 second') then
    raise exception '너무 빠르게 보내고 있습니다. 잠시 후 다시 시도해 주세요.';
  end if;
  select * into prof from public.profiles where id = uid;
  if not found then raise exception '프로필을 찾을 수 없습니다.'; end if;

  insert into public.chat_messages(user_id, kind, nickname, avatar_url, body)
  values (uid, 'msg', prof.nickname, prof.avatar_url, txt);

  -- 오래된 기록 정리 (가끔씩만)
  if random() < 0.02 then
    delete from public.chat_messages where created_at < now() - interval '3 days';
  end if;
end $$;

revoke all on function public.chat_send(text) from public, anon;
grant execute on function public.chat_send(text) to authenticated;

-- 거래가 종료(청산)될 때마다 채팅 타임라인에 자동으로 청산 알림을 남깁니다.
create or replace function public._chat_on_trade()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  prof public.profiles%rowtype;
begin
  select * into prof from public.profiles where id = new.user_id;
  if not found then return new; end if;
  insert into public.chat_messages(user_id, kind, nickname, avatar_url, meta)
  values (
    new.user_id, 'close', prof.nickname, prof.avatar_url,
    jsonb_build_object(
      'symbol', new.symbol,
      'side', new.side,
      'leverage', new.leverage,
      'entry', new.entry_price,
      'exit', new.exit_price,
      'pnl', new.pnl,
      'roe', case when new.margin > 0 then round(new.pnl / new.margin * 100, 2) else 0 end,
      'reason', new.reason
    )
  );
  return new;
end $$;

revoke all on function public._chat_on_trade() from public, anon, authenticated;

drop trigger if exists chat_on_trade on public.paper_trades;
create trigger chat_on_trade after insert on public.paper_trades
  for each row execute function public._chat_on_trade();

-- Realtime: 새 메시지가 들어오면 브라우저로 바로 전달
do $$ begin
  alter publication supabase_realtime add table public.chat_messages;
exception when duplicate_object then null;
end $$;
