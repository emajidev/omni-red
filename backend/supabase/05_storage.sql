-- =============================================================================
-- OmniRed · 05_storage.sql
-- Bucket `listas_sismo` para las imágenes de listas/capturas + políticas seguras.
--
-- 🔐 Seguridad de Storage:
--   - Bucket PRIVADO (public = false): nada es accesible por URL directa.
--   - Subir/leer requiere estar autenticado (rol authenticated).
--   - El acceso a un archivo concreto se hace con URL firmada y caducidad corta
--     (createSignedUrl) generada server-side / por el cliente autenticado.
-- =============================================================================

-- Crear el bucket (idempotente) ----------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'listas_sismo',
  'listas_sismo',
  false,                                   -- 🔒 NO público
  10485760,                                -- 10 MB por archivo
  array['image/jpeg','image/png','image/webp','application/pdf']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Políticas sobre storage.objects --------------------------------------------
-- Solo personal autenticado (rescatistas) puede subir/leer/actualizar.

drop policy if exists p_listas_select on storage.objects;
create policy p_listas_select on storage.objects
  for select to authenticated
  using (bucket_id = 'listas_sismo');

drop policy if exists p_listas_insert on storage.objects;
create policy p_listas_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'listas_sismo');

drop policy if exists p_listas_update on storage.objects;
create policy p_listas_update on storage.objects
  for update to authenticated
  using (bucket_id = 'listas_sismo');

-- ⛔️ Sin policy para `anon`: el público no sube ni lee imágenes crudas (PII).

-- -----------------------------------------------------------------------------
-- Uso desde el cliente (frontend/src/app/core/services/ocr.service.ts):
--
--   // 1. Subir
--   await supabase.storage.from('listas_sismo')
--        .upload(`2026/06/${file.name}`, file, { upsert: false });
--
--   // 2. Obtener URL temporal firmada (caduca en 60s) para previsualizar
--   const { data } = await supabase.storage.from('listas_sismo')
--        .createSignedUrl(path, 60);
-- -----------------------------------------------------------------------------
