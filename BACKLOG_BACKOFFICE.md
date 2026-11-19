# Backlog — Backoffice

Relevado el 2026-09-30 sobre `feat/abm-secciones` (`6ba7a7c`), contra `BACKEND_API_SPEC.md` y el
backend `PortalMisiones-backend@d800be0`. Estado base: `check:circular` 0 ciclos, `lint` OK, `ng build` OK
(con warnings de budget).

Cierre 2026-09-30: `tsc`, `lint`, `check:circular` (0 ciclos / 265 archivos) y `ng build` sin warnings
(inicial 854 KB). Sin commitear.

**Actualización 2026-11-03:** relevado contra el backend `origin/dev` @ `b6f505b` y la API de staging. Resueltos en
backend: R-3 (BO-21), G-14, R-1 y `GET /api/user` (BO-17, con `role: null`: G-13). Detalle por pedido en
`PEDIDOS_BACKEND.md` (auditoría 2026-11-03). Staging tiene el backend de `dev` solo hasta el 2026-10-17.

**Actualización 2026-11-16:** relevado contra el backend `origin/dev` @ `58d383a` (migraciones hasta `V2.30`; lectura
de código, sin levantar el backend). Resueltos en backend desde el relevamiento anterior: **G-15** (adopciones 500) y
el ajuste de R-3 para AGENT (`V2.30`). **Staging no cambió** (sigue en el merge del 2026-10-17): lo que estaba "en mock
hasta R-3" o "hasta G-15" pasa a estar **en mock hasta OPS-1** (deploy de `dev` a staging). Pedidos nuevos al backend:
G-20 a G-25 (roles y usuarios), que condicionan BO-24. Detalle en `PEDIDOS_BACKEND.md` (auditoría 2026-11-16).

**Actualización 2026-11-19:** relevado contra el backend `origin/dev` @ `586b670` (13 commits sobre `58d383a`,
migraciones hasta `V2.31`; lectura de código, sin levantar el backend). OPS-1 se cumplió el 2026-11-16 por la tarde
para `58d383a` (Etiquetas, Plantillas y Adopciones reales en staging y prod), quedó reabierto al relevar (staging seguía
en `58d383a`) y **se cumplió de nuevo el mismo 2026-11-19** (ver la nota de abajo). Resueltos en `dev` y **en staging
desde el 2026-11-19**: **G-1** (response de la ficha), **G-2 / BO-20** (organismo en `/me`),
G-6, G-10 y G-22; parciales: G-3 (`READ_PROCEDURE` para AO), G-7, G-9, G-12. Deja de estar bloqueado por contrato:
fichas y puntos de atención en real (BO-15, BO-19), organismo en sesión (BO-20) y "Adoptar" para AO. Todo eso quedó
**desbloqueado con el deploy de `586b670` a staging**. Contrato nuevo: ADMIN_BACKOFFICE no puede tocar cuentas SA/AB
(PPDT-5.1, BO-26). Pedidos nuevos al backend: G-26 a G-29, y G-30 a G-32 surgidos de la implementación (motivos del `4029` de
usuarios solo por texto, `change-password` sin validar alcance, zona horaria de la vigencia), más ampliaciones de G-2,
G-8, G-9 y G-27. Detalle en `PEDIDOS_BACKEND.md` (auditoría 2026-11-19).

**Deploy a staging, 2026-11-19 (mismo día):** el backend desplegó `dev` en staging. `origin/staging` = `0a555df`
("Merge branch 'dev' into 'staging'", contiene `586b670`) y `/api-docs` de staging ya publica el contrato nuevo
(`AuthMeResponseDTO` con `scope`, `organismId`, `organismName`, `organismAcronym`; `OrganismProcedureLocationResponseDTO`
con `organismProcedureId`, `locationId`, `url`, `requirements`, `costs`). **OPS-1 cumplido de nuevo.** Solo se verificó
el esquema publicado; todavía no se ejecutó ningún flujo contra staging. El front de `feat/alinear-backend-586b670`
requiere backend >= `586b670` y ya se puede desplegar. Los pedidos abiertos no cambian.

Leyenda: `[ ]` pendiente · `[~]` en curso · `[x]` hecho · `[-]` descartado (con motivo)

## Implementable ahora

### BO-1 · Error de acrónimo duplicado en el campo del form de Organismo — Bug · Alta
- [x] 409 `4069` en create/update marca el control `acronym` (clave `server` en `form-error-messages.util`).
- [x] El resto de los errores sigue en el `serverError` del form.
- Alcance: `organismo-form` (alta) y `organismo-detail` (modo editar), vía `pages/organismos/organismo-save-error.ts`.

### BO-2 · Desactivar cuenta vs. baja lógica de Usuarios — Bug · Alta
- [x] Verificado: el toggle usa `status-account` y está gateado por `UPDATE_USER`, que es lo que exige el backend.
- Hallazgo backend: `PUT /api/user/{id}` (baja lógica, `DELETE_USER`) ejecuta `editStatusUser(false)` =
  lo mismo que `status-account=false`. **No hace falta una segunda acción.** Sin cambios de código.

