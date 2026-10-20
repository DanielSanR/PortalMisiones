# Task
E2E automatizado (Playwright Python, Firefox headless, viewport 1280x1800) del backoffice Angular. Dos destinos
(`E2E_TARGET`, ver `README.md`):
- **local** (corrida final de referencia): dev server `npm run start:local` (`environment.local.ts` +
  `proxy.local.cjs` → backend Docker rama `dev` @ `23fd8f9`, Postgres local descartable con los grants de R-3). En
  real: auth, organismos, tipos, taxonomías, roles, permisos, **etiquetas, plantillas, adopciones, fichas y puntos de
  atención**. Usuarios: alta real, listado mock. Dashboard/auditoría/feedback: mock.
- **staging** (referencia anterior: `final_runs/run_5/`): trámites y etiquetas en mock (CP10/CP11).

Corrida de referencia: **`final_runs/run_7/`** (local, prefijo `E2E-1792090542`). Capturas en
`final_runs/run_7/screenshots/`, log en `final_runs/run_7/final_script_log.txt` (al final: requests clave, hallazgos
de backend y de front, residuos). `run_6` fue la primera corrida local: igual que run_7 salvo CP14, que asumía que el AO
ve etiquetas (el backend le devuelve 0; ahora el CP compara contra lo que devuelve la API para ese usuario y lo anota
como hallazgo de backend). `run_1`–`run_5` son corridas contra staging.

Permisos reales (`GET /api/auth/me`, local; las expectativas de gating se calculan de acá, con el prerrequisito
`CREATE_USER` ⇒ `READ_ORGANISM` + rol admin):
- SA: 59 permisos (todo, incluido `*_ADOPTION`, `*_TAG`, `*_ATTENTION_POINT`, `PUBLISH_VARIANT`).
- AB: taxonomías, `*_PROCEDURE` (sin DELETE), `*_ADOPTION`, `*_TAG`, `*_ATTENTION_POINT`, `READ/CREATE/UPDATE/DELETE_USER`;
  **sin** `READ_ORGANISM`, `*_VARIANT`, `READ_ROLE`.
- AO: `*_ADOPTION`, `*_TAG`, `*_ATTENTION_POINT`, `READ/CREATE/UPDATE_VARIANT`, `PUBLISH_VARIANT`, `READ_USER`;
  **sin** `READ_ORGANISM` ni `READ_PROCEDURE`.
- AGENT: no hay credenciales de prueba → no cubierto.

# Critical Points (run_7, local)
- [x] CP1: Login SA + `GET /api/auth/me` con `Bearer`; contraseña inválida → error inline. Evidencia: steps 1–2,
  `final_execution_1_login_password_invalida.png`, `final_execution_2_login_sa_home.png`.
- [x] CP2: Humo SA: los 16 ítems del menú (= menú esperado por `/me`) abren sin pantalla en blanco, 0 errores de
  consola y 0 diálogos globales. Evidencia: steps 3–20, `final_execution_4_smoke_inicio.png` …
  `final_execution_19_smoke_feedback_ciudadano.png`; `(total=0 …)` en "Errores de consola".
- [x] CP3: breadcrumb del detalle del organismo fijo vuelve a `/organismos/lista`. Evidencia:
  `final_execution_46_cp3_detalle_organismo.png`, `final_execution_47_cp3_breadcrumb_vuelve_a_lista.png`.
- [x] CP3-roles: para AB y AO, el breadcrumb de cada ítem del menú y de los detalles de plantilla, adopción y ficha
  solo linkea secciones visibles para el usuario (p. ej. AO en la ficha: `Inicio > Fichas por localidad`). Evidencia:
  log steps 95–96 y `RESULT CP3-roles`.
