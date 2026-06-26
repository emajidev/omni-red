-- =============================================================================
-- 06_facilities.sql — Refugios y hospitales + vínculo persona→sitio
-- -----------------------------------------------------------------------------
-- Unifica refugios/hospitales sobre `centros_acopio` con una columna `tipo`,
-- vincula reportes de personas a un sitio (centro_id) y siembra los sitios
-- reales habilitados tras los sismos del 24-jun-2026 (fuentes: Alcaldía de
-- Caracas / Protección Civil, prensa). Idempotente.
-- =============================================================================

-- Tipo de sitio
do $$ begin
  if not exists (select 1 from pg_type where typname = 'tipo_centro') then
    create type public.tipo_centro as enum ('acopio', 'refugio', 'hospital');
  end if;
end $$;

-- Columna tipo en centros_acopio (acopio por defecto: no rompe lo existente)
alter table public.centros_acopio
  add column if not exists tipo public.tipo_centro not null default 'acopio';

-- Vínculo persona → sitio (hospital/refugio donde está)
alter table public.reportes_personas
  add column if not exists centro_id uuid;

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'reportes_personas_centro_id_fkey'
  ) then
    alter table public.reportes_personas
      add constraint reportes_personas_centro_id_fkey
      foreign key (centro_id) references public.centros_acopio(id) on delete set null;
  end if;
end $$;

-- Vista pública: exponer edad y centro_id (se añaden al final → CREATE OR REPLACE OK)
create or replace view public.v_reportes_publico
with (security_invoker = true) as
  select
    id,
    nombre,
    public.enmascarar_cedula(cedula) as cedula,
    estado,
    ubicacion,
    lat,
    lng,
    fuente,
    veces_reportado,
    created_at,
    telefono_contacto,
    edad,
    centro_id
  from public.reportes_personas;

grant select on public.v_reportes_publico to anon, authenticated;

-- RPC: asignar (o limpiar) el sitio de una persona — escritura segura
create or replace function public.asignar_centro(
  p_persona_id uuid,
  p_centro_id  uuid
)
returns public.reportes_personas
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_row public.reportes_personas;
begin
  update public.reportes_personas
     set centro_id = p_centro_id
   where id = p_persona_id
  returning * into v_row;
  if not found then
    raise exception 'Reporte no encontrado' using errcode = '02000';
  end if;
  return v_row;
end $$;

revoke all on function public.asignar_centro from public;
grant execute on function public.asignar_centro(uuid, uuid) to anon, authenticated;

-- =============================================================================
-- Siembra de sitios reales (refugios + hospitales). Idempotente por nombre.
-- =============================================================================
insert into public.centros_acopio (nombre, ubicacion, lat, lng, tipo)
select v.nombre, v.ubicacion, v.lat, v.lng, v.tipo::public.tipo_centro
from (values
  -- Refugios habilitados (Alcaldía de Caracas / Protección Civil, 24-jun-2026)
  ('Refugio Complejo Guayana Esequiba', 'San Bernardino, Libertador',        10.5106, -66.8917, 'refugio'),
  ('Refugio Estadio Chato Candela',     '23 de Enero, Libertador',           10.5169, -66.9269, 'refugio'),
  ('Refugio Sede del IND',              'El Paraíso, Libertador',            10.4889, -66.9333, 'refugio'),
  ('Refugio Sede de Ipostel',           'San Juan, Libertador',              10.4878, -66.9131, 'refugio'),
  ('Refugio Parque Alí Primera',        'Catia, Oeste de Caracas',           10.5050, -66.9400, 'refugio'),
  ('Refugio Parque Francisco de Miranda','Los Palos Grandes, Sucre',         10.4969, -66.8389, 'refugio'),
  ('Refugio Plaza Altamira',            'Altamira, Chacao',                  10.4956, -66.8536, 'refugio'),
  ('Refugio Plaza Bolívar de Chacao',   'Chacao',                            10.4978, -66.8539, 'refugio'),
  -- Hospitales principales
  ('Hospital Universitario de Caracas', 'Los Chaguaramos, Libertador',       10.4925, -66.8906, 'hospital'),
  ('Hospital de Niños J. M. de los Ríos','San Bernardino, Libertador',       10.5067, -66.8950, 'hospital'),
  ('Hospital Miguel Pérez Carreño',     'La Yaguara, Libertador',            10.4575, -66.9608, 'hospital'),
  ('Hospital Dr. Domingo Luciani',      'El Llanito, Sucre',                 10.4747, -66.8092, 'hospital'),
  ('Hospital Militar Dr. Carlos Arvelo','San Martín, Libertador',            10.4806, -66.9300, 'hospital'),
  ('Hospital Vargas de Caracas',        'San José, Libertador',              10.5089, -66.9061, 'hospital'),
  ('Hospital Ana Francisca Pérez de León','Petare, Sucre',                   10.4783, -66.8047, 'hospital'),
  ('Hospital José Gregorio Hernández',  'Los Magallanes de Catia, Libertador',10.5167,-66.9300, 'hospital')
) as v(nombre, ubicacion, lat, lng, tipo)
where not exists (
  select 1 from public.centros_acopio c where c.nombre = v.nombre
);