### BO-3 · Cambio de contraseña, cambio de email y borrado definitivo de usuarios — Historia · Media
- [x] Datasource/repository/facade: `changePassword`, `changeEmail`, `deleteDefinitive` (mock + DELETE en el mock interceptor).
- [x] UI: acciones en el menú de la fila, gateadas por `UPDATE_USER` / `DELETE_USER`. Diálogo propio
  (`pages/usuarios/credencial-dialog`) que valida la política real de contraseña (8–20, mayúscula, minúscula, número).
- [x] "Cambiar contraseña" no se ofrece a SUPERADMIN/ADMIN_BACKOFFICE (el backend responde 403 `4029`).
- [x] Borrado definitivo con `confirmAction` `danger`; el error se muestra dentro del modal.
- ⚠️ Las tres operaciones van al **mock** en el datasource híbrido, igual que `toggleActive`: mientras el listado
  sea mock, los ids de las filas no existen en el backend. Pasan a HTTP real cuando exista `GET /api/user`.

### BO-4 · Dashboard, Auditoría y Feedback a arquitectura de capas — Deuda técnica · Media
- [x] Feature `dashboard` (mock). Los datos estaban hardcodeados en el componente; ahora viven en el datasource.
- [x] Feature `auditoria` (mock) + lista y diálogo de detalle. Estado de error con "Reintentar".
- [x] Feature `feedback` (mock). Estado de error con "Reintentar".
- [x] Borrados `dashboard.service` y `auditoria.service`. `feedback.service` queda: lo usa el mock de trámites.
- [x] `check:circular` y `lint` en verde.

### BO-5 · Modelo de Etiquetas alineado a `Tag` del backend — Deuda técnica · Media
- [x] VM/mock/form: `slug`, `organismo` (opcional ⇒ global/local), `id` UUID. Fuera `nombre`/`icono`/`color`/`activo`.
- [x] Mock en memoria que valida unicidad como el backend (`4072`) y canonicaliza el slug (`core/utils/slug.utils.ts`,
  reusado también por el mock de eventos de vida).
- [x] Lista con chips Todas/Globales/Locales; form con select de organismo (degrada a solo-global sin `READ_ORGANISM`);
  `4072` marcado en el campo `slug`. Borrado `etiqueta.service`.
- `4072`/`4073` quedaron en `API_CODES` como `TAXONOMY_CONFLICT`/`TAXONOMY_NOT_FOUND` (genéricos de taxonomía).

### BO-6 · Sesión desde `GET /api/auth/me` — Mejora · Baja
- [x] `/api/auth/me` después de login, activate-account y refresh; roles/permisos de la sesión salen de ahí.
- [x] Si `/me` falla, cae al decode del JWT (no bloquea el login).
- ⚠️ No probado contra el backend real (no estaba levantado en esta sesión).

### BO-7 · Excepción de política de usuarios (rol SUPERADMIN) — Tarea · Baja
- [x] `PERMISSION_POLICY_ROLES` (todo a SUPERADMIN) reemplazado por `PERMISSION_PREREQUISITES`: `CREATE_USER` exige
  además `READ_ORGANISM` + rol SA/AB/AO (lo que el form necesita leer).
- [x] `EDITAR_USUARIO_ACCESS` aplica lo mismo solo a la ruta de edición y a "Editar". Email, contraseña,
  activar/desactivar y borrar quedan con el permiso exacto del backend.
- [x] `RowAction.rule` + `AuthTokenService.canAccess(rule)` para reglas de más de un permiso.

### BO-8 · Budgets del build — Deuda técnica · Baja
- [x] Sacado `provideCharts(withDefaultRegisterables())` del `app.config`: ningún componente usa gráficos y
  metía Chart.js completo en el bundle inicial. `main` 222 KB → 45 KB; inicial 1019 KB → 853 KB.
- [x] Budgets ajustados al piso real: inicial 900 KB warning / 1.2 MB error (Angular + Material + CSS global de
  Phosphor ≈ 850 KB); estilos por componente 16 KB / 24 KB (el mayor, `admin-layout`, pesa 14.7 KB).
- Pendiente opcional: quitar `ng2-charts` y `chart.js` de `package.json` si no se van a usar.

### BO-9 · Docs de migración e integración al día — Tarea · Baja
- [x] `migracion_arquitectura.md` §6 (fases), §12 (estado por feature, deuda) y §13 (prerrequisitos).
- [x] `BACKEND_API_SPEC.md` §8: tildados los ítems resueltos, con nota de cómo se resolvieron.

### BO-11 · Errores mostrados dos veces (diálogo global + inline) — Bug · Media *(hallado durante BO-1)*
- [x] Las mutaciones (create/update/delete) de los 8 datasources HTTP van con `sinDialogoGlobal()`: su error ya lo
  cuenta el form (banner) o el modal de confirmación.
- [x] `ConfirmDialog` muestra el error de `confirmAction` adentro y queda abierto para reintentar (antes cerraba y
  dependía del diálogo global).
- [x] Revisión (`angular-ssr-reviewer`): `eliminarLocalidad` del form de trámites además abría un snackbar de error →
  se quitó; lo muestra el modal.