- [x] CP4: ABM real SA. Categorías/Modalidades/Destinatarios/Eventos: POST 201, PUT 200, DELETE 200 y `GET` → 404.
  Tipos y Organismos sobre los registros fijos (reactivar+editar → PUT 200 `active=true`; eliminar → DELETE 200 y
  `active=false`). CP4-origen y CP4-dup (POST 409 code 4069, error en el campo Sigla, sin diálogo) OK.
  Evidencia: `RESULT CP4`, `CP4-origen`, `CP4-dup` en el log.
- [x] CP5: DELETE de modalidad abortado → modal abierto con "No se pudo completar la acción. Intentá de nuevo.";
  reintento → DELETE 200. Evidencia: `RESULT CP5`.
- [x] CP6: "Salir sin guardar" con el form de organismo sucio. Evidencia: `RESULT CP6`.
- [x] CP7 (**adaptado**): Usuarios con fuente real: 5 filas, todas con "Editar"; ninguna ofrece "Cambiar email",
  "Cambiar contraseña", "Activar/Desactivar cuenta" ni "Eliminar definitivamente" (0 menús de fila). Evidencia:
  `final_execution_49_cp7_usuarios_sin_acciones_de_cuenta.png`.
- [ ] CP7b: alta real de usuario — **no cubierto** (apagado por defecto, B-1).
- [x] CP8: Roles y Permisos: SA con "Nuevo rol"/"Nuevo permiso" y toggle "Asignable por Administrador de Backoffice";
  AB sin acciones. Evidencia: `RESULT CP8`, `final_execution_52_cp8_sa_form_rol_toggle_backoffice.png`, `final_execution_82_cp8_ab_roles_sin_acciones.png`.
- [x] CP9 (**adaptado a `/me`**): menú, humo, acciones y URL directa de AB y AO coinciden con lo esperado por sus
  permisos reales (0 inconsistencias). AB: sin Organismos/Tipos/Fichas, ve Plantillas/Adopciones/Etiquetas, sin
  "Adoptar trámite" (le falta `READ_ORGANISM`), Usuarios en lectura. AO: Inicio, Etiquetas, Trámites del organismo,
  Fichas, Usuarios, Feedback; `/tramites/plantillas`, `/etiquetas/nuevo`, `/usuarios/nuevo`, etc. → Home. Evidencia:
  `final_execution_90_cp9_ao_menu.png`, `final_execution_97_cp9_ao_url_directa.png`, log steps 80–97.
- [ ] CP10 / CP11: **no cubiertos en local** a propósito (son los flujos mock de staging; en local los reemplazan
  CP13–CP18). Última evidencia en staging: `run_5`.
- [x] CP12: `/dashboard/tramites/lista` → `/dashboard/tramites/plantillas`. Evidencia: `RESULT CP12`.
- [x] CP13: Etiquetas real (SA). `"  E2E-<ts> Global Ñandú Público!"` → vista previa y slug guardado
  `e2e-<ts>-global-nandu-publico` (POST 201, badge Global); duplicada → POST 400 code **4072**, error en el campo Slug
  "Ya existe una etiqueta con ese slug en ese alcance…", banner, sin diálogo; local de "Silicon Misiones" (POST 201,
  `local=true`, badge Local); editar → PUT 200; borrar las dos → DELETE 200 y `GET /api/tag/{id}` → 404. Evidencia:
  `final_execution_54…59_cp13_*.png` (verificadas visualmente: 55 muestra el error en el campo).
- [x] CP14: Etiquetas por rol. AB ve las 2 globales y "Nueva etiqueta" (rol AB), el form ofrece solo "Ninguno —
  etiqueta global" y no pide `/api/organism`. AO no ve "Nueva etiqueta", no pide `/api/organism`, sin diálogo; ve 0
  etiquetas = lo que le devuelve `GET /api/tag` (hallazgo de backend B-4). Evidencia:
  `final_execution_84_cp14_ab_etiquetas.png`, `final_execution_84_cp14_ab_form_etiqueta.png`,
  `final_execution_92_cp14_ao_etiquetas.png`.
