-- ============================================================================
-- 리듀스 온리(Reduce-Only) 주문: 기존 포지션을 줄이기만 하고 새 포지션은 열지 않습니다.
--   롱(매수) 주문 → 숏 포지션을 줄임 / 숏(매도) 주문 → 롱 포지션을 줄임
--   시장가: 즉시 청산 (오래된 포지션부터) / 지정가: 지정가 청산 주문으로 등록
-- 선행: 20261113_partial_close.sql 이 먼저 적용되어 있어야 합니다.
-- ============================================================================

create or replace function public.paper_reduce_only(p_symbol text, p_side text, p_size_usdt numeric, p_limit numeric default null)
returns text language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  mark public.paper_prices%rowtype;
  target text;
  px numeric; want numeric; total numeric; remaining numeric; take numeric; avail numeric;
  placed numeric := 0;
  r record;
begin
  if uid is null then raise exception '로그인이 필요합니다.'; end if;
  if p_side not in ('long','short') then raise exception '방향이 올바르지 않습니다.'; end if;
  if p_size_usdt is null or p_size_usdt <= 0 then raise exception '주문 규모를 입력해 주세요.'; end if;

  select * into mark from public.paper_prices where symbol = p_symbol;
  if not found or mark.updated_at < now() - interval '2 minutes' then
    raise exception '시세가 갱신되지 않았습니다. 잠시 후 다시 시도해 주세요.';
  end if;

  target := case when p_side = 'long' then 'short' else 'long' end;
  px := coalesce(p_limit, mark.price);
  want := p_size_usdt / px;

  select sum(qty) into total from public.paper_positions where user_id = uid and symbol = p_symbol and side = target;
  if total is null or total <= 0 then
    raise exception '줄일 % 포지션이 없습니다. 리듀스 온리는 반대 방향 포지션만 줄일 수 있습니다.', case when target = 'long' then '롱' else '숏' end;
  end if;
  remaining := least(want, total);

  if p_limit is null then
    for r in select id, qty from public.paper_positions
             where user_id = uid and symbol = p_symbol and side = target order by opened_at loop
      exit when remaining <= 0.000000001;
      take := least(remaining, r.qty);
      perform public._paper_close(r.id, mark.price, 'manual', take);
      remaining := remaining - take;
    end loop;
    return 'filled';
  end if;

  -- 지정가: 바로 체결될 가격은 거부 (시장가를 이용)
  if (target = 'long' and p_limit <= mark.price) or (target = 'short' and p_limit >= mark.price) then
    raise exception '리듀스 온리 지정가는 현재가보다 % 가격이어야 합니다. 바로 줄이려면 시장가를 이용해 주세요.',
      case when target = 'long' then '높은' else '낮은' end;
  end if;

  for r in select id, qty from public.paper_positions
           where user_id = uid and symbol = p_symbol and side = target order by opened_at loop
    exit when remaining <= 0.000000001;
    select r.qty - coalesce(sum(qty), 0) into avail
      from public.paper_close_orders where position_id = r.id and status = 'open';
    take := least(remaining, greatest(avail, 0));
    if take > 0.000000001 then
      insert into public.paper_close_orders(user_id, position_id, price, qty) values (uid, r.id, p_limit, take);
      remaining := remaining - take;
      placed := placed + take;
    end if;
  end loop;
  if placed <= 0 then
    raise exception '이미 모든 포지션에 청산 주문이 걸려 있습니다. 기존 청산 주문을 먼저 취소해 주세요.';
  end if;
  return 'open';
end $$;

revoke all on function public.paper_reduce_only(text, text, numeric, numeric) from public, anon;
grant execute on function public.paper_reduce_only(text, text, numeric, numeric) to authenticated;
