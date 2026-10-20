# Audit — ciclo del backlog BO-1 a BO-12

Fecha: 2026-10-01 · Rama: `feat/abm-secciones` (sin commitear) · Modo: **AUDIT** (propone, no implementa)

Alcance: lo construido o tocado en `BACKLOG_BACKOFFICE.md`:
- diálogo de credenciales de usuario;
- borrado definitivo de usuario;
- modal de confirmación con error inline;
- error de campo (acrónimo, slug);
- lista y form de Etiquetas;
- features nuevas Dashboard, Auditoría y Feedback;
- autorización por prerrequisitos.

Dos pasadas:
- **UX**, contra checklist.design: `design-system/modal`, `flows/showing-input-error`, `design-system/input-field`, `flows/deleting-account`, `web-app/user-management`, `design-system/badge`, `web-app/empty-state`.
- **Arquitectura**, con el agente `arquitecto-capas`, contra `.claude/rules/arquitectura-capas.md`.

Guardarraíles al momento del audit: `check:circular` 0 ciclos (265 archivos) · `lint` limpio · `tsc` limpio.

**Resultado: 0 🔴 · 9 🟡 · 9 🔵.** Nada bloquea el QA manual. Tres 🟡 conviene resolverlos antes del merge:
U-1, U-2 y A-3 (este último es limpieza de lo que este mismo ciclo dejó a medias).

---

## 1. UX

### Cobertura por checklist

| Checklist | Ítem | Estado | Evidencia |
|---|---|---|---|
| modal | Título claro | ✅ | `usuario-credencial-dialog.component.html:7` ("Cambiar email/contraseña de **Nombre**") |
| modal | Acción + cierre | ✅ | Cancelar/Guardar; Esc habilitado salvo mientras guarda (`disableClose` solo en vuelo) |
| modal | Fondo atenuado | ✅ | `MatDialog` + `custom-modal-panel` |
| modal | Responsive | ✅ | `credencial-dialog` 420px → `width:auto` en mobile |
| modal | Descripción | ✅ | Ayuda de política de contraseña y de email en minúsculas |
| showing-input-error | Validar recién al salir del campo | ✅ | `mat-error` se muestra con `touched` |
| showing-input-error | Explicar el porqué y cómo resolverlo | ✅ | Mensajes específicos (largo, mayúscula/minúscula/número, no coinciden, slug/acrónimo en uso) |
| showing-input-error | Ícono junto al texto de error | ⬜ | Errores de campo solo con texto (`credencial-dialog.html:19-43`). Igual que el resto del backoffice: es transversal, ver U-7 |
| showing-input-error | Volver a default al reintentar | ✅ | El error `server` se limpia al cambiar el valor: los validadores recalculan `errors` |
| input-field | Label, placeholder, formato | ✅ | `type="email"`, `autocomplete="new-password"`, hint del slug (`dynamic-form.config.ts:394`) |
| input-field | Mostrar u ocultar contraseña | ⬜ | `credencial-dialog.html:31,42`, ver U-6 |
| deleting-account | Explicar qué implica antes de confirmar | ✅ | `usuarios-list.component.ts:315`: irreversible, con todos sus datos, sugiere desactivar |
| deleting-account | Confirmar que se eliminó | ✅ | Snackbar "Usuario eliminado" + la fila desaparece |
| user-management | Distinguir desactivar de eliminar | ✅ | Dos acciones separadas, las dos `danger`, detrás del divisor (`usuarios-list.component.ts:270,290`) |
| user-management | Buscar y filtrar por rol | ✅ | La búsqueda incluye el rol traducido |
| user-management | Protección sobre la propia cuenta | ❌ | U-2 |
| badge | Estado legible sin depender del color | ✅ | "Global"/"Local" con texto (`etiquetas-list.component.html:73`) |
| empty-state | Error de carga ≠ vacío | ✅ Auditoría y Feedback · ❌ Dashboard | U-1 |

### Hallazgos

