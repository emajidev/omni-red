# OmniRed · API (NestJS)

API REST que sirve los datos de OmniRed al frontend. Se conecta a la base
**Supabase Postgres** mediante el *connection pooler* IPv4 (la conexión directa
`db.<ref>.supabase.co` es IPv6-only) y encapsula las RPC del backend.

```
Angular (HttpClient)  ──HTTP──>  API NestJS  ──pg──>  Supabase Postgres (pooler)
```

## 🚀 Puesta en marcha

```bash
cd backend/api
cp .env.example .env      # rellena PGUSER/PGPASSWORD (ya viene apuntando al pooler)
npm install
npm run start:dev         # http://localhost:3000/api
```

> Node se ejecuta desde **WSL** (la red Windows no tiene salida IPv6, pero el
> pooler es IPv4 y funciona).

## 🔌 Endpoints

| Método | Ruta | Descripción | Origen en BD |
|--------|------|-------------|--------------|
| GET | `/api/health` | estado del servicio + conexión a BD | `select now()` |
| GET | `/api/personas` | lista de personas (cédula enmascarada) | vista `v_reportes_publico` |
| GET | `/api/personas?estado=desaparecido` | filtra por estado | `v_reportes_publico` |
| POST | `/api/personas` | reporta/desduplica una persona | RPC `reportar_persona` |
| GET | `/api/centros` | centros de acopio | tabla `centros_acopio` |
| PATCH | `/api/centros/:id` | actualiza capacidad/insumos | RPC `actualizar_acopio` |
| GET | `/api/sismos` | feed de sismos | tabla `sismos` |
| GET | `/api/metricas` | métricas del dashboard | RPC `obtener_metricas` |

### Ejemplos

```bash
# Listar desaparecidos
curl 'http://localhost:3000/api/personas?estado=desaparecido'

# Reportar una persona
curl -X POST http://localhost:3000/api/personas \
  -H 'Content-Type: application/json' \
  -d '{"nombre":"Juan Pérez","cedula":"V-1.234.567","estado":"desaparecido",
       "ubicacion":"Catia La Mar","lat":10.6,"lng":-67.03,"fuente":"web"}'

# Actualizar un centro de acopio
curl -X PATCH http://localhost:3000/api/centros/<uuid> \
  -H 'Content-Type: application/json' \
  -d '{"capacidad":"al_limite","insumos_solicitados":["agua","medicinas"]}'
```

## 🏗️ Estructura

```
src/
├── main.ts                  # bootstrap: prefijo /api, CORS, validación, filtro de errores
├── app.module.ts            # módulo raíz
├── health.controller.ts     # GET /api/health
├── common/
│   └── pg-exception.filter.ts   # errores de Postgres -> respuestas HTTP limpias
├── database/                # pool de conexiones pg (global)
├── personas/                # GET/POST personas
├── centros/                 # GET/PATCH centros de acopio
├── sismos/                  # GET sismos
└── metricas/                # GET métricas
```

## 🔐 Notas de seguridad

- `/api/personas` lee la **vista enmascarada** `v_reportes_publico`, no la tabla
  base, para no exponer la cédula completa.
- Toda escritura pasa por las **RPC** del backend (validan en servidor), nunca
  por `INSERT` directo.
- El `.env` (credenciales) está en `.gitignore`.
