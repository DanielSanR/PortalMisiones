# E2E del backoffice (staging o backend local)

Prueba de punta a punta automatizada con Playwright para Python (Firefox headless). Recorre el backoffice Angular
pasando por el proxy del dev server, contra **staging** (default) o contra el **backend local** en Docker.

## Cómo correrlo
Credenciales: copiá `e2e/.env.example` a `e2e/.env` (ignorado por git) y completá los usuarios de prueba
(están en `backoffice/login.data.md`, local y no versionado). También se pueden pasar como variables de entorno.
Sin ellas el script corta con un mensaje claro. **Nunca** las pongas en el código.

### Contra staging (default)
```bash
cd backoffice && npm run start:staging     # dev server en :4200 con proxy a staging (dejalo corriendo)
py -3.12 e2e/final_script.py               # desde la raíz del repo (requiere Playwright + Firefox instalados)
```

### Contra el backend local (Docker)
```bash
# 1. Backend: rama `dev` del repo del backend levantada con Docker (API en http://localhost:8080, Postgres local).
#    La base local necesita los grants de R-3 (*_ADOPTION, *_TAG, *_ATTENTION_POINT): ver PEDIDOS_BACKEND.md.
# 2. Front: dev server con environment.local.ts + proxy.local.cjs (/api -> localhost:8080)
cd backoffice && npm run start:local
# 3. E2E
E2E_TARGET=local py -3.12 e2e/final_script.py          # bash
$env:E2E_TARGET='local'; py -3.12 e2e/final_script.py  # PowerShell
```
Con `E2E_TARGET=local`, Etiquetas, Plantillas, Adopciones, Fichas y Puntos de atención van contra la **API real**
(CP13–CP19). Con `staging` esas pantallas son mock y se prueban con los flujos viejos (CP10/CP11).

Cada corrida crea `e2e/final_runs/run_<n>/` con una copia del script, `screenshots/` y `final_script_log.txt`. Cada CP
deja en el log una línea `RESULT CPx: OK|FALLA|no cubierto`, y al final se escribe `FINAL_RESPONSE`. Si el dev server
no responde, el script corta sin hacer nada.

Al final del log hay además:
- `== Requests clave ==`: cada request no-GET (y toda respuesta >= 400) a `/api/`, con método, ruta, status y `code`.
- `== HALLAZGOS DE BACKEND ==`: respuestas inesperadas del backend (5xx, 4xx sin `code`, campos faltantes en el
  contrato) con método, ruta, status y body resumido. **No** son fallas del front: son el insumo para el pedido a
  backend (`PEDIDOS_BACKEND.md`).
- `== HALLAZGOS DE FRONT ==`: comportamientos del front a revisar, con el archivo sospechoso.

### Variables de entorno
| Variable | Default | Efecto |
|---|---|---|
| `E2E_PASSWORD`, `E2E_SA_EMAIL`, `E2E_AB_EMAIL`, `E2E_AO_EMAIL` | **requeridas** | Credenciales de los usuarios de prueba (SA, AB, AO). |
| `E2E_TARGET` | `staging` | `staging` o `local`. Elige qué CPs de Trámites/Etiquetas corren (mock vs API real). |
| `E2E_BASE_URL` | `http://localhost:4200` | URL del dev server. |
| `E2E_AGENT_EMAIL` | sin definir | Si se define (misma contraseña), también se verifica el gating del rol AGENT (CP20). Sin él, CP20 queda "no cubierto". |
| `E2E_SEED_SQL` | `1` (solo local) | Si el alta real de adopción falla (hoy `POST /api/organism-procedure` da 500), siembra UNA adopción por `docker exec … psql` en la base local descartable para poder seguir con fichas y puntos. `0` lo desactiva. Nunca se usa contra staging. |
| `E2E_PG_CONTAINER`, `E2E_PG_USER`, `E2E_PG_DB` | `portal-tramite-postgres-1`, `portal`, `portal_tramite` | Contenedor y base para la siembra anterior. |
| `E2E_ALTA_USUARIO=1` | apagada | Activa CP7b, el alta real de usuario. Está apagada porque en staging `DELETE /api/user/{id}/admin` responde 500 y no se puede limpiar (B-1). |

## Qué cubre (detalle y evidencia en `plan.md`)
- Login: contraseña inválida con error inline, y `GET /api/auth/me` con `Bearer`.
- Expectativas de gating calculadas desde `GET /api/auth/me` de cada usuario (permisos efectivos, con el
  prerrequisito de `CREATE_USER`), no desde supuestos.