### BO-12 · Código muerto — Tarea · Baja *(hallado durante BO-9)*
- [x] Borrados `shared/components/tramite-preview` (sin uso, inyectaba `TramiteService` directo) y `modalidad.service`.

## Bloqueado por backend (seguimiento)

| Funcionalidad | Falta en backend | Estado front |
|---|---|---|
| Plantillas provinciales (`/api/procedure-template`) | ✅ expuesta (PPDT-5.4), en staging desde el 2026-11-16. En `586b670` (en staging desde el 2026-11-19): `slugBase` canónico, `4072` → 409, `READ_PROCEDURE` para AO | **real** en `start:local`, staging y prod; mock en `ng serve` (la cadena de trámites va con una sola fuente) |
| Trámites del organismo / adopciones (`/api/organism-procedure`) | ✅ expuesta (PPDT-5.5); R-3 y G-15 en staging. **G-2** ✅ y `V2.31` ✅ en `586b670` (en staging desde el 2026-11-19): AO ya puede adoptar | **real** en `start:local`, staging y prod; "Adoptar" con `READ_ORGANISM` o con organismo en la sesión. Para AO, **desbloqueado** (backend >= `586b670`, en staging desde el 2026-11-19; sin verificar en ejecución) |
| Fichas por localidad (`/api/organism-procedure-location`) | **G-1 ✅ en `586b670`** (`3797fe7`, en staging desde el 2026-11-19): response completo, filtro por adopción y 400 `4012`. Siguen: G-4 (rechazar / volver a borrador), G-27 (adopción no vigente → 404), G-9 | **real** en `start:local`, staging y prod (rama `feat/alinear-backend-586b670`). **Desbloqueado**: requiere backend >= `586b670`, en staging desde el 2026-11-19 (contra uno anterior la ficha llega sin contenido y el front no deja editarla) |
| Puntos de atención (`/api/attention-point`) | ✅ expuesta (PPDT-5.7), en staging. Filtro por ficha ✅ en `586b670` (`0db49a9`, en staging desde el 2026-11-19), solo activos (G-29). AB tiene los permisos pero no `READ_VARIANT` (G-5) | **real** junto con fichas. **Desbloqueado** (backend >= `586b670`, en staging desde el 2026-11-19) |
| Etiquetas | ✅ `TagController` expuesto (`84fde37`); grants R-3 en staging desde el 2026-11-16. Etiquetas locales para AO/AGENT: G-2 ✅ en `586b670` (en staging desde el 2026-11-19) | **real** en todos los entornos |
| Listado de usuarios | ✅ `GET /api/user` (`4715be1`, también en staging), pero cada usuario llega sin rol, organismo ni nombre (**G-13**); no se puede cambiar el rol de un usuario existente (**G-20**); desde `586b670` AB recibe 403 `4029` sobre cuentas SA/AB y el listado no las distingue (**G-26**) | **real** (BO-22): listado y acciones de cuenta; edición y borrado definitivo no disponibles |
| Feedback | moderación (Taiga **PPDT-5.15**; la tabla `procedure_feedbacks` ya existe) | mock en capas (BO-4) |
| Auditoría | auditoría de cambios sensibles (Taiga **PPDT-5.21**; la tabla `audit_events` ya existe) | mock en capas (BO-4) |
| Dashboard | API de métricas (Taiga **PPDT-5.13**, rol `MANAGER`) | mock en capas (BO-4) |
| Ficha de organismo | jurisdicción, CUIT, domicilio, contacto, SIGAF, responsables, actividad | placeholders "pendiente" |
| Adjuntos | upload de archivos | `storage.service` sin consumidor |
| reCAPTCHA | claves reales | solo mock |

Relevado contra `PortalMisiones-backend` `origin/dev` @ `586b670` (2026-11-19; anteriores: `58d383a`, 2026-11-16, y
`b6f505b`, 2026-11-03). Novedades de contrato de `586b670` (`BACKEND_API_SPEC.md` §7.0.4; **en staging desde el 2026-11-19**): response
completo de la ficha y filtro `?organismProcedureId=`, `scope` y organismo en `/api/auth/me`, filtro
`?organismProcedureLocationId=` en puntos de atención, `4072` como 409, `slugBase` canonicalizado en el servidor,
vigencia de la adopción en fichas y en el portal, `V2.31` (`READ_PROCEDURE` para AO), AB asigna roles
`assignableByBackoffice` y no puede modificar cuentas SA/AB (403 `4029`).
Novedades de contrato de `58d383a`: asignar rol a un usuario existente (`POST /api/user/{id}/role-assignments`, con vigencia; `4081`
si se superpone — hoy siempre, ver G-20), regla "un usuario = un único rol vigente" (`V2.26`), `GET /api/tag/public`,
búsqueda pública sin 500 (`V2.29`), códigos `4077` (transición inválida) y `4091` (edición concurrente), y `V2.30`
(AGENT sin `CREATE_ADOPTION` ni `DELETE_ADOPTION`). Contrato en `BACKEND_API_SPEC.md` §7.0.3.
Relevamiento anterior: `2e41090` (2026-10-06), en `BACKEND_API_SPEC.md` §7.0.

