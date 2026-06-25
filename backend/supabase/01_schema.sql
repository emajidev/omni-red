-- =============================================================================
-- OmniRed · 01_schema.sql
-- Esquema base: tipos, tablas, índices.
-- Ejecutar PRIMERO en el SQL Editor de Supabase.
-- =============================================================================

-- Extensiones útiles --------------------------------------------------------
create extension if not exists "uuid-ossp";   -- uuid_generate_v4()
create extension if not exists "pg_trgm";      -- búsqueda fuzzy por similitud (nombres)

-- =============================================================================
-- Tipos enumerados
-- =============================================================================

-- Estado de una persona reportada.
do $$ begin
  create type estado_persona as enum ('desaparecido', 'a_salvo', 'fallecido');
exception when duplicate_object then null; end $$;

-- Fuente de origen del reporte (scraping / OCR / web).
do $$ begin
  create type fuente_reporte as enum ('twitter', 'telegram', 'web', 'ocr_lista', 'llamada', 'whatsapp');
exception when duplicate_object then null; end $$;

-- Capacidad operativa de un centro de acopio.
do $$ begin
  create type capacidad_acopio as enum ('abierto', 'al_limite', 'cerrado');
exception when duplicate_object then null; end $$;

-- Estado de procesamiento de una lista cargada (pipeline OCR).
do $$ begin
  create type estado_ocr as enum ('subiendo', 'escaneando', 'desduplicando', 'completado', 'error');
exception when duplicate_object then null; end $$;

-- =============================================================================
-- Tabla: reportes_personas
-- Núcleo del sistema. Cada fila es un reporte de una persona (desaparecida,
-- a salvo, etc.) georreferenciado.
-- =============================================================================
create table if not exists public.reportes_personas (
  id            uuid primary key default uuid_generate_v4(),
  nombre        text            not null,
  cedula        text,                       -- puede ser null (no siempre se conoce)
  estado        estado_persona  not null default 'desaparecido',
  edad          int,
  telefono_contacto text,

  -- Geolocalización (última ubicación conocida)
  ubicacion     text            not null,   -- texto legible: "Caracas, Catia"
  lat           double precision not null,
  lng           double precision not null,

  -- Trazabilidad del reporte
  fuente        fuente_reporte  not null default 'web',
  detalle       text,                       -- notas libres del reporte
  reportado_por text,                       -- quién lo reportó (familiar, rescatista...)

  -- Cruce / desduplicación
  lista_origen_id uuid,                     -- FK a listas_ocr si vino de una lista
  hash_dedup    text,                       -- huella para detectar duplicados (cedula||nombre normalizado)
  veces_reportado int           not null default 1,  -- cuántas fuentes confirmaron este caso

  created_at    timestamptz     not null default now(),
  updated_at    timestamptz     not null default now()
);

comment on table public.reportes_personas is 'Reportes georreferenciados de personas tras el sismo.';
comment on column public.reportes_personas.hash_dedup is 'Huella normalizada (cédula o nombre) usada por la RPC de desduplicación.';
comment on column public.reportes_personas.veces_reportado is 'Número de fuentes que confirmaron este caso; se incrementa al unificar duplicados.';

-- Índices de búsqueda (el buscador filtra por nombre, cédula y ubicación)
create index if not exists idx_personas_estado    on public.reportes_personas (estado);
create index if not exists idx_personas_cedula     on public.reportes_personas (cedula);
create index if not exists idx_personas_hash       on public.reportes_personas (hash_dedup);
create index if not exists idx_personas_nombre_trgm on public.reportes_personas using gin (nombre gin_trgm_ops);
create index if not exists idx_personas_ubic_trgm  on public.reportes_personas using gin (ubicacion gin_trgm_ops);

-- =============================================================================
-- Tabla: centros_acopio
-- =============================================================================
create table if not exists public.centros_acopio (
  id          uuid primary key default uuid_generate_v4(),
  nombre      text             not null,
  ubicacion   text             not null,
  lat         double precision not null,
  lng         double precision not null,
  capacidad   capacidad_acopio not null default 'abierto',
  insumos_solicitados text[]   not null default '{}',  -- ['agua','medicinas','alimentos']
  contacto    text,
  responsable text,
  created_at  timestamptz      not null default now(),
  updated_at  timestamptz      not null default now()
);

comment on table public.centros_acopio is 'Puntos de acopio activos y sus necesidades en tiempo real.';

create index if not exists idx_acopio_capacidad on public.centros_acopio (capacidad);

-- =============================================================================
-- Tabla: sismos
-- Feed cronológico de lecturas sísmicas (alimentado por scraping de FUNVISIS / USGS).
-- =============================================================================
create table if not exists public.sismos (
  id          uuid primary key default uuid_generate_v4(),
  magnitud    numeric(3,1)     not null,
  epicentro   text             not null,
  lat         double precision not null,
  lng         double precision not null,
  profundidad_km numeric(5,1)  not null,
  fuente      text             not null default 'FUNVISIS',
  ocurrido_en timestamptz      not null,
  created_at  timestamptz      not null default now()
);

comment on table public.sismos is 'Lecturas sísmicas recientes (réplicas) ordenadas cronológicamente.';

create index if not exists idx_sismos_ocurrido on public.sismos (ocurrido_en desc);

-- =============================================================================
-- Tabla: listas_ocr
-- Registro de cada imagen subida al bucket `listas_sismo` y su pipeline OCR.
-- =============================================================================
create table if not exists public.listas_ocr (
  id            uuid primary key default uuid_generate_v4(),
  nombre_archivo text            not null,
  storage_path  text,                       -- ruta dentro del bucket listas_sismo
  estado        estado_ocr      not null default 'subiendo',
  texto_extraido text,                      -- volcado bruto del OCR
  registros_detectados int      not null default 0,
  duplicados_unificados int     not null default 0,
  subido_por    text,
  created_at    timestamptz     not null default now(),
  updated_at    timestamptz     not null default now()
);

comment on table public.listas_ocr is 'Bitácora del pipeline de OCR para listas escritas a mano / capturas.';

-- FK diferida (reportes -> lista que lo originó)
alter table public.reportes_personas
  drop constraint if exists fk_reporte_lista;
alter table public.reportes_personas
  add constraint fk_reporte_lista
  foreign key (lista_origen_id) references public.listas_ocr(id) on delete set null;

-- =============================================================================
-- Trigger genérico: mantener updated_at
-- =============================================================================
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_personas_touch on public.reportes_personas;
create trigger trg_personas_touch before update on public.reportes_personas
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_acopio_touch on public.centros_acopio;
create trigger trg_acopio_touch before update on public.centros_acopio
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_listas_touch on public.listas_ocr;
create trigger trg_listas_touch before update on public.listas_ocr
  for each row execute function public.touch_updated_at();
