# OmniRed · Frontend (Angular 18)

Aplicación **mobile-first** de una sola vista: el **mapa es el lienzo** y los
botones a mano despliegan **hojas de media pantalla** (bottom sheets) para cada
función. Modo oscuro de alto contraste. Funciona en **modo DEMO** (sin backend)
o conectada a **Supabase**.

## ▶️ Ejecutar

Requiere Node ≥ 18.19. Desde esta carpeta (`frontend/`):

```bash
npm install
npm start          # ng serve → http://localhost:4200
```

> La app arranca en **modo DEMO** (datos locales de Venezuela). No necesitas
> backend para verla funcionar.

## 🧭 Cómo se usa (una sola vista)

- **Mapa de fondo**: abre enfocado en Venezuela Norte-Central, resaltando
  **Caracas**, **La Guaira** y **Carabobo** (círculos naranja + etiqueta).
  Pines: 🔴 desaparecido (parpadea), 🟢 a salvo, 🔵 acopio. Toca un pin → popup.
- **Barra superior**: búsqueda prominente + métricas en vivo (animadas).
- **Botones inferiores (a mano)** → abren una hoja a media pantalla:
  - 🚨 **Reportar desaparecido** / 🟢 **Reportar a salvo** (formulario validado)
  - 🔍 **Buscar** (filtro en tiempo real por nombre / cédula / ubicación)
  - 📷 **Cargar lista** (pipeline OCR: subida → escaneo → desduplicación IA → tabla)
  - 📦 **Acopio · Sismos** (centros de acopio + feed sísmico cronológico)

## 🗂️ Estructura

```
src/app/
├── app.component.ts            # Shell de una sola vista (mapa + barras + host de hojas)
├── core/
│   ├── models/models.ts        # Interfaces de dominio (espejo de las tablas)
│   ├── data/mock-data.ts       # Datos demo coherentes con Venezuela
│   ├── util/labels.ts          # Etiquetas/colores/formatos
│   └── services/
│       ├── supabase.service.ts # Cliente seguro (solo anon, RPC, realtime)
│       ├── crisis-data.service.ts # Fachada de datos (mock ⇄ supabase)
│       └── ui.service.ts       # Estado de UI (hoja activa, búsqueda, foco)
├── shared/
│   ├── bottom-sheet/           # Hoja reutilizable de media pantalla
│   └── count-up.directive.ts   # Animación de métricas
└── features/
    ├── map/                    # Mapa Leaflet (capa oscura, marcadores, popups)
    ├── search/                 # Hoja buscar + métricas
    ├── report/                 # Hoja reportar persona
    ├── ocr/                    # Hoja carga + OCR + desduplicación
    └── centers/                # Hoja acopio + sismos
```

## 🔌 Conectar Supabase real

1. Despliega el backend (ver [`../backend/README.md`](../backend/README.md)).
2. En [`src/environments/environment.ts`](src/environments/environment.ts):
   ```ts
   supabase: { mode: 'supabase', url: 'https://xxxx.supabase.co', anonKey: '...' }
   ```
3. `npm start`. El servicio cambia solo de datos mock a llamadas reales:
   - Lectura: `supabase.from('v_reportes_publico').select('*')` (cédula enmascarada)
   - Escritura: `supabase.rpc('reportar_persona', {...})` (validado en servidor)

## 🔐 Seguridad (resumen)

- Solo se usa la clave **`anon`** (nunca `service_role`).
- **Cero `insert` directo**: toda escritura pasa por **RPC** validadas en el servidor.
- Contenido de popups **escapado** (anti-XSS); CSP que limita `connect-src`.
- Detalle completo en [`../backend/SECURITY.md`](../backend/SECURITY.md).

## 🛠️ Tecnología

- Angular 18 (standalone components + **signals**), TypeScript.
- **Tailwind CSS** (CDN) — paleta de alerta: rojo/naranja (alerta), azul (acopio), verde (a salvo).
- **Leaflet.js** + capa `CartoDB.DarkMatter` (CDN).
- `@supabase/supabase-js` para el backend real.

> Tailwind y Leaflet se cargan por CDN para una demo autocontenida. En
> producción, compila Tailwind con PostCSS y sirve una CSP estricta por cabecera.
