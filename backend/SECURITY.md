# 🔐 OmniRed · Seguridad Frontend ↔ Backend

Cómo el cliente Angular consulta Supabase de forma segura. Modelo de amenazas y
controles aplicados.

---

## 1. El cliente solo conoce la clave `anon`

| Clave | Dónde vive | Permisos |
|-------|------------|----------|
| `anon` / publishable | Frontend (público, embebida en el bundle) | Lo que **RLS + grants** permitan, nada más |
| `service_role` | **Solo** en servidores/Edge Functions/cron | Omite RLS (super-privilegiada) |

> ⛔️ **Regla de oro:** la `service_role` jamás se incluye en el frontend, ni en
> `environment.ts`, ni en variables `NG_*`. Si se filtra, se compromete toda la base.

La clave `anon` es pública **por diseño**: no es un secreto. La seguridad real la
da **Row Level Security**, no la ocultación de la clave.

---

## 2. Row Level Security (RLS): denegar por defecto

`alter table ... enable row level security` activa un *default-deny*: sin una
policy explícita, ninguna fila es accesible. Definimos (ver `03_policies.sql`):

- **Lectura pública** (`anon`): `reportes_personas`, `centros_acopio`, `sismos`.
- **Escritura directa**: **prohibida para `anon`**. No existe ninguna policy de
  `INSERT/UPDATE/DELETE` para ese rol → todo intento se rechaza.
- **Escritura autenticada** (`authenticated`): rescatistas/coordinadores logueados.
- `listas_ocr` y el bucket `listas_sismo`: **solo autenticados** (contienen PII cruda).

---

## 3. Toda escritura del navegador pasa por RPC validadas

El cliente anónimo **no** hace `from('reportes_personas').insert(...)`. Llama a
funciones `SECURITY DEFINER` que:

1. **Validan** la entrada (nombre obligatorio, rango de coordenadas, longitudes máx.).
2. **Sanean** (recorte de longitud, normalización) — defensa ante datos basura/abuso.
3. Ejecutan la **lógica sensible en el servidor** (cálculo de hash y desduplicación),
   que **nunca** debe vivir en el cliente porque sería manipulable.
4. Usan `set search_path = public, extensions` para evitar *search-path hijacking*.

```ts
// ✅ Correcto (frontend): RPC que valida en servidor
await supabase.rpc('reportar_persona', { p_nombre, p_cedula, ... });

// ❌ Nunca desde el cliente anónimo: insert directo sin validación
// await supabase.from('reportes_personas').insert({...});
```

---

## 4. Minimización y enmascarado de PII

La cédula es dato personal. El cliente público lee la **vista** `v_reportes_publico`,
que enmascara la cédula (`V-12.345.678` → `V-••.•••.678`). La tabla cruda con la
cédula completa solo es accesible por personal autenticado.

> En la demo en **modo mock** se muestra la cédula completa para ilustrar el caso de
> uso; en **modo supabase** el frontend consulta la vista enmascarada por defecto.

---

## 5. Validación también en el cliente (defensa en profundidad)

Las *Reactive Forms* de Angular validan antes de enviar (campos requeridos,
formato de cédula `V-########`, coordenadas). Es **UX**, no seguridad: la
validación que cuenta es la del servidor (punto 3). Nunca se confía en el cliente.

---

## 6. Transporte y cabeceras

- **HTTPS** extremo a extremo (Supabase lo fuerza).
- **CSP** recomendada al servir el frontend (ver `frontend/src/index.html`):
  restringe `connect-src` a `*.supabase.co` y a los *tiles* del mapa; bloquea
  scripts inline no confiables.
- El `supabase-js` usa `fetch` parametrizado → sin construcción de SQL por strings,
  no hay superficie de **inyección SQL** desde el cliente.

---

## 7. Abuso / Rate limiting (reportes públicos)

Al ser un formulario público, el endpoint `reportar_persona` es susceptible de spam.
Mitigaciones recomendadas para producción (fuera del alcance de la demo):

- **Cloudflare Turnstile / hCaptcha** antes de invocar la RPC.
- **Rate limit** por IP en una Edge Function que haga de proxy de la RPC.
- Cola de **moderación**: los reportes anónimos entran como `pendiente` y un
  coordinador los aprueba (columna de estado de revisión + policy).

---

## ✅ Checklist de despliegue seguro

- [ ] `service_role` **no** está en el repo ni en el bundle del frontend.
- [ ] RLS activado y `force` en `reportes_personas`.
- [ ] No hay policies de escritura para `anon`.
- [ ] Grants de `execute` mínimos: `anon` solo a `reportar_persona` y `obtener_metricas`.
- [ ] Bucket `listas_sismo` es **privado**; acceso vía URL firmada.
- [ ] El cliente público consume la vista enmascarada `v_reportes_publico`.
- [ ] CSP y HTTPS activos en el hosting del frontend.