**🟡 U-1 · El Dashboard no tiene estado de carga ni de error.**
- Evidencia: `dashboard.component.ts:68` toma `loadHome()` directo y el template envuelve todo en `@if (home$ | async; as home)` (`dashboard.component.html:2`).
- Hoy no se nota porque el mock responde en el acto.
- Con el endpoint real, mientras carga el Home queda en blanco. Si falla, el `async` pipe propaga el error a consola y el Home queda en blanco para siempre, sin mensaje ni reintento.
- Es la primera pantalla después del login.
- Propuesta: esqueleto mientras carga, y un estado de error con "Reintentar", como el que ya tienen Auditoría y Feedback.

**🟡 U-2 · Se puede desactivar o eliminar la propia cuenta.**
- Evidencia: `usuarios-list.component.ts:245` (`accionesDe`) arma las acciones sin mirar quién está logueado.
- Con el listado real (`GET /api/user`), un SA puede eliminarse a sí mismo o dejarse sin acceso desde el menú de su propia fila.
- Hoy está latente: la lista es mock y los ids no coinciden con la sesión.
- `user-management` lo pide implícitamente al separar desactivación temporal de baja.
- Propuesta: en la fila del usuario logueado, ocultar Desactivar y Eliminar, o deshabilitarlas con tooltip, igual que hace Roles con el rol SUPERADMIN.

**🔵 U-3 · El banner repite su título.**
- Evidencia: `organismo-save-error.ts:21` y `etiqueta-save-error.ts:19` devuelven "No se pudo guardar: revisá el …", pero `app-form-error-banner` ya se titula "No se pudo guardar" (`dynamic-form.component.html:4-5`).
- Se lee "No se pudo guardar / No se pudo guardar: revisá el acrónimo."
- Propuesta: "Revisá el acrónimo." / "Revisá el slug."

**🔵 U-4 · "Guardar" deshabilitado sin decir por qué.**
- Evidencia: `credencial-dialog.html:65`.
- En modo email, con el email sin cambios el botón queda gris sin explicación.
- Propuesta: el ayuda-texto "Ingresá un email distinto al actual" mientras `emailSinCambios`.

**🔵 U-5 · El slug canonicalizado no se previsualiza.**
- Evidencia: `dynamic-form.config.ts:394` solo da un hint.
- Si escribís "Niños y Adolescentes!" se guarda `ninos-y-adolescentes` y lo ves recién en la lista.
- El subagente lo omitió porque `dynamic-form` no admite contenido bajo un campo.
- Propuesta: soporte de "preview" o hint dinámico en `dynamic-form-field`. Es transversal: también le sirve a Categorías y Eventos de Vida.

**🔵 U-6 · Sin "mostrar contraseña"** en el diálogo de credenciales (`credencial-dialog.html:31,42`). Con dos campos y una política estricta, ayuda a no tipear dos veces mal.

**🔵 U-7 · Los mensajes de error de campo del diálogo no reusan el util común.**
- Evidencia: `credencial-dialog.html:19-43` escribe a mano "Este campo es obligatorio" y "El email ingresado no es válido". Ese texto ya vive en `FORM_ERROR_MESSAGES` (`form-error-messages.util.ts`), que el resto del backoffice usa vía `appFormErrorMessage`.
- Propuesta: usar la directiva o el util, por DRY y para que cualquier cambio de copy o ícono (ver "Ícono junto al texto de error" en la tabla) aplique a todo.

**🔵 U-8 · Si fallan las estadísticas de Feedback, desaparecen en silencio.**
- Evidencia: el componente deja `stats` en `null` ante error (`feedback.component.ts:86-104`).
- Venía de antes del ciclo y se preservó a propósito.
- Propuesta: un aviso compacto "No pudimos cargar el resumen".

---

## 2. Arquitectura (agente `arquitecto-capas`)

Sin violaciones de reglas duras. No hay `facade→facade` ni `repo→repo`. Lo cross-feature va solo `Facade→Repository` vía barrel. Ningún componente inyecta Repository, DataSource ni HttpClient. Barrels mínimos, providers registrados.

**🟡 A-1 · El datasource HTTP de usuarios es híbrido y tiene lógica mock.**
- Evidencia: `usuarios.http.datasource.ts:3-5,36,70,87-103` delega 7 de 9 métodos en `UsuarioService` (mock). Duplica 1:1 `usuarios.mock.datasource.ts:57-70`.
- Está comentado en el archivo, pero `migracion_arquitectura.md` §12 dice que usuarios "corre en mock": no describe el híbrido.
- Propuesta: documentar la excepción en §12, con su condición de salida (`GET /api/user`).