## Próximo: impactos anunciados por el backlog del backend (Taiga)

### BO-13 · Roles y Permisos: escritura solo SUPERADMIN (PPDT-5.1, salió en `0ea13a0`) · Alta
- [x] `LEER_ROLES_PERMISOS_ACCESS` (SA/AB) y `ESCRIBIR_ROLES_PERMISOS_ACCESS` (SA) en `policy-overrides.constants.ts`.
- [x] Listas visibles para SA/AB; rutas nuevo/editar, botón "Nuevo", CTA del vacío, acciones de fila y buscador de
  comandos solo para SA. `*appHasPermission` ahora acepta una `AccessRule` completa.
- [x] Quitada la lógica de "fila SUPERADMIN bloqueada para AB" (`puedeModificar`/`motivoBloqueo`): AB ya no edita ningún rol.

### BO-18 · Flag `assignableByBackoffice` en roles (V2.16) · Alta *(hallado al revisar `0ea13a0`)*
- [x] DTO, VM, mapper, mock (mismos defaults que la migración) y toggle "Asignable por Administrador de Backoffice" en el
  form de rol. Se manda siempre en el PUT: si faltara, el backend lo resetea a `false` sin avisar.
- [x] El detalle de la lista de roles muestra "asignable por Admin de Backoffice".

### BO-14 · Aislamiento por organismo — cuando salga PPDT-5.2 · Alta
- Backend: PPDT-5.2 entró a `dev` el 2026-10-16 (`4715be1`) para el listado de usuarios (AO ve solo los de su organismo).
  Revisar si cubre el resto de los recursos antes de cerrar.
- [ ] ADMIN_ORGANIZATION y AGENT van a ver solo datos de su organismo. Revisar listas y selects de organismo
  (usuarios, etiquetas locales, trámites) para no ofrecer opciones que el backend va a rechazar.
- 2026-11-19: el alcance ya llega en `/api/auth/me` (`scope`, `organismId`; G-2 ✅ en `586b670`, en staging desde el 2026-11-19), que es
  el dato que faltaba para hacer esta revisión del lado del front.

### BO-15 · Trámites contra la API real (PPDT-5.4/5.5/5.6) · Alta — ✅ hecho en front (2026-10-13); desbloqueado: backend `586b670` en staging desde el 2026-11-19
Plan y decisiones en `PLAN_TRAMITES_API.md` (§5 fases, §8 decisiones, §9 estado). Pedidos al backend en `PEDIDOS_BACKEND.md`.
- [x] **Fase 0+1 · Plantillas provinciales** (`c194f43`): feature `plantillas` contra `/api/procedure-template` (**real**),
  lista/form/detalle, permisos `*_PROCEDURE`, nav "Trámites", comando "Crear plantilla".
- [x] **Fase 2 · Trámites del organismo** (`4d8f34c`): feature `adopciones` (`/api/organism-procedure`), lista, detalle con
  vigencia, diálogo "Adoptar" (datepicker es-AR). **Real** en staging y prod desde OPS-1 (2026-11-16). "Adoptar" pide
  `READ_ORGANISM` o un organismo en la sesión (P-2; G-2 ✅ en `586b670`).
- [x] **Fase 3+4 · Fichas por localidad + workflow** (`bbb3b52`): feature `fichas-locales` (lista con tab "En revisión",
  form, detalle, badge `BORRADOR → EN_REVISION → PUBLICADO ↔ DESPUBLICADO` por `PUBLISH_VARIANT`). **Real** en staging y
  prod en la rama `feat/alinear-backend-586b670` (G-1 ✅ en `586b670`); requiere backend >= `586b670` (en staging desde
  el 2026-11-19).
- [x] **Fase 5 · Limpieza** (sin commitear): retirado el Trámites viejo (feature `tramites`, pantallas `list/create/detail`,
  `tramite.service`, `tramite.model`, rutas del mock por interceptor, config `TRAMITE` + `icon-picker`, servicios legacy
  huérfanos). Las rutas viejas `tramites`, `tramites/lista|nuevo|editar/:id|detalle/:id` redirigen a
  `tramites/plantillas`. Bundle inicial 897 → 837 KB (sin warnings).
- ✅ **Ya no bloquea el contrato (2026-11-19, `586b670`):** ~~G-1~~ (fichas y puntos en real), ~~G-2~~ (AO adopta) y
  la parte de AO de ~~G-3~~ (`READ_PROCEDURE`, `V2.31`).
- ✅ **OPS-1 cumplido de nuevo el 2026-11-19** (`origin/staging` @ `0a555df`, contiene `586b670`): lo anterior ya está
  online. Verificado solo el esquema de `/api-docs`; falta ejecutar los flujos contra staging.
- **Bloqueado por backend:** **G-3** (AGENT no ve el trámite de la ficha; AB no elige organismo),
  **G-4** (rechazar / volver a borrador), **G-27** (fichas de adopciones no vigentes) y **G-29** (inactivos en el panel
  de puntos).

