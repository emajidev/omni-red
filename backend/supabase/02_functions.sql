-- =============================================================================
-- OmniRed · 02_functions.sql
-- RPC (SECURITY DEFINER) que encapsulan TODA escritura desde el navegador.
--
-- 🔐 Principio de seguridad:
--   El cliente (clave anon) NUNCA hace INSERT/UPDATE/DELETE directo sobre las
--   tablas. Solo puede EJECUTAR estas funciones, que:
--     1) validan y sanean la entrada,
--     2) corren con privilegios del owner (SECURITY DEFINER) para escribir,
--     3) fijan search_path para evitar secuestro de funciones.
-- Así la lógica sensible (desduplicación, cómputo de hash) vive en el servidor.
-- =============================================================================

-- La extensión `unaccent` debe existir ANTES de crear funciones que la usen
-- (Postgres valida el cuerpo al crear la función).
create extension if not exists "unaccent";

-- -----------------------------------------------------------------------------
-- Helper: normaliza texto para comparación (minúsculas, sin acentos, sin espacios extra)
-- STABLE (no IMMUTABLE) porque unaccent() depende del diccionario instalado.
-- -----------------------------------------------------------------------------
create or replace function public.normalizar_texto(p text)
returns text
language sql
stable
as $$
  select trim(regexp_replace(lower(unaccent(coalesce(p, ''))), '\s+', ' ', 'g'));
$$;

-- -----------------------------------------------------------------------------
-- Helper: huella de desduplicación.
-- Si hay cédula -> usa la cédula (solo dígitos). Si no -> nombre normalizado.
-- -----------------------------------------------------------------------------
create or replace function public.calcular_hash_dedup(p_cedula text, p_nombre text)
returns text
language sql
stable
as $$
  select case
    when nullif(regexp_replace(coalesce(p_cedula,''), '\D', '', 'g'), '') is not null
      then 'ced:' || regexp_replace(p_cedula, '\D', '', 'g')
    else 'nom:' || public.normalizar_texto(p_nombre)
  end;
$$;

-- =============================================================================
-- RPC: reportar_persona  (UPSERT con desduplicación por IA — versión servidor)
-- Devuelve el reporte resultante + si fue nuevo o unificado.
-- Esta es la lógica real detrás de la "Desduplicación por IA" del frontend.
-- =============================================================================
create or replace function public.reportar_persona(
  p_nombre        text,
  p_cedula        text,
  p_estado        estado_persona,
  p_ubicacion     text,
  p_lat           double precision,
  p_lng           double precision,
  p_fuente        fuente_reporte default 'web',
  p_edad          int            default null,
  p_telefono      text           default null,
  p_detalle       text           default null,
  p_reportado_por text           default null,
  p_lista_id      uuid           default null
)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash       text;
  v_existente  public.reportes_personas%rowtype;
  v_resultado  public.reportes_personas%rowtype;
  v_unificado  boolean := false;
begin
  -- ---- Validación de entrada (no confiar en el cliente) -------------------
  if coalesce(trim(p_nombre), '') = '' then
    raise exception 'El nombre es obligatorio' using errcode = '22000';
  end if;
  if p_lat is null or p_lng is null
     or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'Coordenadas inválidas' using errcode = '22000';
  end if;
  -- Saneamiento básico: recortar longitudes para evitar abuso
  p_nombre    := left(trim(p_nombre), 120);
  p_ubicacion := left(trim(coalesce(p_ubicacion, 'Desconocida')), 160);
  p_detalle   := left(coalesce(p_detalle, ''), 500);

  v_hash := public.calcular_hash_dedup(p_cedula, p_nombre);

  -- ---- ¿Ya existe un reporte con esta huella? -----------------------------
  select * into v_existente
  from public.reportes_personas
  where hash_dedup = v_hash
  limit 1;

  if found then
    -- DESDUPLICACIÓN: unificamos en lugar de crear un pin nuevo.
    update public.reportes_personas
       set veces_reportado = v_existente.veces_reportado + 1,
           -- "a_salvo" gana prioridad informativa sobre "desaparecido"
           estado    = case when p_estado = 'a_salvo' then 'a_salvo' else estado end,
           ubicacion = coalesce(nullif(p_ubicacion, ''), ubicacion),
           lat       = p_lat,
           lng       = p_lng,
           detalle   = coalesce(nullif(p_detalle, ''), detalle),
           updated_at = now()
     where id = v_existente.id
    returning * into v_resultado;
    v_unificado := true;
  else
    insert into public.reportes_personas
      (nombre, cedula, estado, ubicacion, lat, lng, fuente, edad,
       telefono_contacto, detalle, reportado_por, lista_origen_id, hash_dedup)
    values
      (p_nombre, p_cedula, p_estado, p_ubicacion, p_lat, p_lng, p_fuente, p_edad,
       p_telefono, p_detalle, p_reportado_por, p_lista_id, v_hash)
    returning * into v_resultado;
  end if;

  return json_build_object(
    'unificado', v_unificado,
    'reporte', row_to_json(v_resultado)
  );