**🟡 A-2 · `usuarios.http.datasource.ts:6,53,75` arma `HttpContext` a mano** en vez de `sinDialogoGlobal()`. Es el único de los nueve que no usa el helper.

**🟡 A-3 · El mock interceptor quedó con código muerto de este ciclo.**
- Al borrar los services quedaron huérfanos en `mock-api.interceptor.ts`:
  - rutas `/api/etiquetas*` (`:411-449`) y su estado (`:29`);
  - rutas `/api/modalidades*` (`:451-~490`) y su estado (`:30`);
  - rutas `/api/dashboard/*` (`:651-655`).
- También quedaron sin uso:
  - en `mock-data.ts`: `MOCK_MODALIDADES`, `MOCK_DASHBOARD_METRICS`, `MOCK_TOP_TRAMITES`, `MOCK_TOP_BUSQUEDAS`, `MOCK_TRAMITES_POR_ORGANISMO`;
  - en `dashboard.model.ts`: `DashboardMetrics`, `TramitesPorOrganismo`, `TopTramite`, `TopBusqueda`.
- `/api/auditoria` y `/api/feedback*` siguen vivas: las usan sus mock datasources.

**🟡 A-4 · Las tres features nuevas resuelven el mock de tres formas distintas.**
- Dashboard: datos en memoria del feature.
- Auditoría: `HttpClient` contra el interceptor (`auditoria.mock.datasource.ts:20-34`).
- Feedback: envuelve el `FeedbackService` legacy (`feedback.mock.datasource.ts:3`).
- Auditoría y Feedback además importan modelos legacy de `core/models` en datasource y mapper.
- Propuesta: unificar al estilo Etiquetas o Dashboard (mock en memoria dentro del feature, con DTO propio). Con eso, A-3 suma las rutas `/api/auditoria*` y `/api/feedback*`.

**🟡 A-5 · `AuditoriaAccion` existe en dos lugares.**
- `dashboard.model.ts:31` y `auditoria.vm.ts:2`.
- `accion-label.pipe.ts:2` importa el legacy y `pages/auditoria` el del barrel.
- Propuesta: que el pipe importe de `@features/auditoria`.

**🟡 A-6 · Hay dos `*-save-error.ts` casi idénticos.**
- `organismo-save-error.ts` y `etiqueta-save-error.ts`: misma función, solo cambian código, control y textos.
- La tercera copia es previsible (Categorías, Eventos: slug único).
- Propuesta: `core/utils/save-error.utils.ts` con `aplicarConflictoEnCampo(err, form, { code, control, mensajeCampo, mensajeBanner, fallback })`. De paso resuelve U-3 en un solo lugar.
- Mover también `errorDeNegocio` (`etiquetas.mock.datasource.ts:17`) a `core/mocks`.

**🔵 A-7 · Comentarios desactualizados** que siguen diciendo "crear/editar = SUPERADMIN por policy override": `pages.module.ts:50` y `:99-100`.

**🔵 A-8 · `dashboard.dto.ts:1-3` importa tipos del VM.** Dirección invertida (DTO → VM). Definir sub-DTO propios cuando exista el endpoint.

**🔵 A-9 · `auth.service.ts` construye `HttpContext` a mano** en `login` y `activateAccount`. Podría usar `sinDialogoGlobal()` para uniformar (Auth es excepción documentada: no es violación).

---

## 3. Backlog consolidado

