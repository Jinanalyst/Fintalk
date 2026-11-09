-- ============================================================================
-- 같은 종목·방향·레버리지로 추가 진입하면 별도 포지션을 만들지 않고 기존 포지션에 합칩니다.
--   · 진입가 = 수량 가중 평균(평단), 수량·증거금·수수료는 합산, 청산가는 평단 기준으로 다시 계산
--   · 익절/손절은 새 주문에 값이 있으면 그 값으로, 없으면 기존 값을 유지
--   · 레버리지가 다른 진입은 합치지 않고 따로 둡니다.
-- 시장가 체결과 지정가 체결 모두 _paper_open 을 거치므로 함께 적용됩니다.
-- 선행: 20261111_paper_trading.sql, 20261113_partial_close.sql
-- ============================================================================

create or replace function public._paper_open(p_user uuid, p_symbol text, p_side text, p_qty numeric, p_price numeric,
  p_lev int, p_margin numeric, p_fee numeric, p_tp numeric, p_sl numeric)
returns void language plpgsql security definer set search_path = public as $$
declare
  pos public.paper_positions%rowtype;
  nq numeric; ne numeric;
begin
  select * into pos from public.paper_positions
   where user_id = p_user and symbol = p_symbol and side = p_side and leverage = p_lev
   order by opened_at limit 1 for update;

  if found then
    nq := pos.qty + p_qty;
    ne := (pos.entry_price * pos.qty + p_price * p_qty) / nq;
    update public.paper_positions
       set qty = nq,
           entry_price = ne,
           margin = pos.margin + p_margin,
           open_fee = pos.open_fee + p_fee,
           tp = coalesce(p_tp, pos.tp),
           sl = coalesce(p_sl, pos.sl),
           liq_price = public._paper_liq_price(p_side, ne, p_lev)
     where id = pos.id;
  else
    insert into public.paper_positions(user_id, symbol, side, qty, entry_price, leverage, margin, open_fee, tp, sl, liq_price)
    values (p_user, p_symbol, p_side, p_qty, p_price, p_lev, p_margin, p_fee, p_tp, p_sl,
            public._paper_liq_price(p_side, p_price, p_lev));
  end if;
end $$;

-- 이미 따로 열려 있는 같은 종목·방향·레버리지 포지션을 한 번 합칩니다.
do $$
declare
  g record; keep uuid; nq numeric; ne numeric; nm numeric; nf numeric; ntp numeric; nsl numeric;
begin
  for g in
    select user_id, symbol, side, leverage from public.paper_positions
     group by user_id, symbol, side, leverage having count(*) > 1
  loop
    select id into keep from public.paper_positions
     where user_id = g.user_id and symbol = g.symbol and side = g.side and leverage = g.leverage
     order by opened_at limit 1;

    select sum(qty), sum(entry_price * qty) / sum(qty), sum(margin), sum(open_fee)
      into nq, ne, nm, nf
      from public.paper_positions
     where user_id = g.user_id and symbol = g.symbol and side = g.side and leverage = g.leverage;

    -- 익절/손절은 가장 최근에 설정된(값이 있는) 포지션 것을 사용
    select tp into ntp from public.paper_positions
     where user_id = g.user_id and symbol = g.symbol and side = g.side and leverage = g.leverage and tp is not null
     order by opened_at desc limit 1;
    select sl into nsl from public.paper_positions
     where user_id = g.user_id and symbol = g.symbol and side = g.side and leverage = g.leverage and sl is not null
     order by opened_at desc limit 1;

    update public.paper_close_orders set position_id = keep
     where position_id in (select id from public.paper_positions
                            where user_id = g.user_id and symbol = g.symbol and side = g.side and leverage = g.leverage and id <> keep);

    delete from public.paper_positions
     where user_id = g.user_id and symbol = g.symbol and side = g.side and leverage = g.leverage and id <> keep;

    update public.paper_positions
       set qty = nq, entry_price = ne, margin = nm, open_fee = nf, tp = ntp, sl = nsl,
           liq_price = public._paper_liq_price(g.side, ne, g.leverage)
     where id = keep;
  end loop;
end $$;