### BO-16 · Etiquetas contra la API real (PPDT-5.8, salió en `84fde37`) · Media
- [x] `EtiquetasHttpDataSource` (`/api/tag`) + DTO + mapper; quitado el override `etiquetas: 'mock'` (dev y prod).
- [x] Permisos `*_TAG` (nuevos) en lugar de `*_TAXONOMY`: nav y lista con `READ_TAG`, rutas, botón, CTA, acciones y comando.
- [x] Fuera la columna "Trámites" y el conteo del modal de borrado: el backend no expone cuántos trámites usan una etiqueta.
- [x] `4073` (fuera de alcance) se marca en el campo Organismo; `4072` sigue en el campo Slug.
- ✅ **Gap de BO-20 desbloqueado** (G-2, `586b670`; en staging desde el 2026-11-19): AO/AGENT solo pueden crear etiquetas
  locales de su organismo, y la sesión ahora lo trae (`/api/auth/me`). Contra un backend anterior la sesión sigue
  sin organismo y a esos roles no se les ofrece "Crear".

### BO-21 · Permisos `*_TAG` / `*_ADOPTION` / `*_ATTENTION_POINT` sin asignar (R-3) · ✅ resuelto (`V2.28` + `V2.30`), en staging desde el 2026-11-16
- Verificado online el 2026-11-16 con SUPERADMIN: `/me` trae `*_TAG`, `*_ADOPTION` y `*_ATTENTION_POINT`, y los cuatro
  listados de trámites responden 200 (`PEDIDOS_BACKEND.md`, OPS-1).
- [x] Causa confirmada: `V2.20`, `V2.23` y `V2.24` asignaban con `WHERE roles.code IN ('ROLE_SUPERADMIN', …)`, pero `V0.4`
  quitó el prefijo `ROLE_` a los códigos de rol. Ningún rol recibía esos permisos.
- [x] Migración correctiva del backend: `V2.28` otorga los 12 permisos a SA, AB, AO y AGENT; **`V2.30` le quita a AGENT
  `CREATE_ADOPTION` y `DELETE_ADOPTION`** (se queda con `READ_ADOPTION` y `UPDATE_ADOPTION`).
- [ ] Verificar con el e2e local por rol que el menú y las acciones coinciden con la matriz (`BACKEND_API_SPEC.md` §4.2).
- **Nota AGENT:** con la matriz nueva, AGENT ve "Trámites del organismo" y puede editar la vigencia, pero no "Adoptar" ni
  "Deshabilitar" (el front ya gatea por `CREATE_ADOPTION` / `DELETE_ADOPTION`, sin cambios de código). El bloque de
  edición incluye el interruptor "Habilitado" porque el `PUT` lo acepta: un AGENT puede deshabilitar por ahí, y también
  despublicar una ficha desactivándola (`DELETE` con `UPDATE_VARIANT`). Reportado como **G-24**; el front no agrega reglas
  por rol.
- 2026-11-19: `V2.31` suma `READ_PROCEDURE` a ADMIN_ORGANIZATION (en staging desde el 2026-11-19, con el deploy de
  `586b670`; falta confirmarlo con el AO de prueba). Ya no hace falta que SA lo asigne a mano desde la pantalla de Roles.

### BO-19 · Puntos de atención (PPDT-5.7, salió en `7b5afda`) · Media — ✅ hecho en front (`bbb3b52`, fase 4); real junto con fichas
- [x] Feature `puntos-atencion` (`/api/attention-point`) + panel hijo en el detalle de la ficha (alta/edición en diálogo,
  lat/long manuales con validación y link "Ver en mapa", P-8). Permisos `*_ATTENTION_POINT`.
- ✅ Desbloqueado (2026-11-19): G-1 resuelto en `586b670`; pasa a **real** en staging y prod junto con fichas. Usa el
  filtro `?organismProcedureLocationId=` (`0db49a9`).
- OPS-1 cumplido de nuevo el 2026-11-19 (backend `586b670` en staging). Bloqueado por backend: **G-29**: con el filtro el backend devuelve solo
  los activos, así que "Mostrar inactivos" no trae nada contra el backend real.

### BO-20 · Organismo del usuario en sesión para roles con alcance (AO/AGENT) · Media — ✅ hecho en front (rama `feat/alinear-backend-586b670`); backend G-2 (`d7aca1c`) en staging desde el 2026-11-19
- [x] Backend: `/api/auth/me` devuelve `scope` (`global` | `organismo`), `organismId`, `organismName` y
  `organismAcronym` (`BACKEND_API_SPEC.md` §2). No hizo falta la alternativa de `GET /api/user/{id}`.
- [x] Front: usar el organismo de la sesión para preseleccionarlo (etiquetas locales, adopciones, alta de usuarios de
  AO). Hecho en `feat/alinear-backend-586b670` (sin commitear): la sesión lo lee (`auth.service.ts`,
  `core/utils/session.utils.ts`) y los formularios de "Adoptar", "Nueva etiqueta" y usuarios lo fijan como único
  organismo (`AdopcionesFacade`, `EtiquetasFacade`, `UsuariosFacade`); el gating lo acepta como alternativa a
  `READ_ORGANISM` (`ORGANISMO_ELEGIBLE`).
