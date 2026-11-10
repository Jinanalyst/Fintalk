-- ============================================================================
-- 열린 포지션의 익절/손절을 "현재가" 기준으로 검증합니다.
--   · 롱: 손절가를 평단(진입가) 위로 올려도 됩니다. (수익 보전 / 본전 스톱) 단, 현재가보다는 낮아야 합니다.
--   · 숏: 손절가를 평단 아래로 내려도 됩니다. 단, 현재가보다는 높아야 합니다.
--   · 익절가는 롱은 현재가보다 높게, 숏은 현재가보다 낮게. (바로 체결되는 가격은 거부)
-- 신규 주문(진입 전)은 기존처럼 진입가 기준으로 검증합니다.
-- 여러 번 실행해도 안전합니다.
-- ============================================================================

create or replace function public.paper_set_tpsl(p_id uuid, p_tp numeric, p_sl numeric)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  pos public.paper_positions%rowtype;
  mark public.paper_prices%rowtype;
begin
  if uid is null then raise exception '로그인이 필요합니다.'; end if;
  select * into pos from public.paper_positions where id = p_id and user_id = uid for update;
  if not found then raise exception '포지션을 찾을 수 없습니다.'; end if;
  select * into mark from public.paper_prices where symbol = pos.symbol;
  if not found then raise exception '시세가 없습니다.'; end if;

  if (p_tp is not null and p_tp <= 0) or (p_sl is not null and p_sl <= 0) then raise exception '가격이 올바르지 않습니다.'; end if;

  if pos.side = 'long' then
    if p_tp is not null and p_tp <= mark.price then raise exception '롱 익절가는 현재가보다 높아야 합니다.'; end if;
    if p_sl is not null and p_sl >= mark.price then raise exception '롱 손절가는 현재가보다 낮아야 합니다. (진입가 위로는 올릴 수 있어요)'; end if;
  else
    if p_tp is not null and p_tp >= mark.price then raise exception '숏 익절가는 현재가보다 낮아야 합니다.'; end if;
    if p_sl is not null and p_sl <= mark.price then raise exception '숏 손절가는 현재가보다 높아야 합니다. (진입가 아래로는 내릴 수 있어요)'; end if;
  end if;

  update public.paper_positions set tp = p_tp, sl = p_sl where id = p_id;
end $$;

revoke all on function public.paper_set_tpsl(uuid, numeric, numeric) from public, anon;
grant execute on function public.paper_set_tpsl(uuid, numeric, numeric) to authenticated;
