-- =============================================================================
-- OmniRed · 07_carga_masiva.sql
-- Soporte de carga masiva (CSV) + nueva entidad "edificios caídos".
--
-- - Personas, centros de acopio, hospitales y refugios ya existen
--   (reportes_personas / centros_acopio.tipo).
-- - Aquí se añade la tabla `edificios_caidos` (estructuras dañadas / colapsadas)
--   para registrar sitios de rescate.
--
-- Idempotente. Ejecutar tras 01..06 en el SQL Editor de Supabase (o vía la
-- conexión del backend).
-- =============================================================================

-- Nivel de daño de un edificio.
do $$ begin
  if not exists (select 1 from pg_type where typname = 'nivel_dano') then
    create type public.nivel_dano as enum ('parcial', 'severo', 'colapsado');
  end if;
end $$;

-- Estado del rescate en un edificio.
do $$ begin
  if not exists (select 1 from pg_type where typname = 'estado_edificio') then
    create type public.estado_edificio as enum ('reportado', 'en_rescate', 'despejado');
  end if;
end $$;

-- =============================================================================
-- Tabla: edificios_caidos
-- Estructuras dañadas/colapsadas tras el sismo (sitios de rescate).
-- =============================================================================
create table if not exists public.edificios_caidos (
  id                 uuid primary key default uuid_generate_v4(),
  nombre             text             not null,   -- referencia: "Residencias Tacagua"
  ubicacion          text             not null,   -- dirección legible
  lat                double precision not null,
  lng                double precision not null,
  nivel_dano         public.nivel_dano     not null default 'severo',
  personas_atrapadas int              not null default 0,
  estado             public.estado_edificio not null default 'reportado',
  contacto           text,                         -- coordinador de rescate / reportante
  created_at         timestamptz      not null default now(),
  updated_at         timestamptz      not null default now()
);

comment on table public.edificios_caidos is 'Edificios dañados/colapsados tras el sismo; sitios de rescate.';
comment on column public.edificios_caidos.personas_atrapadas is 'Estimación de personas atrapadas reportadas.';

create index if not exists idx_edificios_estado on public.edificios_caidos (estado);
create index if not exists idx_edificios_nivel  on public.edificios_caidos (nivel_dano);

-- Mantener updated_at (reusa la función genérica de 01_schema.sql)
drop trigger if exists trg_edificios_touch on public.edificios_caidos;
create trigger trg_edificios_touch before update on public.edificios_caidos
  for each row execute function public.touch_updated_at();