- [ ] Verificar con AO y AGENT contra staging (backend `586b670` desde el 2026-11-19; hasta ahora solo se verificó el
  esquema de `/api-docs`).
- Contra un backend anterior a `586b670` `/me` no trae esos campos: la sesión queda sin organismo y todo sigue como antes.
- Contexto original: `/api/auth/me` no traía el organismo; las opciones eran pedirlo en `/me` o leerlo de
  `GET /api/user/{id}` (requiere `READ_USER`, que AGENT no tiene).

### BO-17 · Pedir `GET /api/user` al backend · ✅ entregado (`4715be1`, en staging) — sigue en BO-22
- [x] Endpoint disponible con `READ_USER`. Pendiente del backend: que traiga `role`/organismo (G-13).
- Contexto original: no tenía tarjeta en Taiga. Desde `0ea13a0` el servicio ya existe (`UserService.findAllUserDTO()`, filtrado por organismo
  para AO): solo falta exponerlo en `UserController`. Sin ese endpoint, el listado de usuarios y las acciones de fila (BO-3) siguen en mock.


### BO-22 · Listado de usuarios contra `GET /api/user` · Alta — ✅ hecho (2026-11-10), verificado contra staging
- [x] `UsuariosHttpDataSource` real: `list`, `getById`, activar/desactivar (`status-account` con el estado explícito que
  confirmó el admin, nunca un toggle), cambiar email y contraseña. Ya no depende del mock. Se quitó `toggleActive`.
- [x] Edición por URL directa (`/usuarios/editar/:id`) con la fuente real: el form muestra "Edición no disponible" y vuelve
  a la lista, en vez de dejar completar algo que iba a fallar al guardar.
- [x] Capacidades de la fuente: `soportaAccionesDeCuenta` / `soportaEdicion` / `soportaBorradoDefinitivo`. Con la fuente
  real, "Editar" queda visible pero no disponible (motivo en tooltip; no hay endpoint de edición) y "Eliminar
  definitivamente" no se ofrece (G-13). La acción principal de `row-actions` ahora soporta `disabledReason`.
- [x] `UsuarioVM.rol` admite `null`: la columna muestra "Sin dato" en vez de inventar "Agente" (G-13). Sin nombre, la
  fila muestra el email una sola vez.
- [x] Staging: 4 usuarios reales, menú con Cambiar email / Cambiar contraseña / Desactivar cuenta, sin errores de consola.
- Sigue el override `usuarios: 'local'` (equivale al default HTTP); pendiente de backend: rol, nombre y organismo (G-13).

### BO-23 · Mensajes para los códigos nuevos del backend · Media — ✅ hecho (2026-11-10), salvo `4081`
- [x] `API_CODES`: `PUBLICATION_TRANSITION_INVALID` (4077), `ROLE_ASSIGNMENT_OVERLAP` (4081), `CONCURRENT_MODIFICATION` (4091).
- [x] `4077` en las acciones del workflow de fichas (`mensajeErrorAccion`); `4091` en el guardado y en las acciones.
- [x] Mock de fichas alineado con `dev`: el PUT conserva el estado (R-1), transición inválida → `4077`, inexistente → `4073`.
- [ ] `4081`: sin pantalla todavía; se usa con BO-24.

### BO-25 · Formularios a `app-dynamic-form` · Media — ✅ hecho (2026-11-10), sin commitear
- [x] Dynamic form: `hint` en todos los tipos con `mat-form-field`, `@Output() valueChanges` (solo si cambia el valor),
  tipo `custom` + `<ng-content>`, `form-actions` compartido y `resumenDeErrores` en `form-error-messages.util.ts`.
- [x] Migrados: Permiso (entero), Usuario (entero; el organismo se pide según el `scopeType` del rol y viaja como
  `organizationId` en el POST: corregía un bug que dejaba crear AO/AGENT sin organismo) y Rol (la grilla de permisos queda
  custom dentro del form). Plantilla y Ficha usan `form-actions` y el resumen compartido; los diálogos quedan a mano.
- [x] Bug previo corregido: `FormErrorMessageDirective` colgaba la pestaña al corregir un campo tras un envío inválido
  (afectaba a todos los ABM con dynamic form).
- [x] Helper `core/utils/one-shot.utils.ts` (`unaVez`) para llamadas one-shot; `snackbar-warning` con contraste AA.
- Verificado: 133 tests, lint, circular, tsc/ngc, build; e2e contra staging 15/15 (`e2e/final_runs/forms_run_*`);
  3 rondas de `angular-ssr-reviewer` hasta OK.
- Residuo en staging: 4 usuarios `e2e.qa.*` inactivos que no se pueden borrar (G-13).

### BO-24 · Asignar rol a un usuario existente · Baja — opcional
- [ ] Acción en el detalle del usuario contra `POST /api/user/{id}/role-assignments` (rol, organismo, vigencia desde/hasta).
  Depende de G-13 para mostrar el rol actual.
