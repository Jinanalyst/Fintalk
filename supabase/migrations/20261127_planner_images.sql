-- ============================================================================
-- Chainlabs Planner: chart screenshots
-- Private bucket "planner-images". Each user can only read, upload and delete files inside their own
-- folder (<user_id>/...). Images are served to the browser through short-lived signed URLs.
-- Safe to run more than once. Paste into the Supabase SQL Editor.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('planner-images', 'planner-images', false, 5242880, array['image/jpeg'])
on conflict (id) do update
  set public = false, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg'];

drop policy if exists planner_images_read on storage.objects;
create policy planner_images_read on storage.objects for select to authenticated
  using (bucket_id = 'planner-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists planner_images_insert on storage.objects;
create policy planner_images_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'planner-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists planner_images_delete on storage.objects;
create policy planner_images_delete on storage.objects for delete to authenticated
  using (bucket_id = 'planner-images' and (storage.foldername(name))[1] = auth.uid()::text);