- Humo de todos los ítems del menú del SA (y del AB/AO), sin errores de consola ni diálogo global.
- Breadcrumb (CP3) y breadcrumb por rol: solo linkea secciones visibles para el usuario (CP3-roles).
- ABM real con SA de Categorías, Modalidades, Destinatarios, Eventos de vida (borrado físico verificado por API) y de
  Organismos/Tipos de organismo sobre registros fijos (ver "Política de datos").
- Error de borrado inline (DELETE bloqueado con `page.route`) y aviso de cambios sin guardar.
- Usuarios (fuente real): las acciones de cuenta retiradas (Cambiar email/contraseña, Activar/Desactivar cuenta,
  Eliminar definitivamente) **no** se ofrecen; "Editar" sigue.
- Roles y Permisos: SA contra AB.
- Gating de menú, acciones y URL para AB y AO según `/me`.
- Solo local, contra la API real:
  - CP13 Etiquetas (SA): global con slug canonicalizado, global duplicada (4072 en el campo), local con organismo,
    editar, borrar (DELETE real → GET 404).
  - CP14 Etiquetas por rol: AB/AO ven la lista; "Nueva etiqueta" según `CREATE_TAG` y (`READ_ORGANISM` o rol SA/AB);
    sin `READ_ORGANISM` no se pide `/api/organism` ni aparece el diálogo global.
  - CP15 Plantillas: alta (slug, categoría principal dentro de categorías, etiqueta) → detalle; slug duplicado
    (4072 en el campo); edición; desactivación (`DELETE_PROCEDURE`).
  - CP16 Adopciones: alta con vigencia, solapamiento (4080 en el diálogo), detalle, edición de vigencia,
    "Organismos que la adoptaron" en la plantilla, deshabilitar.
  - CP17 Fichas: "Agregar localidad" desde la adopción (BORRADOR), workflow real `submit-review` / `publish` /
    `unpublish`, edición bloqueada por G-1, desactivar.
  - CP18 Puntos de atención: coordenadas inválidas rechazadas en cliente, alta, edición, desactivación.
  - CP19 Estado vacío con filtros activos: el CTA es "Limpiar filtros".
- Solo staging: Trámites y Etiquetas mock (CP10/CP11), con permisos inyectados donde staging no los otorga.
- Redirección de la ruta vieja `/dashboard/tramites/lista`.

## Qué no cubre
- El alta real de usuarios (CP7b, ver arriba).
- AGENT (CP20) si no hay credenciales: no se inventan.
- El toggle "Activa" bloqueado de una ficha publicada: con G-1 abierto el formulario de edición de fichas reales está
  bloqueado por diseño, así que no se llega al toggle.
- Guardar roles o permisos existentes.

## Política de datos
### Staging (entorno compartido)
- Solo se tocan datos propios con prefijo `E2E-`. Nunca se editan ni borran datos ajenos.
- **Recursos con borrado físico** (Categorías, Modalidades, Destinatarios, Eventos de vida): cada corrida crea
  registros `E2E-<timestamp> …` y los borra por la UI. Después se confirma con `GET /api/<recurso>/{id}` → 404 que
  desaparecieron. Si algo falla a mitad, el bloque final de limpieza los borra por API.
- **Recursos con baja lógica** (Organismos y Tipos de organismo: `DELETE` solo pone `active:false`): el script **no
  crea registros nuevos**. Reutiliza dos registros fijos `E2E-fijo Organismo r<ts>` (sigla `E2EFIJO`) y
  `E2E-fijo Tipo r<ts>`: los reactiva y edita desde la lista, y los vuelve a eliminar. Si no existen, adopta el
  residuo `E2E-*` inactivo más reciente; solo si no hay ninguno se crean, una única vez.
- **Resumen de residuos**: al principio y al final se cuentan los registros `E2E` activos e inactivos por recurso. Al
  final del log aparece la tabla "antes -> después" y la línea `RESIDUOS: … -> no creció | CRECIÓ`.
- Residuos históricos de staging que no se pueden purgar desde la API: ver `plan.md` (corridas `run_1`–`run_5`).

### Local (base descartable)
- Mismo prefijo `E2E-<ts>` y misma política de registros fijos para Organismos y Tipos.
- **Categoría fija** `E2E-fijo Cat plantilla`: las plantillas la usan como categoría principal. Se reutiliza porque
  una categoría referenciada por una plantilla no se puede borrar (el backend responde 500 por la FK).
- Al final se limpia por API todo lo creado en la corrida: etiquetas (borrado físico), y plantilla, adopción, ficha y
  punto de atención (solo baja lógica: la API no tiene borrado físico, quedan inactivos en la base).