- ⚠️ **Limitación del backend (`dev` @ `58d383a`), relevada el 2026-11-16:**
  - **No sirve para cambiar el rol (G-20).** Todo usuario creado por API tiene una asignación abierta y no hay endpoint
    para cerrarla: el pedido responde **409 `4081`** en cualquier caso real. Solo funcionaría sobre un usuario sin
    asignación vigente. Backend lo tiene en Taiga (refs 42 y 43).
  - **Quién puede usarlo.** SUPERADMIN, y desde `586b670` (G-22 ✅, en staging desde el 2026-11-19) ADMIN_BACKOFFICE para los roles
    `assignableByBackoffice`; en `58d383a` AB recibe siempre 403 `4029`. Ningún rol es asignable por ADMIN_ORGANIZATION
    en el seed (G-23). El cambio de G-22 no destraba la acción: sigue el 409 `4081` de G-20.
  - Sin `effectiveTo`, el backend usa `LocalDate.MAX` en la consulta de solapamiento (G-21, sin confirmar en ejecución).
  - Los mensajes de `4018` (rol inexistente) y `4002` (usuario inactivo) no corresponden al error (G-25): usar texto propio.
  - El endpoint está en staging desde el 2026-11-16; la regla de AB (G-22), desde el 2026-11-19.

### BO-26 · Cuentas privilegiadas: acciones de cuenta de ADMIN_BACKOFFICE (PPDT-5.1, `a69925e`) · Media *(nuevo, 2026-11-19)*
- Contrato (`dev` @ `586b670`, en staging desde el 2026-11-19): si el actor es AB y el usuario destino es SA o AB, la baja lógica, la
  baja definitiva, el cambio de email y el cambio de estado responden 403 `4029` (`BACKEND_API_SPEC.md` §3.2).
- [x] Texto propio para ese `4029` en las acciones de la fila (no mostrar el `message` ni el `details` del backend, que
  habla de "crear usuarios"). Hecho en `feat/alinear-backend-586b670` (sin commitear):
  `pages/usuarios/usuario-accion-error.ts`, usado por el listado y por el diálogo de email / contraseña; el alta
  distingue los motivos del `4029` en `usuario-save-error.ts` (G-30).
- ⚠️ **Bloqueado por backend (G-26 / G-13):** `GET /api/user` no trae el rol, así que no se puede ocultar ni marcar como
  no disponible la acción en las filas SA/AB; AB la ve y falla al confirmar.

---

## Roadmap (actualizado 2026-11-19; base: e2e final contra `dev` local del 2026-10-15)

**Hecho desde el 2026-10-15 (front):** merge de `feat/abm-secciones` a `main`; refactor de estilos globales (mixins y
clases compartidas) y bundle inicial ~504 KB; accesibilidad WCAG 2.2 AA; features sin backend visibles con
`appUnavailable`; identidad visual alineada con el portal (Oak Sans self-hosted, azul oscuro, filtros pill); build de
producción compatible con la CSP de staging (`inlineCritical: false`). 89 tests unitarios en verde.

**Estado del front:** todo lo implementable está hecho y verificado (74 tests unitarios; e2e local 20 OK / 3 FALLA
de backend / 5 no cubiertos, `e2e/final_runs/run_7`). Lo que falta depende del backend o de una decisión.

### Ahora (front, sin dependencias)
- [ ] **QA humano** con `QA e2e en vivo — staging.md` y la sección "backend local" del QA manual (`npm run start:local`).
- [x] Merge de `feat/abm-secciones` a `main`.
- [x] **BO-22** listado de usuarios real y **BO-23** mensajes `4077`/`4091` (2026-11-10).
- [ ] Quitar del QA local el paso de preparación de G-14 (ya resuelto en backend).
- [ ] Usuario AGENT de prueba en el seed local para cubrir CP20 del e2e (hoy no hay credenciales de AGENT). Con `V2.30`
  conviene sumar al caso: AGENT ve adopciones, no ve "Adoptar" ni "Deshabilitar".
- [ ] Correr el e2e local contra `dev` @ `586b670` sin `E2E_SEED_SQL` para confirmar G-15 (CP16) y, de paso, lo que en
  esta auditoría solo se leyó en el código: roundtrip `GET` → `PUT` de la ficha (G-1), `/me` con organismo para AO y
  AGENT (G-2), `4072` como 409 (G-6), filtros de fichas y puntos, y G-26 a G-29.
- [x] Coordinar el orden de deploy: backend `586b670` a staging **antes** que el front de `feat/alinear-backend-586b670`.
  El backend se desplegó el 2026-11-19 (`origin/staging` @ `0a555df`); el front ya puede ir.
- [ ] Correr el e2e de staging contra el backend nuevo (hasta ahora solo se verificó el esquema de `/api-docs`).

