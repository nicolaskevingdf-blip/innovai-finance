-- Bucket privado para documentos. Caminho obrigatório: {workspace_id}/{arquivo}
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 10485760,
  array['application/pdf','image/png','image/jpeg','image/webp','image/heic'])
on conflict (id) do nothing;

create policy "docs_read_members" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and public.is_member(((storage.foldername(name))[1])::uuid));
create policy "docs_insert_operators" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and public.can_operate(((storage.foldername(name))[1])::uuid));
create policy "docs_delete_writers" on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and public.can_write(((storage.foldername(name))[1])::uuid));
