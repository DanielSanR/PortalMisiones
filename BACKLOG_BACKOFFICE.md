# Backlog — Backoffice

Relevado el 2026-09-30 sobre `feat/abm-secciones` (`6ba7a7c`), contra `BACKEND_API_SPEC.md` y el
backend `PortalMisiones-backend@d800be0`. Estado base: `check:circular` 0 ciclos, `lint` OK, `ng build` OK
(con warnings de budget).

Cierre 2026-09-30: `tsc`, `lint`, `check:circular` (0 ciclos / 265 archivos) y `ng build` sin warnings
(inicial 854 KB). Sin commitear.

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
| Trámites / variantes | ✅ API expuesta en `23fd8f9` (PPDT-5.4/5.5/5.6) — falta el front (BO-15, plan en `PLAN_TRAMITES_API.md`) | mock completo |
| Etiquetas | ✅ `TagController` expuesto (`84fde37`) | **real** (BO-16) |
| Listado de usuarios | `GET /api/user` paginado — ⚠️ **no figura en el backlog de Taiga** | híbrido: alta real; listado, edición y acciones de fila en mock |
| Feedback | moderación (Taiga **PPDT-5.15**; la tabla `procedure_feedbacks` ya existe) | mock en capas (BO-4) |
| Auditoría | auditoría de cambios sensibles (Taiga **PPDT-5.21**; la tabla `audit_events` ya existe) | mock en capas (BO-4) |
| Dashboard | API de métricas (Taiga **PPDT-5.13**, rol `MANAGER`) | mock en capas (BO-4) |
| Ficha de organismo | jurisdicción, CUIT, domicilio, contacto, SIGAF, responsables, actividad | placeholders "pendiente" |
| Adjuntos | upload de archivos | `storage.service` sin consumidor |
| reCAPTCHA | claves reales | solo mock |

Relevado contra `PortalMisiones-backend` `origin/dev` @ `2e41090` (2026-10-06): sin endpoints nuevos de backoffice
ni permisos nuevos en el seed. Detalle en `BACKEND_API_SPEC.md` §7.0.

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
- [ ] ADMIN_ORGANIZATION y AGENT van a ver solo datos de su organismo. Revisar listas y selects de organismo
  (usuarios, etiquetas locales, trámites) para no ofrecer opciones que el backend va a rechazar.

### BO-15 · Trámites contra la API real — cuando salgan PPDT-5.4/5.5/5.6 · Alta
- [ ] Permisos del backend: `CREATE/READ/DELETE_PROCEDURE`. Las rutas del front hoy piden además `*_VARIANT`
  (`pages.module.ts`): revisar contra el contrato final.
- [ ] Modelo nuevo: plantilla maestra (backoffice provincial) → adopción por organismo → versiones (OTL) con workflow
  de publicación. El mock actual de trámites no tiene esa forma: es una reestructura, no solo agregar un `HttpDataSource`.

### BO-16 · Etiquetas contra la API real (PPDT-5.8, salió en `84fde37`) · Media
- [x] `EtiquetasHttpDataSource` (`/api/tag`) + DTO + mapper; quitado el override `etiquetas: 'mock'` (dev y prod).
- [x] Permisos `*_TAG` (nuevos) en lugar de `*_TAXONOMY`: nav y lista con `READ_TAG`, rutas, botón, CTA, acciones y comando.
- [x] Fuera la columna "Trámites" y el conteo del modal de borrado: el backend no expone cuántos trámites usan una etiqueta.
- [x] `4073` (fuera de alcance) se marca en el campo Organismo; `4072` sigue en el campo Slug.
- ⚠️ **Gap abierto (BO-20):** AO/AGENT solo pueden crear etiquetas locales de su organismo, pero el select de organismos
  necesita `READ_ORGANISM` (que no tienen) y la sesión no trae su organismo. Hoy esos roles ven y editan sus etiquetas,
  pero al crear solo se les ofrece "global" → el backend responde `4073`.

### BO-21 · Permisos `*_TAG` / `*_ADOPTION` / `*_ATTENTION_POINT` probablemente sin asignar (R-3) · 🔴 Alta (backend)
- [ ] `V2.20`, `V2.23` y `V2.24` asignan con `WHERE roles.code IN ('ROLE_SUPERADMIN', …)`, pero `V0.4` quitó el prefijo
  `ROLE_` a los códigos de rol (`V2.16`/`V2.17` sí contemplan ambas formas). Si se confirma, **ningún rol tiene `READ_TAG`**:
  Etiquetas (ya real, gateada por `READ_TAG`) desaparece del menú incluso para SUPERADMIN.
- [ ] Verificar en la base (`SELECT r.code, p.code FROM role_permissions rp JOIN roles r ON r.id=rp.role_id JOIN permissions p
  ON p.id=rp.permission_id WHERE p.code LIKE '%\_TAG' ESCAPE '';`) y pedir al backend una migración correctiva.
- Mitigación local si hace falta: asignar los permisos a mano desde la pantalla de Roles (SA).

### BO-19 · Puntos de atención (PPDT-5.7, salió en `7b5afda`) · Media
- [ ] Sección nueva: CRUD de `/api/attention-point`, colgado de cada trámite por localidad. Va con BO-15 (ver plan).

### BO-20 · Organismo del usuario en sesión para roles con alcance (AO/AGENT) · Media
- [ ] Hace falta conocer el organismo del usuario logueado para preseleccionarlo (etiquetas locales, adopciones, trámites
  por localidad). `/api/auth/me` no lo trae. Opciones: pedir al backend que `/me` incluya el organismo, o leerlo de
  `GET /api/user/{id}` (requiere `READ_USER`, que AGENT no tiene). Decisión a coordinar con backend.

### BO-17 · Pedir `GET /api/user` al backend · Alta (coordinación)
- [ ] No tiene tarjeta en Taiga. Desde `0ea13a0` el servicio ya existe (`UserService.findAllUserDTO()`, filtrado por organismo
  para AO): solo falta exponerlo en `UserController`. Sin ese endpoint, el listado de usuarios y las acciones de fila (BO-3) siguen en mock.
