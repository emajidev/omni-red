# 🔴 OmniRed — Plataforma de Respuesta a Crisis

> Sistema de centralización de información para la mitigación del caos tras el sismo en Venezuela.
> Unifica búsquedas por scraping, cruce de datos de imágenes vía OCR y mapeo de reportes en tiempo real.

OmniRed reduce el caos informativo posterior a un desastre natural centralizando, en una única
fuente de verdad, los reportes de personas desaparecidas/a salvo, los centros de acopio activos y
la actividad sísmica — todo georreferenciado sobre un mapa interactivo y con desduplicación
asistida por IA para evitar reportes redundantes.

---

## 🗂️ Estructura del proyecto

```
omni-red/
├── frontend/                 # Aplicación web (mobile-first, Tailwind + Leaflet)
│   ├── index.html            # Punto de entrada / shell de la SPA
│   ├── css/
│   │   └── styles.css        # Estilos personalizados (pines, animaciones, scrollbars)
│   └── js/
│       ├── config.js         # Claves y constantes (Supabase URL/anon key, capas de mapa)
│       ├── supabaseClient.js # Wrapper de acceso a datos (modo MOCK ⇄ modo SUPABASE)
│       ├── mockData.js       # Datos de prueba coherentes con la geografía de Venezuela
│       ├── store.js          # Estado central + bus de eventos (pub/sub)
│       ├── dashboard.js      # Buscador, filtros en tiempo real y métricas animadas
│       ├── map.js            # Mapa Leaflet, marcadores dinámicos y popups
│       ├── ocr.js            # Pipeline de carga + OCR + desduplicación por IA
│       ├── acopio.js         # Directorio de centros de acopio + feed de sismos
│       └── app.js            # Arranque y orquestación de módulos
│
├── backend/                  # Backend Supabase (PostgreSQL + Storage)
│   ├── supabase/
│   │   ├── 01_schema.sql     # Tablas, tipos ENUM, índices
│   │   ├── 02_functions.sql  # RPC: desduplicación, upsert inteligente, métricas
│   │   ├── 03_policies.sql   # Row Level Security (RLS)
│   │   ├── 04_seed.sql       # Datos semilla (mismos que el mock del frontend)
│   │   └── 05_storage.sql    # Bucket `listas_sismo` + políticas de Storage
│   └── README.md             # Guía de despliegue del backend
│
└── README.md                 # (este archivo)
```

---

## 🚀 Puesta en marcha (demo, sin backend)

La demo funciona **100 % en modo MOCK** sin necesidad de Supabase. Solo necesitas servir la
carpeta `frontend/` con cualquier servidor estático (Leaflet y los _fetch_ necesitan `http://`,
no `file://`).

```bash
cd frontend
python3 -m http.server 8080
#  → abre http://localhost:8080
```

> Alternativas: `npx serve frontend`, la extensión *Live Server* de VS Code, etc.

---

## 🔌 Conectar el backend real (Supabase)

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. Ejecuta los SQL de `backend/supabase/` **en orden** (01 → 05) desde el *SQL Editor*.
3. En [frontend/js/config.js](frontend/js/config.js) pon `MODE: 'supabase'` y rellena
   `SUPABASE_URL` / `SUPABASE_ANON_KEY`.
4. Añade el CDN de `@supabase/supabase-js` en [frontend/index.html](frontend/index.html)
   (ya está comentado y listo para descomentar).

Todas las llamadas reales están encapsuladas en
[frontend/js/supabaseClient.js](frontend/js/supabaseClient.js): cada método tiene la implementación
mock activa y, justo al lado, el código Supabase real comentado
(`supabase.from('reportes_personas').select('*')`, etc.). Cambiar de mock a real es cuestión de
descomentar.

---

## 🎨 Sistema de color (semántica de alerta)

| Color | Significado |
|-------|-------------|
| 🔴 Rojo (parpadeante) | Persona desaparecida / auxilio urgente |
| 🟢 Verde | Persona reportada a salvo en refugio |
| 🔵 Azul | Centro de acopio activo |
| 🟠 Naranja | Acentos de alerta / acciones secundarias |

---

## ⚠️ Aviso

Los datos incluidos son **ficticios** y se usan únicamente para fines de demostración técnica
ante el equipo de desarrollo. Nombres, cédulas y coordenadas son inventados aunque coherentes con
la geografía venezolana.
