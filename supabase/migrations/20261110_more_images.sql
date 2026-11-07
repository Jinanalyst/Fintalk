-- ============================================================================
-- FinTalk 마이그레이션 #6: 게시글 이미지 개수 상한 5 → 100
-- 여러 번 실행해도 안전합니다. (본문 속 이미지가 5장을 넘으면 저장이 실패하던 문제)
-- ============================================================================
alter table public.posts drop constraint if exists posts_image_urls_check;
alter table public.posts add constraint posts_image_urls_check check (cardinality(image_urls) <= 100);
