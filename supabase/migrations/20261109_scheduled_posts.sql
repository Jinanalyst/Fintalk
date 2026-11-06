-- ============================================================================
-- FinTalk 마이그레이션 #5: 예약 발행
-- 사전 조건: 20261105 ~ 20261108 실행 완료. 여러 번 실행해도 안전합니다.
-- 예약 글 = status 'published' 이면서 created_at(= 공개 시각)이 미래인 글.
-- 시각이 되면 별도 작업 없이 자동으로 모두에게 보입니다. (작성자·관리자는 미리 볼 수 있음)
-- ============================================================================

-- 1) 공개 시각 전에는 작성자·관리자만 조회
drop policy if exists "posts_read" on public.posts;
create policy "posts_read" on public.posts for select
  using ((status = 'published' and created_at <= now()) or author_id = auth.uid() or public.is_admin());

-- 2) 작성자가 공개 시각(created_at)을 바꿀 수 있게 하되, 이미 공개된 글은 트리거가 되돌립니다.
grant update (created_at) on public.posts to authenticated;

create or replace function public.guard_post_publish_time()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    -- 과거 시각 불가, 최대 90일 뒤까지 예약
    new.created_at := least(greatest(coalesce(new.created_at, now()), now()), now() + interval '90 days');
  elsif new.created_at is distinct from old.created_at then
    if old.status = 'draft' or old.created_at > now() then
      new.created_at := least(greatest(new.created_at, now()), now() + interval '90 days');
    else
      new.created_at := old.created_at; -- 이미 공개된 글의 작성 시각은 변경 불가
    end if;
  end if;
  return new;
end $$;

drop trigger if exists guard_post_publish_time on public.posts;
create trigger guard_post_publish_time before insert or update on public.posts
  for each row execute function public.guard_post_publish_time();

-- 3) 조회수·기여도 지표에는 공개된 글만 반영
create or replace function public.increment_post_views(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.posts set views = views + 1 where id = p_id and status = 'published' and created_at <= now();
end $$;