| Prioridad | Ítem | Tipo | Esfuerzo | Cuándo |
|---|---|---|---|---|
| 1 | A-3 · Borrar rutas, datos y modelos mock huérfanos | Limpieza del ciclo | S | Antes del merge |
| 2 | U-1 · Carga y error en Dashboard | UX | S | Antes del merge |
| 3 | U-2 · Sin desactivar ni eliminar la propia cuenta | UX / seguridad | S | Antes del merge (o al llegar `GET /api/user`) |
| 4 | A-6 + U-3 · Util común de error de guardado + copy | DRY + microcopy | S | Antes del merge |
| 5 | A-2 + A-9 · `sinDialogoGlobal()` en usuarios y auth | Consistencia | XS | Antes del merge |
| 6 | A-7 · Comentarios de `pages.module.ts` | Docs | XS | Antes del merge |
| 7 | A-1 · Documentar el híbrido de usuarios en §12 | Docs | XS | Antes del merge |
| 8 | A-5 · `AuditoriaAccion` único | Deuda | XS | Con A-4 |
| 9 | A-4 · Mock en memoria para Auditoría y Feedback | Deuda | M | Próximo ciclo |
| 10 | U-4 · Explicar "Guardar" deshabilitado | Microcopy | XS | Próximo ciclo |
| 11 | U-7 · Diálogo de credenciales con `FORM_ERROR_MESSAGES` | DRY | XS | Próximo ciclo |
| 12 | U-6 · Mostrar contraseña | Nice-to-have | XS | Próximo ciclo |
| 13 | U-5 · Preview de slug en `dynamic-form` | Nice-to-have, transversal | M | Cuando se toque el form |
| 14 | U-8 · Aviso si fallan las estadísticas de Feedback | Nice-to-have | XS | Próximo ciclo |
| 15 | A-8 · DTO propio de Dashboard | Deuda | XS | Con el endpoint real |

Con los ítems 1 a 7 (todos S o XS) el ciclo queda cerrado y limpio para el QA manual y el merge.

---

## 4. Resolución (2026-10-01)

Los 15 ítems quedaron aplicados. Verificación: `tsc`, `lint` y `check:circular` limpios (0 ciclos, 271 archivos),
y `ng build` sin warnings (bundle inicial de 855 KB). Sin commitear.

| Ítem | Resolución |
|---|---|
| U-1 | Dashboard con `vm$` cargando/listo/error, `app-loading` en modo skeleton y "Reintentar". El estado de error se extrajo a mixins `state-panel*` (`_mixins.scss`), que ahora reusa también la tabla |
| U-2 | En la fila del usuario logueado no aparecen Desactivar ni Eliminar (se reconoce por id o por email) |
| U-3 + A-6 | `core/utils/save-error.utils.ts` (`aplicarErrorDeGuardado(err, form, conflictos, fallback)`). Organismos y Etiquetas solo declaran sus conflictos. El banner dice "Revisá el campo marcado." |
| U-4 | Con el email sin cambios, la ayuda dice "Ingresá un email distinto al actual para poder guardar." |
| U-5 | `FieldConfig.preview` + `aria-live`. Etiqueta (slug): "Se guardará como". Evento de vida (nombre): "Identificador (slug)". Categoría (slug): "Formato sugerido", porque ahí el backend no canonicaliza: valida con `pattern` |
| U-6 | Botón de ojo en el diálogo de credenciales: muestra u oculta las dos contraseñas (`aria-pressed`) |
| U-7 | Los mensajes del diálogo salen de `getControlErrorMessage` (`FORM_ERROR_MESSAGES`), con el ícono del patrón común |
| U-8 | Si fallan las estadísticas de Feedback, aparece "No pudimos cargar el resumen." con reintento |
| A-1 | El datasource híbrido de usuarios quedó documentado en `migracion_arquitectura.md` §12 (fila y excepciones), con su condición de salida |
| A-2 + A-9 | `sinDialogoGlobal()` en `usuarios.http.datasource.ts` y `auth.service.ts`. No queda ningún `HttpContext` armado a mano |
| A-3 | Rutas, datos y tipos huérfanos borrados del interceptor, `mock-data.ts` y `dashboard.model.ts`. **Quedan** los GET `/api/etiquetas`, `/api/modalidades` y `/api/feedback`, que todavía usa el mock de trámites |
| A-4 | Auditoría y Feedback con mock en memoria dentro del feature, con DTO propio. Sin `HttpClient`, `FeedbackService` ni modelos legacy |
| A-5 | `accion-label.pipe` importa `AuditoriaAccion` de `@features/auditoria`; el tipo legacy se borró |
| A-7 | Comentarios de `pages.module.ts` reescritos según los prerrequisitos |
| A-8 | `dashboard.dto.ts` con sub-DTO propios; el mapper traduce DTO → VM |
| extra | `errorDeNegocio` pasó a `core/mocks/mock-errors.ts` |

Queda abierto, como decisión de producto: que el form de Categorías canonicalice el slug antes de enviarlo, en vez
de solo sugerir el formato.
