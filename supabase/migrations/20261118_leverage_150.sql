-- 최대 레버리지를 50배 → 150배로 확대합니다.
-- 150배에서 청산가는 진입가의 약 0.17% 거리(1/150 - 유지증거금률 0.5%)입니다.
alter table public.paper_orders    drop constraint if exists paper_orders_leverage_check;
alter table public.paper_orders    add  constraint paper_orders_leverage_check    check (leverage between 1 and 150);
alter table public.paper_positions drop constraint if exists paper_positions_leverage_check;
alter table public.paper_positions add  constraint paper_positions_leverage_check check (leverage between 1 and 150);

create or replace function public.paper_place_order(
  p_symbol text, p_side text, p_size_usdt numeric, p_leverage int,
  p_limit numeric default null, p_tp numeric default null, p_sl numeric default null)
returns text language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  mark public.paper_prices%rowtype;
  px numeric; qty numeric; margin numeric; fee numeric; bal numeric;
  n int;
begin
  if uid is null then raise exception '로그인이 필요합니다.'; end if;
  if p_side not in ('long','short') then raise exception '방향이 올바르지 않습니다.'; end if;
  if p_leverage < 1 or p_leverage > 150 then raise exception '레버리지는 1~150배입니다.'; end if;
  if p_size_usdt is null or p_size_usdt < 10 then raise exception '주문 규모는 최소 10 USDT 입니다.'; end if;
  if p_size_usdt > 1000000 then raise exception '주문 규모가 너무 큽니다.'; end if;

  select * into mark from public.paper_prices where symbol = p_symbol;
  if not found or mark.updated_at < now() - interval '2 minutes' then
    raise exception '시세가 갱신되지 않았습니다. 잠시 후 다시 시도해 주세요.';
  end if;

  insert into public.paper_accounts(user_id) values (uid) on conflict do nothing;
  select balance into bal from public.paper_accounts where user_id = uid for update;

  select (select count(*) from public.paper_positions where user_id = uid)
       + (select count(*) from public.paper_orders where user_id = uid and status = 'open') into n;
  if n >= 30 then raise exception '포지션과 미체결 주문은 합쳐서 30개까지 가능합니다.'; end if;

  px := coalesce(p_limit, mark.price);
  if p_limit is not null then
    -- 즉시 체결될 지정가는 거부 (시장가를 이용하도록)
    if (p_side = 'long' and p_limit >= mark.price) or (p_side = 'short' and p_limit <= mark.price) then
      raise exception '지정가가 현재가와 겹칩니다. 시장가로 주문하거나 가격을 조정해 주세요.';
    end if;
  end if;

  perform public._paper_validate_tpsl(p_side, px, p_tp, p_sl);

  qty := p_size_usdt / px;
  margin := p_size_usdt / p_leverage;
  fee := p_size_usdt * public._paper_fee_rate();
  if margin + fee > bal then raise exception '잔고가 부족합니다. (필요 % USDT)', round(margin + fee, 2); end if;

  update public.paper_accounts set balance = balance - margin - fee where user_id = uid;

  if p_limit is null then
    perform public._paper_open(uid, p_symbol, p_side, qty, px, p_leverage, margin, fee, p_tp, p_sl);
    return 'filled';
  end if;

  insert into public.paper_orders(user_id, symbol, side, price, qty, leverage, margin, fee, tp, sl)
  values (uid, p_symbol, p_side, px, qty, p_leverage, margin, fee, p_tp, p_sl);
  return 'open';
end $$;