end $$;

comment on function public.reportar_persona is
  'Inserta o unifica (desduplica) un reporte de persona. Único camino de escritura permitido al rol anon.';

-- =============================================================================
-- RPC: registrar_lista_ocr — crea/actualiza la bitácora del pipeline OCR
-- =============================================================================
create or replace function public.registrar_lista_ocr(
  p_nombre_archivo text,
  p_storage_path   text,
  p_estado         estado_ocr default 'subiendo',
  p_texto          text       default null,
  p_detectados     int        default 0,
  p_duplicados     int        default 0,
  p_subido_por     text       default null,
  p_id             uuid       default null
)
returns public.listas_ocr
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_row public.listas_ocr;
begin
  if p_id is null then
    insert into public.listas_ocr
      (nombre_archivo, storage_path, estado, texto_extraido,
       registros_detectados, duplicados_unificados, subido_por)
    values
      (left(trim(p_nombre_archivo),200), p_storage_path, p_estado, p_texto,
       greatest(p_detectados,0), greatest(p_duplicados,0), p_subido_por)
    returning * into v_row;
  else
    update public.listas_ocr
       set estado = p_estado,
           texto_extraido = coalesce(p_texto, texto_extraido),
           registros_detectados = greatest(p_detectados,0),
           duplicados_unificados = greatest(p_duplicados,0),
           updated_at = now()
     where id = p_id
    returning * into v_row;
  end if;
  return v_row;
end $$;

-- =============================================================================
-- RPC: actualizar_acopio — un coordinador actualiza capacidad / insumos
-- (En producción restringir a rol `authenticated`; ver 03_policies.sql)
-- =============================================================================
create or replace function public.actualizar_acopio(
  p_id        uuid,
  p_capacidad capacidad_acopio,
  p_insumos   text[]
)
returns public.centros_acopio
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_row public.centros_acopio;
begin
  update public.centros_acopio
     set capacidad = p_capacidad,
         insumos_solicitados = coalesce(p_insumos, insumos_solicitados),
         updated_at = now()
   where id = p_id
  returning * into v_row;
  if not found then
    raise exception 'Centro de acopio no encontrado' using errcode = '02000';
  end if;
  return v_row;
end $$;

-- =============================================================================
-- RPC: crear_acopio — alta de un nuevo centro de acopio
-- (escritura segura vía RPC, igual que el resto; SECURITY DEFINER)
-- =============================================================================
create or replace function public.crear_acopio(
  p_nombre      text,
  p_ubicacion   text,
  p_lat         double precision,
  p_lng         double precision,
  p_contacto    text default null,
  p_responsable text default null
)
returns public.centros_acopio
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_row public.centros_acopio;
begin
  insert into public.centros_acopio (nombre, ubicacion, lat, lng, contacto, responsable)
  values (p_nombre, p_ubicacion, p_lat, p_lng, p_contacto, p_responsable)
  returning * into v_row;
  return v_row;
end $$;

-- =============================================================================
-- RPC: obtener_metricas — tarjetas del dashboard, calculadas en servidor
-- (evita exponer la tabla completa solo para contar)
-- =============================================================================
create or replace function public.obtener_metricas()
returns json
language sql
security definer
set search_path = public, extensions
as $$
  select json_build_object(
    'total_reportados', (select count(*) from public.reportes_personas),
    'desaparecidos',    (select count(*) from public.reportes_personas where estado = 'desaparecido'),
    'localizados',      (select count(*) from public.reportes_personas where estado = 'a_salvo'),
    'criticos',         (select count(*) from public.reportes_personas
                          where estado = 'desaparecido' and veces_reportado >= 2),
    'centros_activos',  (select count(*) from public.centros_acopio where capacidad <> 'cerrado'),
    'sismos_24h',       (select count(*) from public.sismos where ocurrido_en > now() - interval '24 hours')
  );
$$;

comment on function public.obtener_metricas is 'Métricas agregadas para el dashboard (lectura segura, sin exponer filas).';
