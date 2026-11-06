-- ============================================================================
-- FinTalk 마이그레이션 #4: 게시글 동영상 업로드 허용 (post-images 버킷 확장)
-- 사전 조건: schema.sql 실행 완료. 여러 번 실행해도 안전합니다.
-- 장당 이미지 5MB 제한은 앱에서 검사하고, 버킷 한도는 동영상용으로 50MB 로 올립니다.
-- (Supabase 무료 플랜의 파일 하나당 최대 크기가 50MB 입니다.)
-- ============================================================================

update storage.buckets
   set file_size_limit = 52428800,
       allowed_mime_types = array['image/png','image/jpeg','image/webp','image/gif','video/mp4','video/webm','video/quicktime']
 where id = 'post-images';
