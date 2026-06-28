-- =============================================================================
-- Contador de visitas (total acumulado de cargas de la app).
--
-- La API (VisitasService) crea esta tabla automáticamente al iniciar, así que
-- este archivo es solo la referencia/fuente de verdad del esquema. Es una tabla
-- de fila única; el backend la incrementa de forma atómica con un UPSERT.
-- =============================================================================

create table if not exists public.visitas (
  id              smallint    primary key default 1,
  total           bigint      not null default 0,
  actualizado_en  timestamptz not null default now(),
  constraint visitas_fila_unica check (id = 1)
);

insert into public.visitas (id, total) values (1, 0)
on conflict (id) do nothing;
