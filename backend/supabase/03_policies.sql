-- =============================================================================
-- OmniRed · 03_policies.sql
-- Row Level Security (RLS) + vista pública con enmascarado de PII.
--
-- 🔐 Modelo de acceso desde el navegador (clave anon):
--   - LECTURA  : permitida sobre datos no sensibles (mapa, acopio, sismos).
--   - ESCRITURA: PROHIBIDA directamente. Solo vía las RPC de 02_functions.sql.
--   - PII (cédula): el frontend público lee la VISTA enmascarada, no la tabla.
--   El personal de rescate autenticado (rol `authenticated`) ve el detalle.
-- =============================================================================

-- Activar RLS en todas las tablas (deniega todo por defecto) ------------------
alter table public.reportes_personas enable row level security;
alter table public.centros_acopio    enable row level security;
alter table public.sismos             enable row level security;
alter table public.listas_ocr         enable row level security;

-- Forzar RLS incluso para el owner en accesos vía API
alter table public.reportes_personas force row level security;

-- -----------------------------------------------------------------------------
-- reportes_personas
-- -----------------------------------------------------------------------------
-- Lectura: cualquiera puede LEER la tabla base (la app de rescate la usa).
-- En despliegue 100% público, comentar esta policy y servir solo la vista.
drop policy if exists p_personas_select on public.reportes_personas;
create policy p_personas_select
  on public.reportes_personas
  for select
  to anon, authenticated
  using (true);

-- Escritura directa: SOLO personal autenticado (los anónimos usan la RPC).
drop policy if exists p_personas_write_auth on public.reportes_personas;
create policy p_personas_write_auth
  on public.reportes_personas
  for all
  to authenticated
  using (true)
  with check (true);
-- ⛔️ No existe ninguna policy de INSERT/UPDATE/DELETE para `anon`:
--    sus escrituras quedan bloqueadas y deben pasar por reportar_persona().

-- -----------------------------------------------------------------------------
-- centros_acopio  — lectura pública, escritura autenticada
-- -----------------------------------------------------------------------------
drop policy if exists p_acopio_select on public.centros_acopio;
create policy p_acopio_select on public.centros_acopio
  for select to anon, authenticated using (true);

drop policy if exists p_acopio_write on public.centros_acopio;
create policy p_acopio_write on public.centros_acopio
  for all to authenticated using (true) with check (true);

-- -----------------------------------------------------------------------------
-- sismos — lectura pública, escritura solo backend/servicio
-- -----------------------------------------------------------------------------
drop policy if exists p_sismos_select on public.sismos;
create policy p_sismos_select on public.sismos
  for select to anon, authenticated using (true);
-- (La ingesta de sismos la hace un job server-side con service_role: omite RLS.)

-- -----------------------------------------------------------------------------
-- listas_ocr — lectura/escritura solo autenticados (info operativa interna)
-- -----------------------------------------------------------------------------
drop policy if exists p_listas_all on public.listas_ocr;
create policy p_listas_all on public.listas_ocr
  for all to authenticated using (true) with check (true);

-- =============================================================================
-- Vista pública con enmascarado de PII
-- El frontend público debería consultar ESTA vista (no la tabla) para el mapa.
-- Enmascara la cédula: "V-12.345.678" -> "V-**.***.678".
-- =============================================================================
create or replace function public.enmascarar_cedula(p text)
returns text language sql immutable as $$
  select case
    when p is null or length(regexp_replace(p,'\D','','g')) < 3 then '••••'
    else regexp_replace(p, '[0-9](?=[0-9]{3})', '•', 'g')  -- deja visibles los 3 últimos dígitos
  end;
$$;

create or replace view public.v_reportes_publico
with (security_invoker = true) as   -- respeta RLS del invocador (PG15+/Supabase)
  select
    id,
    nombre,
    public.enmascarar_cedula(cedula) as cedula,  -- 🔒 PII enmascarada
    estado,
    ubicacion,
    lat,
    lng,
    fuente,
    veces_reportado,
    created_at
  from public.reportes_personas;

comment on view public.v_reportes_publico is
  'Proyección pública de reportes con cédula enmascarada. Úsese desde el cliente anónimo.';

grant select on public.v_reportes_publico to anon, authenticated;

-- =============================================================================
-- Permisos de EJECUCIÓN de las RPC
-- El anon SOLO puede invocar la(s) función(es) de escritura segura.
-- =============================================================================
revoke all on function public.reportar_persona   from public;
revoke all on function public.obtener_metricas    from public;
revoke all on function public.registrar_lista_ocr from public;
revoke all on function public.actualizar_acopio   from public;

grant execute on function public.reportar_persona(
  text, text, estado_persona, text, double precision, double precision,
  fuente_reporte, int, text, text, text, uuid) to anon, authenticated;

grant execute on function public.obtener_metricas() to anon, authenticated;

-- Las siguientes son operativas internas: solo autenticados.
grant execute on function public.registrar_lista_ocr(
  text, text, estado_ocr, text, int, int, text, uuid) to authenticated;
grant execute on function public.actualizar_acopio(
  uuid, capacidad_acopio, text[]) to authenticated;