### Cuando el backend entregue (en este orden; detalle en `PEDIDOS_BACKEND.md`)
| Pedido backend | Qué destraba en el front | Trabajo front estimado |
|---|---|---|
| ~~**R-3** grants~~ ✅ en `dev` | Etiquetas, Adopciones y Puntos visibles para los roles que corresponde | Ninguno (verificar con el e2e) |
| ~~**G-14** migración `V2.21`~~ ✅ | Levantar `dev` desde cero sin parche manual | Quitar el paso de preparación del QA local |
| ~~**G-15** adopciones 500~~ ✅ en `dev` (`58d383a`; sin verificar con el e2e) | "Adoptar trámite" y editar vigencias reales | Sacar el seed SQL del e2e (`E2E_SEED_SQL`) y cubrir CP16 |
| ~~**OPS-1** deploy de `dev` a staging~~ — ✅ cumplido el 2026-11-16 para `58d383a`; reabierto para `586b670` (13 commits, `V2.31`) y **cumplido de nuevo el 2026-11-19** (`origin/staging` @ `0a555df`) | Fichas y puntos de atención reales online; organismo en sesión; AO adopta | Ninguno de código: el front de `feat/alinear-backend-586b670` ya apunta a la API real (requiere backend >= `586b670`). Desplegarlo y verificar con el e2e de staging |
| ~~**G-1** response completo de la ficha~~ ✅ (`3797fe7`; en staging desde el 2026-11-19) | Fichas y puntos de atención en real; agrupar fichas por adopción | Hecho en la rama: sin overrides `fichas-locales`/`puntos-atencion` en staging y prod |
| ~~**G-2 / BO-20** organismo en `/me`~~ ✅ (`d7aca1c`; en staging desde el 2026-11-19) | AO/AGENT crean etiquetas locales y adoptan | Hecho en la rama (`ORGANISMO_ELEGIBLE`); volver a `{ permissions: ['CREATE_TAG'] }` recién cuando ningún entorno quede sin G-2 |
| ~~**BO-17** `GET /api/user`~~ ✅ (+ **G-13** pendiente) | Listado de usuarios real y acciones de cuenta reales | BO-22 (ya se puede); rol y organismo cuando salga G-13 |
| **R-1** ✅ / **G-4** 🟠 workflow de fichas | Rechazar revisiones; errores 4xx precisos (ya: `4077`, `4073`) | BO-23 ya; botón "Devolver a borrador" cuando salgan `reject`/`return-to-draft` |
| **G-9 / G-12** unicidad y validaciones (🟠: vigencia en el portal y en el alta de fichas, `1888e1a`) + **G-27** | Datos consistentes; mensaje preciso para "adopción no vigente" | Quitar validaciones de duplicado del cliente que pasen a ser del servidor; traducir el código nuevo cuando exista |
| **G-7 / G-11** filtros y paginación (🟠: filtros de fichas por adopción y de puntos por ficha) + **G-29** | Listados con volumen real; "Mostrar inactivos" en el panel de puntos | Paginado server-side en listas grandes |
| **G-20 / G-21** cambiar el rol de un usuario | "Asignar rol" utilizable (BO-24) | Acción en el detalle del usuario; mostrar rol, organismo y vigencia |
| ~~**G-22**~~ ✅ en `dev` (`a69925e`) / **G-23** quién asigna roles y crea usuarios | Alta de usuarios por AO; "Asignar rol" para SA y AB | Ajustar el gating de BO-24; el select de rol de AO se llena solo |
| **G-13 / G-26** rol en el listado de usuarios | Columna Rol; no ofrecerle a AB acciones sobre cuentas SA/AB | BO-26: ocultar o deshabilitar con motivo las acciones de esas filas |
| **G-3 / G-5** matriz de AB y AGENT (`READ_PROCEDURE` para AGENT, `READ_ORGANISM` y `READ_VARIANT` para AB; AO ✅ `V2.31`) | AGENT ve el trámite de la ficha; AB elige organismo y llega a los puntos de atención | Ninguno (gating por permiso) |
| **G-24** AGENT deshabilita/despublica por otra vía | UI y API coherentes para AGENT | Quitar el interruptor "Habilitado" a quien no pueda deshabilitar, si el backend lo define así |
| **G-16 / G-17 / G-8 / G-25 / G-28** (~~G-6~~ y ~~G-10~~ ✅ en `dev`) | Mensajes, decisiones de producto, historial de versiones | Ajustes puntuales |
| PPDT-5.13 / 5.15 / 5.21 | Dashboard, Feedback y Auditoría reales | `HttpDataSource` de cada feature (ya están en capas, en mock) |

### Decisiones pendientes (producto / backend)
- **D-3:** quién aprueba la publicación (hoy lo decide el permiso `PUBLISH_VARIANT`; la UI ya es configurable).
- **G-17:** si AO/AGENT deben ver etiquetas globales.
- **G-13:** si el borrado definitivo de usuarios debe existir o alcanza con la baja lógica.
- ~~**G-22:** si ADMIN_BACKOFFICE debe poder asignar roles a usuarios existentes~~ — resuelta en `586b670`: sí, los
  roles `assignableByBackoffice`.
- **G-27:** si se pueden preparar o editar fichas de una adopción que todavía no empezó o que ya venció.
- **G-26:** si un ADMIN_BACKOFFICE puede cambiar su propio email (hoy solo se lo cambia un SUPERADMIN).
- **G-24:** qué puede hacer AGENT sobre adopciones (¿solo la vigencia?) y si puede desactivar fichas publicadas.
