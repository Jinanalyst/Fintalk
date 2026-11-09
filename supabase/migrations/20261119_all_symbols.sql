-- 전 종목 거래: 시세 반영 시 종목 화이트리스트(6개)를 없애고 USDT 무기한 선물 전체를 받습니다.
-- 가격 갱신 + 체결/청산 매칭 (전 종목 시세 반영)
create or replace function public.paper_tick(p_secret text, p_prices jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  r record; px numeric;
begin
  if p_secret is null or p_secret is distinct from (select value from public.paper_config where key = 'tick_secret') then
    raise exception 'forbidden';
  end if;

  -- 바이낸스 USDT-M 무기한 선물 전 종목(예: ADAUSDT, 1000PEPEUSDT)의 시세를 한 번에 반영
  insert into public.paper_prices(symbol, price, updated_at)
  select key, value::numeric, now()
    from jsonb_each_text(p_prices)
   where key ~ '^[A-Z0-9]{1,20}USDT$' and value ~ '^[0-9]+([.][0-9]+)?([eE][-+]?[0-9]+)?$' and value::numeric > 0
  on conflict (symbol) do update set price = excluded.price, updated_at = excluded.updated_at;

  -- 지정가 체결: 롱은 가격 <= 지정가, 숏은 가격 >= 지정가
  for r in
    select o.* from public.paper_orders o join public.paper_prices p on p.symbol = o.symbol
    where o.status = 'open'
      and ((o.side = 'long' and p.price <= o.price) or (o.side = 'short' and p.price >= o.price))
    for update of o
  loop
    perform public._paper_open(r.user_id, r.symbol, r.side, r.qty, r.price, r.leverage, r.margin, r.fee, r.tp, r.sl);
    update public.paper_orders set status = 'filled' where id = r.id;
  end loop;

  -- 강제청산 → 손절 → 익절 순서로 확인
  for r in
    select pos.id, pos.side, pos.liq_price, pos.tp, pos.sl, p.price
    from public.paper_positions pos join public.paper_prices p on p.symbol = pos.symbol
  loop
    px := r.price;
    if (r.side = 'long' and px <= r.liq_price) or (r.side = 'short' and px >= r.liq_price) then
      perform public._paper_close(r.id, r.liq_price, 'liquidation');
    elsif r.sl is not null and ((r.side = 'long' and px <= r.sl) or (r.side = 'short' and px >= r.sl)) then
      perform public._paper_close(r.id, r.sl, 'sl');
    elsif r.tp is not null and ((r.side = 'long' and px >= r.tp) or (r.side = 'short' and px <= r.tp)) then
      perform public._paper_close(r.id, r.tp, 'tp');
    end if;
  end loop;

  -- 지정가 청산: 롱은 가격 >= 지정가(위에서 매도), 숏은 가격 <= 지정가(아래에서 매수)
  for r in
    select co.id, co.position_id, co.price, co.qty
    from public.paper_close_orders co
    join public.paper_positions pos on pos.id = co.position_id
    join public.paper_prices p on p.symbol = pos.symbol
    where co.status = 'open'
      and ((pos.side = 'long' and p.price >= co.price) or (pos.side = 'short' and p.price <= co.price))
    order by co.created_at
  loop
    perform public._paper_close(r.position_id, r.price, 'limit', r.qty);
    update public.paper_close_orders set status = 'filled' where id = r.id;
  end loop;
end $$;

revoke all on function public.paper_tick(text, jsonb) from public, anon, authenticated;
grant execute on function public.paper_tick(text, jsonb) to anon, authenticated;
