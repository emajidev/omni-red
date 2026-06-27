-- =============================================================================
-- OmniRed · 08_edificios_sync.sql
-- Soporte de INGESTA EXTERNA de edificios dañados.
--
-- La app pública terremotovenezuela.com mantiene un mapa curado de edificios
-- con daños (tabla `buildings` en su propio Supabase, lectura pública vía
-- PostgREST). El backend la sincroniza periódicamente hacia `edificios_caidos`
-- (ver EdificiosSyncService). Para que la sincronización sea IDEMPOTENTE y pueda
-- PROPAGAR cambios de estado/daño, cada fila ingerida guarda su origen:
--   - `fuente`     → nombre corto de la fuente (p. ej. 'terremotovenezuela')
--   - `fuente_id`  → id estable de la fila en la fuente (su uuid)
--
-- Idempotente. Ejecutar tras 07 en el SQL Editor de Supabase (o vía la
-- conexión del backend).
-- =============================================================================

alter table public.edificios_caidos
  add column if not exists fuente    text,
  add column if not exists fuente_id text;

comment on column public.edificios_caidos.fuente is
  'Origen de la fila si proviene de una fuente externa (NULL si es manual/CSV).';
comment on column public.edificios_caidos.fuente_id is
  'Identificador estable de la fila en la fuente externa (para upsert idempotente).';

-- Clave natural para el upsert de la ingesta externa. Parcial: las filas
-- manuales (fuente NULL) no participan y pueden repetir nombre libremente.
create unique index if not exists uq_edificios_fuente
  on public.edificios_caidos (fuente, fuente_id)
  where fuente is not null;
