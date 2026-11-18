-- ============================================================================
-- 모의투자 전체 초기화 (리더보드 + 내 성과 + 잔고)  ※ 운영 DB 데이터 삭제
--
-- Supabase 대시보드 > SQL Editor 에서 직접 실행하세요. (마이그레이션 폴더가 아니라 수동 실행용입니다)
-- 효과:
--   · 모든 이용자의 청산 기록(paper_trades) 삭제  → 리더보드·내 성과(수익률/승률/PnL 곡선) 0
--   · 열린 포지션·주문 삭제, 잔고를 10,000 USDT 로 복구
--   · 공유한 거래 카드(trade_shares) 삭제 → 기여도의 트레이딩 점수도 0
-- 되돌리려면: 아래 백업 테이블(*_bak_YYYYMMDD)에서 다시 insert 하면 됩니다.
-- 백업 테이블은 확인 후 직접 drop 하세요.
-- ============================================================================
begin;

-- 1) 백업 (실행 날짜가 이름에 붙습니다)
do $$
declare s text := to_char(now(), 'YYYYMMDD');
begin
  execute format('create table public.paper_trades_bak_%s as select * from public.paper_trades', s);
  execute format('create table public.paper_positions_bak_%s as select * from public.paper_positions', s);
  execute format('create table public.paper_orders_bak_%s as select * from public.paper_orders', s);
  execute format('create table public.paper_accounts_bak_%s as select * from public.paper_accounts', s);
  execute format('create table public.trade_shares_bak_%s as select * from public.trade_shares', s);
end $$;

-- 2) 초기화
delete from public.trade_shares;
delete from public.paper_trades;
delete from public.paper_positions;
delete from public.paper_orders;
update public.paper_accounts set balance = 10000, reset_count = 0;

-- 3) 확인: 모두 0 / 잔고는 10000 한 종류여야 합니다
select
  (select count(*) from public.paper_trades)    as trades,
  (select count(*) from public.paper_positions) as positions,
  (select count(*) from public.paper_orders)    as orders,
  (select count(*) from public.trade_shares)    as shares,
  (select array_agg(distinct balance) from public.paper_accounts) as balances;

commit;  -- 결과가 이상하면 commit 대신 rollback; 으로 바꿔 실행하세요
