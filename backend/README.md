# OmniRed · Backend (Supabase / PostgreSQL)

Capa de datos de OmniRed. Todo el esquema, la lógica de negocio sensible
(desduplicación, métricas) y las políticas de seguridad viven aquí.

## 📦 Despliegue

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. Abre el **SQL Editor** y ejecuta los scripts **en orden**:

   | Orden | Archivo | Qué hace |
   |-------|---------|----------|
   | 1 | [`supabase/01_schema.sql`](supabase/01_schema.sql) | Tipos ENUM, tablas, índices, triggers `updated_at` |
   | 2 | [`supabase/02_functions.sql`](supabase/02_functions.sql) | RPC `SECURITY DEFINER` (única vía de escritura del cliente) |
   | 3 | [`supabase/03_policies.sql`](supabase/03_policies.sql) | RLS + vista pública con PII enmascarada + grants |
   | 4 | [`supabase/04_seed.sql`](supabase/04_seed.sql) | Datos de demo (geografía Venezuela) |
   | 5 | [`supabase/05_storage.sql`](supabase/05_storage.sql) | Bucket privado `listas_sismo` + políticas |

3. En **Project Settings → API** copia `Project URL` y la clave **`anon` / publishable**.
   ⚠️ **Nunca** copies la `service_role` al frontend.
4. Pégalas en [`frontend/src/environments/environment.ts`](../frontend/src/environments/environment.ts)
   y cambia `supabase.mode` a `'supabase'`.

## 🧱 Modelo de datos

```
reportes_personas ──┐ (lista_origen_id)
                    └──> listas_ocr        (bitácora del pipeline OCR)
centros_acopio        (puntos de acopio + insumos solicitados)
sismos                (feed de réplicas)
v_reportes_publico    (VISTA: cédula enmascarada, para el cliente anónimo)
```

## 🔐 Seguridad

El detalle completo del modelo de amenazas y las decisiones de seguridad está en
[`SECURITY.md`](SECURITY.md). En una frase:

> El navegador usa **solo la clave `anon`**, **no puede escribir directamente**
> en ninguna tabla (RLS lo bloquea) y realiza cambios **únicamente** a través de
> RPC validadas en el servidor. La PII (cédula) se sirve enmascarada por una vista.

## 🔄 Realtime (opcional)

Para que el mapa y las métricas se actualicen solos, habilita Realtime sobre
`reportes_personas`, `centros_acopio` y `sismos`:

```sql
alter publication supabase_realtime add table public.reportes_personas;
alter publication supabase_realtime add table public.centros_acopio;
alter publication supabase_realtime add table public.sismos;
```

El frontend ya tiene el _hook_ de suscripción preparado en `supabase.service.ts`.