- [x] CP15: Plantillas real. Alta con slug autogenerado `obtener-certificado-e2e-<ts>-de-prueba`, categoría principal
  = la categoría fija (dentro de `categoryIds`) y etiqueta `salud` → POST 201 → detalle; slug duplicado → 400 **4072**
  con error en el campo (verificado en `final_execution_61_cp15_plantilla_slug_duplicado.png`); editar resumen → PUT
  200; desactivar → DELETE 200, `active=false`. Evidencia: `final_execution_59…62_cp15_*`,
  `final_execution_100_cp15_plantilla_desactivada.png`.
- [ ] CP16-alta: **FALLA (backend)**. `POST /api/organism-procedure` → **500** code 5000 (B-1 abajo); la UI muestra el
  error dentro del diálogo, sin diálogo global. Evidencia: `final_execution_63_cp16_adoptar.png`. Para seguir se sembró
  la adopción por SQL en la base local (`E2E_SEED_SQL`).
- [ ] CP16-solapamiento: **FALLA (backend)**. Se esperaba 409/4080; responde 500 (misma causa). El front lo muestra
  dentro del diálogo, que queda abierto. Evidencia: `final_execution_65_cp16_adopcion_solapada.png` (verificada).
- [ ] CP16: adopciones (sobre la adopción sembrada) — **FALLA solo por el PUT de vigencia** (500, misma causa). OK:
  detalle con plantilla, organismo y vigencia 01/01/2026–31/12/2027 (`final_execution_66_cp16_adopcion_detalle.png`,
  verificada), "Organismos que la adoptaron" en la plantilla con "Silicon Misiones · Vigente"
  (`final_execution_68_cp16_plantilla_organismos_que_la_adoptaron.png`), deshabilitar → DELETE 200, `enabled=false`
  y sale de la lista (`final_execution_99_cp16_adopcion_deshabilitada.png`).
- [x] CP17: Fichas real. Desde la adopción, "Agregar localidad" → Posadas → slug `…-de-prueba-posadas` → POST 201
  `BORRADOR` v1; workflow real `submit-review` 200 → EN_REVISION v2, `publish` 200 → PUBLICADO v3, `unpublish` 200 →
  DESPUBLICADO v4, con el badge del membrete en cada paso; la ficha aparece en la lista; "Desactivar" → DELETE 200,
  badge "Desactivada", `active=false`. Evidencia: `final_execution_68…73_cp17_*`, `final_execution_70_cp17_ficha_publicada.png`
  (verificada), `final_execution_98_cp17_ficha_desactivada.png`.
- [x] CP17-G1: con la ficha PUBLICADA, "Editar" muestra "Esta ficha todavía no se puede editar" y no hay formulario
  (bloqueo por diseño con G-1). Evidencia: `final_execution_71_cp17_ficha_edicion_bloqueada_g1.png`. El toggle
  "Activa" bloqueado de una ficha publicada queda **no cubierto** (no se llega al form con G-1 abierto).
- [x] CP18: Puntos de atención real. lat 95 / long con 7 decimales → "Tiene que estar entre -90 y 90" y "Hasta 6
  decimales", 0 POST; alta válida (-27,367104; -55,896108) → POST 201; editar → PUT 200; desactivar → DELETE 200,
  `active=false`, aparece "Mostrar inactivos (1)". Evidencia: `final_execution_74…77_cp18_*` (75 verificada).
- [x] CP19: estado vacío con filtros activos (búsqueda sin resultados) en Etiquetas y Plantillas: único CTA "Limpiar
  filtros", que limpia la búsqueda. Evidencia: `final_execution_77_cp19_vacio_con_filtros_etiquetas.png`,
  `final_execution_78_cp19_vacio_con_filtros_plantillas_provinciales.png`.
- [ ] CP20: gating de AGENT — **no cubierto** (no hay credenciales de AGENT; no se inventan. Se habilita con
  `E2E_AGENT_EMAIL`).
- [x] CLEANUP: `CLEANUP_SUMMARY: datos E2E activos remanentes = 0`. RESIDUOS: inactivos 2 → 2 (no creció).

# Hallazgos de backend (local, rama dev @ 23fd8f9)
- **B-1 Adopción: alta, solapamiento y edición dan 500.** `POST /api/organism-procedure` → 500
  `{"code":5000,"message":"Ocurrió un error inesperado…"}` con cualquier payload (con y sin `effectiveTo`, con y sin
  `ownerOrganismId`); `PUT /api/organism-procedure/{id}` → 500 igual. Causa (log del contenedor): la consulta de
  solapamiento `… and (? is null or op1_0.id<>?) and (? is null or op1_0.effective_from<?) …` falla en Postgres con
  `could not determine data type of parameter $5` (parámetro nulo sin tipo). Bloquea crear/editar adopciones y el
  4080. Payload enviado: `{"procedureTemplateId":…,"organismId":…,"ownerOrganismId":null,"enabled":true,
  "effectiveFrom":"2026-01-01T00:00:00","effectiveTo":"2027-12-31T23:59:59"}`.
- **B-2 (G-1) Ficha sin contenido.** `GET /api/organism-procedure-location[/{id}]` → 200 solo con
  `id, slug, publicationStatus, active, currentVersionNumber`; faltan `organismProcedureId, locationId, url,
  requirements, costs`. Consecuencias: edición bloqueada, "no disponible" en el detalle y la sección de fichas de la
  adopción vacía.
- **B-3 Borrar una categoría usada por una plantilla da 500.** `DELETE /api/category/{id}` → 500 code 5000 (debería
  ser 409 con código): `violates foreign key constraint "procedure_templates_main_category_id_fkey"` (también con la
  plantilla desactivada). Visto en la exploración previa a run_6; por eso el script usa una categoría fija.
- **B-4 Etiquetas globales invisibles para AO.** `GET /api/tag` con el AO (tiene `READ_TAG`, sin organismo
  asignado) → 200 `data: []`; el SA y el AB ven `salud` y `transito` (globales). El alcance por organismo deja afuera
  las globales (o el AO sin organismo no ve nada).

# Hallazgos de front
- **F-1** Detalle de la adopción > "Fichas por localidad" muestra "Todavía no se ofrece en ninguna localidad" aunque
  la adopción tiene una ficha (`final_execution_70_cp17_adopcion_seccion_fichas.png`). `FichasLocalesFacade.getDeAdopcion`
  (`backoffice/src/app/core/features/fichas-locales/facades/fichas-locales.facade.ts:146`) filtra por `adopcionId`,
  que con G-1 no llega: debería mostrar "no disponible" en vez del vacío. Mismo motivo: el form de alta no puede marcar
  localidades "ya tiene ficha".

# Datos que quedan en la base local
Borrado físico: etiquetas E2E (404). Solo baja lógica (la API no tiene borrado físico): por corrida, 1 plantilla
(inactiva), 1 adopción sembrada (deshabilitada), 1 ficha (inactiva) y 1 punto de atención (inactivo); los registros
fijos `E2E-fijo Organismo r1792090542` / `E2E-fijo Tipo r1792090542` (inactivos, creados una única vez en run_6) y la
categoría `E2E-fijo Cat plantilla` (activa a propósito, reutilizable). Además, de la exploración previa: la plantilla
`ce17c932…` (inactiva), la adopción `8300aeb7…` (deshabilitada, sembrada), la ficha `971d50ea…` y su punto (inactivos).

# Staging (referencia anterior: run_5)
Contra staging, CP1–CP12 dieron OK en `run_5` con CP10/CP11 en mock (permisos inyectados en `/me` para etiquetas y
puntos). Desde run_6 el CP7 verifica que las acciones de cuenta de usuarios ya no se ofrecen (Usuarios va en fuente
real también en staging) y CP2/CP9 calculan el menú esperado desde `/me`. Esta versión del script **no se corrió
contra staging** (el entorno de esta corrida era local).
