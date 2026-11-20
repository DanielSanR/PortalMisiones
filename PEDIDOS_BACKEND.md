# Pedidos del backoffice al backend — Portal Provincial de Trámites (Misiones)

**Fecha:** 2026-11-20 · **Backend relevado:** `origin/dev` @ `586b670` (código; migraciones hasta `V2.31`) y API de staging (`origin/staging` @ `0a555df`, merge de `dev` que contiene `586b670`, desplegado el 2026-11-19; `/api-docs` consultado ese día, antes y después del deploy) · **Contacto:** Daniel Romero (frontend backoffice)

> **E2E 2026-11-20 — primera ejecución de flujos contra staging (backend `586b670`).** Se corrieron los dos scripts
> nuevos de `e2e/roles/`: `07_fichas_y_sesion.py` (fichas, puntos de atención, workflow y organismo de la sesión, con
> SUPERADMIN más una cuenta ADMIN_ORGANIZATION y una AGENT) y `08_roles_fichas_y_sesion.py` (los seis roles: sesión,
> menú, URL directa, fichas, trámites, etiquetas y usuarios; UI del front local contra la API de staging, más
> llamadas directas a la API con el token de cada rol). **Totales: 114 casos OK, 3 FALLA y 4 sin cubrir** (script 07:
> 29 / 1 / 3; script 08: 85 / 2 / 1). Resultados en `e2e/final_runs/fichas_2026-11-19/` (`07_fichas_y_sesion/` y
> `08_roles_fichas_y_sesion/`: `resultados.json`, `log.txt` y `screenshots/`). **Los datos de muestra creados en staging
> (adopciones, fichas, puntos de atención y cuentas) están listados en `e2e/roles/datos_muestra.json`.**
> - **Las 3 FALLA:** `FS-DUP-03` (ficha duplicada → 500 `5000`, **G-9**), `AO-USR-02` (ADMIN_ORGANIZATION sin roles
>   asignables, **G-23**) y `MG-TRA-03` (hallazgo **del front**, no del backend: "Plantillas provinciales" pide
>   `GET /api/tag` sin chequear `READ_TAG` y a MANAGER le abre el diálogo global de "Acceso denegado").
> - **Los 4 sin cubrir:** `FS-ORG-AO-05` (el alta de usuario de AO no ofrece ningún rol: G-23), `FS-ORG-AGENT-03` y
>   `FS-ORG-AGENT-05` (AGENT no tiene `CREATE_ADOPTION` ni `CREATE_USER`: esperado) y `GEN-LOGIN-BLOQ` (bloqueo de login:
>   exige más intentos fallidos de los que la prueba se permite en un staging compartido; ver G-33).
> - **Pasan de "leído en el código" a "confirmado en ejecución":** el duplicado de ficha en 500 `5000` por las dos
>   restricciones (G-9), ADMIN_ORGANIZATION con `CREATE_USER` y `GET /api/role/allowed` vacío (G-23), ADMIN_BACKOFFICE
>   con `*_ATTENTION_POINT` y sin `READ_VARIANT` (G-5), `organismAcronym: null` en `/me` (G-2), el 403 `4029` de
>   ADMIN_BACKOFFICE sobre cuentas SA/AB (G-26) y el filtro de puntos por ficha que devuelve solo activos (G-29).
> - **Confirmados como funcionando:** contrato completo de la ficha y roundtrip `GET` → `PUT` sin pérdida (G-1), los dos
>   filtros nuevos (G-7), `/me` con `scope` por rol (G-2), alcance por organismo (ficha ajena → 404 `4073`, G-4),
>   ADMIN_ORGANIZATION lee plantillas (`V2.31`, G-3), duplicado de etiqueta → 409 `4072` (G-6) y `/api/role/allowed`
>   de ADMIN_BACKOFFICE (G-22). Con esto **OPS-1 queda verificado también en flujos**, no solo en el esquema.
> - **Pedidos nuevos (G-33 a G-35), leídos en el código de `586b670`, no ejecutados:** bloqueo de login por intentos
>   fallidos (**G-33**: duración de un minuto con comentario de cinco, tiempo restante solo dentro del `message`, y —por
>   el orden de los chequeos de Spring— una cuenta bloqueada respondería 500 y no se desbloquearía sola), enumeración de
>   cuentas en el login (**G-34**, seguridad) y códigos reusados en el guardado de organismo (**G-35**). **Ampliados:**
>   G-16 (borrar un permiso asignado a un rol también cae en 500) y G-25 (el `4018` del rol inexistente sigue igual).
>
> **Auditoría 2026-11-19:** se revisaron los 13 commits de `dev` entre `58d383a` y `586b670` (2026-11-16 a 2026-11-18;
> lectura de código, migraciones, tests y `odd/tasks/*.md`; no se levantó el backend). **Resueltos en `dev` (5),
> en staging desde el mismo 2026-11-19 (ver "Deploy a staging" más abajo):** **G-1** (`3797fe7`; cierra también el cabo de R-1), **G-2 / BO-20** (`d7aca1c`),
> **G-6** (`1f51bea`), **G-10** (`130c180`) y **G-22** (`a69925e`). **Avance parcial (4):** G-3 (`V2.31`: `READ_PROCEDURE`
> solo para AO), G-7 (filtro de puntos de atención por ficha, `0db49a9`), G-9 (vigencia en las consultas públicas,
> `1888e1a`) y G-12 (§3: fichas sobre adopciones no vigentes, `1888e1a`). **Sin cambios:** G-4, G-5/D-3, G-8, G-11,
> G-13, G-16 a G-21, G-23 a G-25, DOC-1 y lo que no tiene endpoint (métricas, auditoría, lectura de feedback).
>
> **Contrato nuevo que no era pedido nuestro (PPDT-5.1, `a69925e`):** ADMIN_BACKOFFICE ya no puede dar de baja (lógica
> ni definitiva), cambiar el estado ni cambiar el email de una cuenta con rol vigente `SUPERADMIN` o `ADMIN_BACKOFFICE`
> → 403 `4029`. Contrato en `BACKEND_API_SPEC.md` §3.2; consecuencia para el front en G-26.
>
> **Pedidos nuevos (G-26 a G-29)**, todos surgidos de estos commits y **leídos en el código, no ejecutados**: el front
> no puede saber qué cuentas son privilegiadas (G-26), una ficha cuya adopción dejó de estar vigente no se puede editar
> y el error es un 404 "no existe" (G-27), `slugBase` puede canonicalizarse a vacío y los slugs previos no se migran
> (G-28), y el filtro de puntos de atención por ficha devuelve solo activos (G-29).
>
> **Surgidos de la implementación del front (misma fecha, mismo commit `586b670`; leídos en el código, no
> ejecutados):** tres pedidos nuevos y cinco ampliaciones.
> - **Nuevos:** los motivos del 403 `4029` de usuarios solo se distinguen por el texto de `details` (**G-30**);
>   `PUT /api/user/{id}/change-password` es la única mutación de usuario que no valida el alcance del actor (**G-31**,
>   autorización; latente: con el seed solo SA y AB tienen `UPDATE_USER`); y la vigencia de la adopción se evalúa con la
>   hora de pared de la JVM, sin zona fijada en ningún lado (**G-32**).
> - **Ampliados:** G-9 (el duplicado de ficha sigue en 500 `5000` y el front no sabe cuál de las dos restricciones
>   falló), G-8 (el `PUT` no lleva versión: el front relee la ficha antes de guardar), G-27 (el front reconoce "adopción
>   no vigente" leyendo la etiqueta dentro del `message`), G-2 (contrato de `/me` a confirmar: `organismAcronym` nulo,
>   organismo desactivado, 403/404 nuevos) y G-23 (`GET /api/role/allowed` verificado: filtra bien por los flags, no
>   hace falta pedido).
>
> **Deploy a staging (2026-11-19, el mismo día de la auditoría):** al empezar el día staging estaba otra vez atrás de
> `dev` (`origin/staging` @ `7f2a78f`, merge de `dev` @ `58d383a`; `/api-docs` publicaba el contrato anterior: ficha sin
> `url`, `requirements` ni `costs`, `/me` sin `scope`) y OPS-1 se reabrió para estos 13 commits y `V2.31`. **Ese mismo
> día el backend desplegó `dev` en staging:** `origin/staging` = `0a555df` ("Merge branch 'dev' into 'staging'", contiene
> `586b670`) y `/api-docs` de staging ya publica el contrato nuevo (`AuthMeResponseDTO` con `scope`, `organismId`,
> `organismName` y `organismAcronym`; `OrganismProcedureLocationResponseDTO` con `organismProcedureId`, `locationId`,
> `url`, `requirements` y `costs`). **OPS-1 queda cumplido de nuevo.** Solo se verificó el esquema publicado: **todavía
> no se ejecutó ningún flujo** contra ese backend. Los pedidos abiertos no cambian de estado.
>
> **Auditoría 2026-11-16 (historial; esa misma tarde se desplegó `58d383a` en staging, ver OPS-1):** se revisó cada pedido contra el código de `dev` @ `58d383a` (lectura de código y
> migraciones; no se levantó el backend). **Resueltos en `dev` (5), pendientes de deploy a staging:** R-3 (`V2.28` +
> `V2.30`), R-1 (queda un cabo: `PUT` sin `active` → 500), G-14, **G-15** (casts en la consulta de solapamiento) y BO-17
> (con la salvedad de G-13). **Parciales (6):** G-3, G-4, G-6, G-8, G-9 y G-12. **Sin cambios:** G-1, G-2/BO-20, G-13,
> G-5/D-3, G-7, G-10, G-11, G-16, G-17, G-18, G-19 y DOC-1. OPS-1 y OPS-2 no se pueden verificar desde el código.
>
> **Pedidos nuevos (G-20 a G-25)**, todos sobre usuarios, roles y matriz de permisos: no se puede cambiar el rol de un
> usuario existente (G-20), `LocalDate.MAX` en la validación de solapamiento (G-21, sin confirmar en ejecución),
> ADMIN_BACKOFFICE tiene `CREATE_USER` pero no puede asignar roles (G-22), ningún rol es asignable por
> ADMIN_ORGANIZATION (G-23), AGENT conserva por otra vía lo que `V2.30` le quitó (G-24) y textos de error engañosos
> (G-25). Los huecos de matriz de AB y AO se sumaron a G-3 y G-5 en vez de abrir pedidos nuevos.
>
> **Staging no cambió:** `origin/staging` sigue en el merge del 2026-10-17 (más cambios de pipeline). Nada de lo
> resuelto después (R-3, R-1, G-15, `V2.25`–`V2.30`) está online: pasar features a real en staging sigue dependiendo de
> **OPS-1**.
>
> **Contrato nuevo desde la auditoría anterior:** `V2.30` (AGENT pierde `CREATE_ADOPTION` y `DELETE_ADOPTION`) y los
> casts de G-15. El resto de las novedades (`role-assignments`, `GET /api/tag/public`, `V2.29`, `4077`, `4081`, `4091`)
> ya figuraba abajo y se volvió a verificar; el detalle de `role-assignments` está en `BACKEND_API_SPEC.md` §7.0.3.
>
> **Auditoría 2026-11-03 (historial):** se revisó cada pedido contra los 22 commits de `dev` entre `23fd8f9` y `b6f505b`
> (2026-10-16 a 2026-11-03) y contra el resumen que mandó backend el 2026-11-03. **Resueltos (6):** R-3, R-1, G-14,
> BO-17 (con la salvedad de G-13), y del lado del código G-6 §1 (`4080`). **Parciales (6):** G-3, G-4, G-8, G-9, G-12, OPS-1.
> El resto sigue vigente. Backend anunció **G-15** como próximo bloqueo a atacar.
>
> **Staging** (`origin/staging` @ `6c9e83d`) tiene `dev` solo hasta `3b4e61e` (2026-10-17): incluye G-14, PPDT-5.2 y
> `GET /api/user`, pero **no** `V2.28` (R-3), R-1, `V2.27` ni los códigos nuevos. Sondeo 2026-11-03 con SA:
> `/api/user` 200 (con `role: null`), `/api/procedure-template` y `/api/organism-procedure-location` 200 (vacíos),
> `/api/tag`, `/api/organism-procedure` y `/api/attention-point` **403**. El usuario AO de e2e no existe en staging (login 404).
>
> **Novedades no pedidas que el front puede usar:** `POST /api/user/{id}/role-assignments` (asignar rol a un usuario
> existente, con `effectiveFrom`/`effectiveTo`; `4081` si se superpone), `GET /api/tag/public` (sin autenticación),
> `GET /api/procedure/search` ya no da 500 (`V2.29`), y códigos nuevos `4077` (transición inválida, 409) y `4091`
> (edición concurrente, 409).
>
> Historial: la auditoría del 2026-10-16 (contra `23fd8f9`) tenía los 25 pedidos vigentes. Los bloques
> "Estado 2026-11-03" y "Estado 2026-11-16" de cada pedido se conservan; donde algo cambió hay un bloque
> "Estado 2026-11-19" arriba.

El backoffice (Angular) ya consume la API real de organismos, taxonomía, roles, permisos y etiquetas, y está por integrar el núcleo de trámites: plantillas (`/api/procedure-template`), adopciones (`/api/organism-procedure`), fichas por localidad (`/api/organism-procedure-location`, "OTL") y puntos de atención (`/api/attention-point`). En este documento juntamos lo que hace falta corregir o exponer del lado del backend para cerrar esa integración. Cada pedido se verificó contra el código de `origin/dev` @ `23fd8f9` y se volvió a auditar contra `58d383a` y `586b670` (las líneas citadas en los bloques "Estado 2026-11-19", en los bloques "Ampliación 2026-11-19" y en G-26 a G-32 son de `586b670`; las de los bloques "Estado 2026-11-16" y de G-20 a G-25, de `58d383a`; las del cuerpo de los pedidos anteriores, de `23fd8f9`). Las rutas son relativas a `src/main/java/org/silicon/misiones/portal_misiones/` (código) y a `src/main/resources/db/` (migraciones), salvo que se indique otra cosa. Cada ítem está pensado para copiarse tal cual como tarjeta de Taiga.

---

## Resumen

Estado: ✅ resuelto en `dev` · 🟠 parcial · ⬜ pendiente. "En staging" indica si ya se puede probar online
(staging = `origin/staging` @ `0a555df`, que contiene `dev` @ `586b670`; lo que llegó con ese deploy dice "en staging
desde el 2026-11-19": verificado ese día en el esquema de `/api-docs`). "Confirmado en ejecución el 2026-11-20" = lo
ejercitó el e2e de los seis roles contra staging (ver el bloque "E2E 2026-11-20" de la cabecera); "leído en el código,
no ejecutado" = todavía no se probó contra un backend levantado.

| ID | Título | Prioridad | Tipo | Estado (2026-11-20, `dev` @ `586b670`) | Qué desbloquea en el front |
|---|---|---|---|---|---|
| **OPS-1** | Desplegar `dev` en staging (merge `dev` → `staging`) | 🔴 bloquea | ops | ✅ **cumplido de nuevo el 2026-11-19** (`origin/staging` @ `0a555df`, contiene `586b670`; esquema de `/api-docs` verificado ese día; **flujos ejecutados el 2026-11-20**: e2e de los seis roles, 114 casos OK). Historial: cumplido el 2026-11-16 para `58d383a` y reabierto el 2026-11-19 por los 13 commits hasta `586b670` y `V2.31` | Fichas y puntos de atención reales online; organismo en sesión; AO elige plantilla |
| **G-13** | Borrado definitivo de usuario siempre falla (500): FK `RESTRICT` de `user_role_assignments`; además el `UserResponseDTO` llega con `role` y `activeAssignments` en `null` | 🔴 bloquea | bug | ⬜ — `GET /api/user` y `GET /api/user/{id}` siguen mapeando con ModelMapper. Más visible desde PPDT-5.1 (G-26) | "Eliminar definitivamente" de usuarios (BO-3) y rol/organismo en el listado y el detalle |
| **G-20** | No se puede cambiar el rol de un usuario existente: `role-assignments` siempre da 409 `4081` y no hay cómo cerrar una asignación | 🔴 bloquea | bug + feature | ⬜ (backend lo tiene en Taiga, refs 42 y 43) | Asignar o cambiar rol desde el detalle del usuario (BO-24) |
| **G-23** | `assignable_by_org_admin` es `FALSE` para todos los roles: ADMIN_ORGANIZATION no puede crear usuarios ni asignar roles | 🟡 importante | bug (seed) | ⬜ — **confirmado en ejecución el 2026-11-20**: con AO, `GET /api/role/allowed` → 200 `[]` y el alta muestra "No hay roles que puedas asignar" | Alta de usuarios por el administrador del organismo |
| **G-3** | Permisos de lectura para AO y AGENT (`READ_PROCEDURE`, `READ_ADOPTION`) y `READ_ORGANISM` para quien adopta | 🟡 importante | contrato (seed) | 🟠 AO tiene `READ_PROCEDURE` (`V2.31`, `fb13104` · en staging desde el 2026-11-19 · confirmado en ejecución el 2026-11-20); falta `READ_PROCEDURE` para AGENT y `READ_ORGANISM` para AB | AB elige organismo; AGENT ve de qué trámite es cada ficha |
| **G-4** | Transiciones inválidas como 4xx + endpoints "rechazar" y "volver a borrador" | 🟡 importante | bug + feature | 🟠 sin cambios: 409 `4077` y 404 `4073`; faltan `reject` y `return-to-draft`; `BORRADOR → DESPUBLICADO` sigue permitido | Bandeja de revisión completa |
| **G-5 / D-3** | Definir quién publica; AB sin `READ_VARIANT`/`PUBLISH_VARIANT` | 🟡 importante | contrato (seed + doc) | ⬜ sin cambios: AB gestiona puntos de atención pero no llega a la ficha de la que cuelgan. **Confirmado en ejecución el 2026-11-20**: con AB, `GET /api/attention-point` → 200 y `GET /api/organism-procedure-location` → 403 | Bandeja de publicación para AB, puntos de atención para AB y textos de la UI |
| **G-9** | Unicidad de ficha (adopción + localidad) y de slug; cascada de vigencia | 🟡 importante | bug | 🟠 constraints únicas (`V2.27`) y, desde `1888e1a` (en staging desde el 2026-11-19), el portal filtra por vigencia de la adopción; sin validación previa (500 `5000`, sin decir cuál de las dos restricciones falló; **confirmado en ejecución el 2026-11-20** para las dos), slug no único global y sin cascada | Evitar fichas duplicadas; que el estado del backoffice coincida con lo que ve el ciudadano |
| **G-24** | AGENT conserva `UPDATE_ADOPTION` (un `PUT` con `enabled: false` equivale al `DELETE` que `V2.30` le quitó) y el `DELETE` de la ficha exige `UPDATE_VARIANT` | 🟡 importante | bug (autorización) | ⬜ | Que la UI y la API coincidan en qué puede hacer un AGENT |
| **G-7** | Paginación y filtros en los listados | 🟡 importante | feature | 🟠 filtros `?organismProcedureLocationId=` (puntos, `0db49a9`) y `?organismProcedureId=` (fichas, `3797fe7`) · en staging desde el 2026-11-19 · confirmados en ejecución el 2026-11-20; sin paginación ni el resto de los filtros (ver G-29) | Listados con volumen real |
| **G-11** | Adopciones: editar con plantilla desactivada, cascada al desactivar plantilla, filtro por plantilla, `ownerOrganismId` | 🟡 importante | bug + contrato | ⬜ | Editar/deshabilitar adopciones de plantillas inactivas; vista "Organismos que la adoptaron" sin bajar todo |
| **G-12** | Fichas y puntos de atención: workflow sobre inactivas, fichas sobre adopciones no vigentes, `DELETE` sin versión, puntos sobre fichas inactivas | 🟡 importante | bug | 🟠 §1 (404 `4073`) y §3 (adopción no vigente → 404 `4073`, `1888e1a` · en staging desde el 2026-11-19; ver G-27); §2, §4, §5 y §6 sin cambios | Mensajes de error precisos y datos consistentes en fichas y puntos |
| **G-16** | Borrar una categoría, etiqueta o destinatario en uso responde 500 (FK) en vez de 409; lo mismo un permiso asignado a un rol (ampliado el 2026-11-20) | 🟡 importante | bug | ⬜ — leído en el código y en el esquema, **no ejecutado** | Mensaje claro al borrar datos de catálogo en uso |
| **G-26** 🆕 | Cuentas privilegiadas (PPDT-5.1): ADMIN_BACKOFFICE recibe 403 `4029` sobre cuentas SA/AB, pero el listado no dice qué rol tiene cada usuario | 🟡 importante | contrato | ⬜ — el 403 `4029` quedó **confirmado en ejecución el 2026-11-20** (desactivar, cambiar email, baja lógica, baja definitiva y alta con rol SUPERADMIN); el pedido sigue abierto | Ofrecerle a AB solo las acciones de cuenta que el backend le va a aceptar |
| **G-27** 🆕 | Ficha de una adopción no vigente: el `PUT` responde 404 `4073` ("no existe") y no se puede editar; tampoco preparar fichas antes del inicio de vigencia | 🟡 importante | contrato | ⬜ — leído en el código, **no ejecutado** | Mensaje preciso y saber cuándo ofrecer "Agregar localidad" y "Editar" |
| **G-29** 🆕 | `GET /api/attention-point?organismProcedureLocationId=` devuelve solo activos (sin filtro, activos e inactivos) y no hay parámetro para pedir los inactivos | 🟡 importante | contrato | ⬜ — **confirmado en ejecución el 2026-11-20** (con filtro, solo el activo; sin filtro, también el desactivado) | Panel de puntos de atención con "Mostrar inactivos" usando el filtro del servidor |
| **G-31** 🆕 | `PUT /api/user/{id}/change-password` no valida el alcance del actor: quien tenga `UPDATE_USER` cambia la contraseña de cualquier cuenta que no sea SA/AB, también de otro organismo | 🟡 importante | bug (autorización) | ⬜ — leído en el código, **no ejecutado**. Latente: en el seed solo SA y AB tienen `UPDATE_USER` | Poder ofrecer "Cambiar contraseña" por permiso sin abrir un hueco el día que AO reciba `UPDATE_USER` |
| **G-32** 🆕 | Zona horaria de la vigencia: `effective_from/to` (`TIMESTAMPTZ`) viajan como `LocalDateTime` sin zona y se comparan con `LocalDateTime.now()` de la JVM; ni el `Dockerfile` ni la configuración fijan la zona | 🟡 importante | bug + ops | ⬜ — leído en el código, **no ejecutado**; no se sabe en qué zona corre la JVM de staging | Que "vigente" signifique lo mismo en el backoffice, en la API y en el portal |
| **G-34** 🆕 | Enumeración de cuentas en el login: email inexistente → 404 `4023`, contraseña incorrecta → 401 `4016`, cuenta inactiva → 500 `5000` (con cualquier contraseña); `register` → 409 `4002` | 🟡 importante | bug (seguridad) | ⬜ — leído en el código, **no ejecutado** en la corrida del 2026-11-20 (el 404 `4023` y el 500 de la cuenta inactiva sí se vieron en corridas anteriores) | Que el login no le diga a un tercero qué emails tienen cuenta ni en qué estado está cada una |
| **G-33** 🆕 | Bloqueo de login: `BLOCK_DURATION` de un minuto con comentario "5 MIN"; el tiempo restante del `4014` viaja solo dentro del `message`; el `4013` no inicia sesión; y por el orden de los chequeos de Spring una cuenta bloqueada respondería 500 `5000` sin desbloquearse nunca | 🟡 importante (a confirmar) | bug + contrato | ⬜ — leído en el código, **no ejecutado** (`GEN-LOGIN-BLOQ` sin cubrir) | Decirle a la persona cuánto tiene que esperar, y que el bloqueo termine |
| **G-21** | `LocalDate.MAX` como parámetro de la consulta de solapamiento de asignaciones (posible 500 o solapamiento no detectado) | 🔵 a confirmar | bug | ⬜ — **no confirmado en ejecución** | Asignar un rol sin fecha de fin |
| **G-25** | Textos de error engañosos: `4018` para rol inexistente, `4002` para usuario inactivo, contraseña "8 a 30" con máximo real 20 | 🔵 mejora | bug | ⬜ (el `4018` del rol inexistente sigue igual en `586b670`) | Mostrar el mensaje del backend sin traducciones locales |
| **G-28** 🆕 | `slugBase`: el canónico puede quedar vacío (`"¡¡¡"` → `""`) y las plantillas anteriores a `130c180` no se recanonicalizan | 🔵 a confirmar | bug | ⬜ — leído en el código, **no ejecutado** | Slugs de plantilla siempre válidos y únicos |
| **G-30** 🆕 | Usuarios: el 403 `4029` cubre al menos ocho motivos distintos y solo se distinguen por el texto de `details` (dos comparten texto y varios no traen ninguno) | 🔵 mejora | contrato | ⬜ — leído en el código, **no ejecutado** | Marcar el campo correcto del form y explicar el rechazo sin comparar textos |
| **G-35** 🆕 | Guardado de organismo: 409 `4071` sirve para "tipo inactivo" y "superior inactivo", y 404 `4058` para "el organismo editado no existe" y "el superior no existe" | 🔵 mejora | contrato | ⬜ — leído en el código, **no ejecutado** | Marcar el campo correcto del form de organismo sin deducirlo del contexto |
| **G-8** | Endpoint de versiones de la ficha (`otl_versions`) y control de concurrencia | 🔵 mejora | feature | 🟠 sin cambios: `@Version` y handler → 409 `4091`; `lockVersion` no viaja en el contrato (tampoco en el response nuevo de G-1) y falta el endpoint de versiones. El front lo mitiga con un `GET` extra antes de cada `PUT` | Historial de versiones (FR-BACKOFFICE-07) y aviso de edición concurrente |
| **G-17** | ¿AO/AGENT deben ver las etiquetas globales? Hoy `GET /api/tag` les devuelve solo las locales de su organismo | 🔵 decisión | contrato | ⬜ (existe `GET /api/tag/public`, pero no resuelve la decisión) | Etiquetar plantillas/fichas desde un organismo con etiquetas provinciales |
| **G-18** | Excepciones de Spring sin manejar responden 500: id no UUID (→ 400), método no soportado (→ 405), body ilegible (→ 400) | 🔵 mejora | bug | ⬜ (alcanza también a los dos filtros nuevos: un valor que no es UUID → 500) | Errores precisos; no confundir un request inválido con una caída |
| **G-19** | Seed de ejemplo para el núcleo de trámites en `dev` (plantillas, adopción, fichas) | 🔵 mejora | ops | ⬜ | QA y demos sobre una base nueva sin cargar todo a mano |
| **OPS-2** | Purgar en staging los registros de prueba `E2E-*` que la API no permite borrar | 🔵 mejora | ops | ⬜ (no verificable desde el código) | Staging limpio (entorno compartido) |
| **DOC-1** | Corregir `docs/frontend_integration_guide.md` | 🔵 mejora | doc | ⬜ (los commits nuevos actualizaron `docs/architecture/*`, no la guía) | Evitar que otros equipos (portal) integren contra información vieja |
| **G-1** | Response de la ficha (OTL) incompleto y sin filtro por adopción | 🔴 bloquea | contrato | ✅ `3797fe7` · en staging desde el 2026-11-19 · **confirmado en ejecución el 2026-11-20** (sin los nombres ni las fechas "deseables") | Pantallas de fichas por localidad y puntos de atención con datos reales |
| **G-2 / BO-20** | Organismo del usuario en `/api/auth/me` | 🔴 bloquea | contrato | ✅ `d7aca1c` · en staging desde el 2026-11-19 · **confirmado en ejecución el 2026-11-20** con los seis roles | AO adopta trámites; AO/AGENT crean etiquetas locales; preselección de organismo |
| **G-22** | ADMIN_BACKOFFICE tiene `CREATE_USER` pero `role-assignments` le respondía siempre 403 `4029` | 🟡 importante | contrato | ✅ `a69925e` · en staging desde el 2026-11-19 (en la práctica sigue tapado por G-20). Confirmado en ejecución el 2026-11-20: `/api/role/allowed` de AB trae solo roles `assignableByBackoffice` | Saber a quién ofrecerle "Asignar rol" (BO-24) |
| **G-6** | Código `4080` sin mensaje; `4072` responde 400 y no 409 | 🔵 mejora | bug | ✅ `1f51bea` · en staging desde el 2026-11-19 (el mensaje del `4080` ya estaba en staging) · confirmado en ejecución el 2026-11-20 para etiquetas (409 `4072`) | Mensajes de error consistentes sin traducciones locales |
| **G-10** | Plantillas: canonicalizar `slugBase` y precisar el `4073` de catálogos | 🔵 mejora | bug | ✅ `130c180` · en staging desde el 2026-11-19 (casos borde en G-28) | Slugs consistentes entre clientes y errores de catálogo que nombran el id faltante |
| **R-3** | Grants de `V2.20`/`V2.23`/`V2.24` filtran por `ROLE_*` y no matchean ningún rol | 🔴 bloquea | bug | ✅ `V2.28` (`bab0993`) + `V2.30` · en staging desde el 2026-11-16 | Etiquetas, Adopciones y Puntos de atención reales |
| **R-1** | `PUT` de la ficha acepta `publicationStatus` y saltea el workflow | 🔴 bloquea | bug | ✅ `5186ab1` · en staging desde el 2026-11-16 · cabo suelto (`PUT` sin `active` → 500) cerrado en `3797fe7` · en staging desde el 2026-11-19 | Edición segura de fichas |
| **G-15** | Adopciones: `POST`/`PUT /api/organism-procedure` habilitadas responden 500 (consulta de solapamiento con parámetros sin tipo) | 🔴 bloquea | bug | ✅ casts en `findOverlappingEnabled` · en staging desde el 2026-11-16 | Adoptar trámites y editar vigencias (toda la sección "Trámites del organismo") |
| **G-14** | `V2.21` impide arrancar: `ALTER TYPE publication_status` de un tipo que no existe | 🔴 bloquea | bug | ✅ `4a71cfa` · en staging | Levantar `dev` desde cero y desplegar staging |
| **BO-17** | Exponer `GET /api/user` | 🔴 bloquea | feature | ✅ `4715be1` · en staging (sin rol, organismo ni nombre: ver G-13) | Listado de usuarios y acciones de fila reales |

---

## R-3 · Grants de `V2.20`, `V2.23` y `V2.24` sin efecto por el prefijo `ROLE_`

> **Estado 2026-11-16 (`dev` @ `58d383a`):** ✅ **Resuelto en `dev`, pendiente de deploy a staging (OPS-1).**
> `V2.28__grant_missing_module_permissions.sql:13-23` otorga los 12 permisos (`*_ADOPTION`, `*_ATTENTION_POINT`, `*_TAG`)
> a `SUPERADMIN`, `ADMIN_BACKOFFICE`, `ADMIN_ORGANIZATION` y `AGENT`, resolviendo el rol por el código sin prefijo.
> `V2.30__revoke_agent_adoption_management_grants.sql:7-15` le quita a AGENT `CREATE_ADOPTION` y `DELETE_ADOPTION`
> (conserva `READ_ADOPTION` y `UPDATE_ADOPTION`; ver G-24). La query de verificación de abajo devuelve entonces
> **46 filas** (4 roles × 12 − 2), no las 44 de la propuesta original, que no le daba `*_ADOPTION` a AGENT.
>
> **Estado 2026-11-03:** ✅ **Resuelto en `dev`** (`bab0993`, `V2.28__grant_missing_module_permissions.sql`): grants de `*_ADOPTION`, `*_ATTENTION_POINT` y `*_TAG` a SA, AB, AO y AGENT por el código sin prefijo. **No está en staging**: ahí `/api/tag`, `/api/organism-procedure` y `/api/attention-point` siguen en 403 para SA.

> **Actualización 2026-10-15:** reproducido también en `dev` @ `23fd8f9` con base nueva: se aplican las 43
> migraciones (con el parche local de G-14; sin él, el arranque corta en `V2.21`) y ningún rol recibe `*_TAG`, `*_ADOPTION` ni `*_ATTENTION_POINT`. Aplicando los mismos grants con
> `UPPER(code) IN ('SUPERADMIN','ADMIN_BACKOFFICE',…)` (sin prefijo, como `V2.16`/`V2.17`) los endpoints responden 200:
> **el fix propuesto está validado**.

**Prioridad:** 🔴 · **Tipo:** bug

**Problema**
- `V0.0__Initial_Schema.sql:164-169` siembra los roles como `ROLE_SUPERADMIN`, `ROLE_ADMIN_BACKOFFICE`, etc.
- `V0.4__normalize_role_codes.sql:1-5` les quita el prefijo: `REGEXP_REPLACE(UPPER(TRIM(codigo)), '^ROLE_', '')`. Desde entonces los códigos son `SUPERADMIN`, `ADMIN_BACKOFFICE`, `ADMIN_ORGANIZATION`, `AGENT`, `MANAGER` y `USER`.
- `V2.16:6` y `V2.17:3,7` contemplan las dos formas (`UPPER(code) IN ('USER', 'ROLE_USER', …)`).
- En cambio, las tres migraciones nuevas filtran **solo** por la forma vieja:
  - `V2.20__seed_procedure_adoption_permissions.sql:14` → `WHERE roles.code IN ('ROLE_SUPERADMIN', 'ROLE_ADMIN_BACKOFFICE', 'ROLE_ADMIN_ORGANIZATION')`
  - `V2.23__seed_attention_point_permissions.sql:16` → ídem más `'ROLE_AGENT'`
  - `V2.24__seed_tag_permissions.sql:14` → ídem más `'ROLE_AGENT'`
- `MigrationQueryRunner` ordena por versión numérica (`utils/MigrationQueryRunner.java:87-93`), así que `V0.4` siempre corre antes. En una base creada con estas migraciones, **ningún rol recibe `*_ADOPTION`, `*_ATTENTION_POINT` ni `*_TAG`**. Tampoco SUPERADMIN: su "todos los permisos" (`V0.1:49-51`, `V2.9:54-57`) se calculó antes de que existieran estos permisos.
- **A verificar en cada base** (dev, QA, prod), por si alguien los asignó a mano:

```sql
SELECT r.code AS rol, p.code AS permiso
FROM role_permissions rp
JOIN roles r       ON r.id = rp.role_id
JOIN permissions p ON p.id = rp.permission_id
WHERE p.code IN ('CREATE_ADOPTION','READ_ADOPTION','UPDATE_ADOPTION','DELETE_ADOPTION',
                 'CREATE_ATTENTION_POINT','READ_ATTENTION_POINT','UPDATE_ATTENTION_POINT','DELETE_ATTENTION_POINT',
                 'CREATE_TAG','READ_TAG','UPDATE_TAG','DELETE_TAG')
ORDER BY 1, 2;
-- Esperado tras el fix: 3 roles × 4 (ADOPTION) + 4 roles × 4 (ATTENTION_POINT) + 4 roles × 4 (TAG) = 44 filas
```

**Impacto en el front**
- Etiquetas ya está conectada a `/api/tag` y el menú se gatea por `READ_TAG`: **desaparece incluso para SUPERADMIN**.
- Adopciones (`/api/organism-procedure`) y Puntos de atención (`/api/attention-point`) responden 403 para todos.

**Propuesta concreta** — migración nueva `V2.25__fix_role_grants_after_code_normalization.sql`, con el mismo criterio que `V2.16`/`V2.17`:

```sql
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r
JOIN permissions p ON p.code IN ('CREATE_ADOPTION','READ_ADOPTION','UPDATE_ADOPTION','DELETE_ADOPTION')
WHERE UPPER(r.code) IN ('SUPERADMIN','ROLE_SUPERADMIN','ADMIN_BACKOFFICE','ROLE_ADMIN_BACKOFFICE',
                        'ADMIN_ORGANIZATION','ROLE_ADMIN_ORGANIZATION')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r
JOIN permissions p ON p.code IN ('CREATE_ATTENTION_POINT','READ_ATTENTION_POINT','UPDATE_ATTENTION_POINT','DELETE_ATTENTION_POINT',
                                 'CREATE_TAG','READ_TAG','UPDATE_TAG','DELETE_TAG')
WHERE UPPER(r.code) IN ('SUPERADMIN','ROLE_SUPERADMIN','ADMIN_BACKOFFICE','ROLE_ADMIN_BACKOFFICE',
                        'ADMIN_ORGANIZATION','ROLE_ADMIN_ORGANIZATION','AGENT','ROLE_AGENT')
ON CONFLICT DO NOTHING;
```

Sugerencia: si se aprueban G-3 y G-5, sumar esos grants en la misma migración.

**Criterio de aceptación**
- [ ] La query de verificación devuelve las 44 filas esperadas en una base nueva y en las existentes.
- [ ] Con un SUPERADMIN, `GET /api/auth/me` incluye `READ_TAG`, `READ_ADOPTION` y `READ_ATTENTION_POINT`.
- [ ] Con AO y AGENT, `GET /api/tag` responde 200.
- [ ] Hay un test, o queda como convención en `AGENTS.md`, para que las migraciones futuras no filtren roles por `ROLE_*`.

---

## R-1 · El `PUT` de la ficha acepta `publicationStatus`

> **Estado 2026-11-19 (`dev` @ `586b670`):** ✅ **Cabo suelto cerrado en `3797fe7` (en staging desde el 2026-11-19).** El request ahora
> valida `organismProcedureId`, `locationId`, `active` (`@NotNull`) y `slug` (`@NotBlank`)
> (`dto/organismProcedureLocation/OrganismProcedureLocationRequestDTO.java:19-33`), y el controller usa `@Valid` en
> `POST` y `PUT` (`controller/OrganismProcedureLocationController.java:55, 63`): un `PUT` sin `active` responde **400
> `4012`** con el detalle por campo, no 500 (`OrganismProcedureLocationControllerSecurityTest` lo cubre para el `POST`;
> el `PUT` usa el mismo `@Valid`; no ejecutado por el front). El fix
> principal (`5186ab1`) está en staging desde el 2026-11-16. No queda nada pendiente de este pedido.
>
> **Estado 2026-11-16 (`dev` @ `58d383a`):** ✅ **Resuelto en `dev`, pendiente de deploy a staging (OPS-1).** `update`
> (`service/OrganismProcedureLocationService.java:70-88`) ya no toca `publicationStatus`, y `create` (`:42-49`) fuerza
> `BORRADOR`. **Cabo suelto (3.er criterio de aceptación):** el request sigue sin validaciones
> (`dto/organismProcedureLocation/OrganismProcedureLocationRequestDTO.java:17-24`, sin `@NotNull`) y `update` copia
> `active` tal cual (`:80`), así que un `PUT` sin `active` sigue terminando en **500** por la columna `NOT NULL`. Lo
> mismo sin `organismProcedureId` o `locationId` (`findById(null)`). Se resuelve con los `@NotNull` de G-1.
>
> **Estado 2026-11-03:** ✅ **Resuelto en `dev`** (`5186ab1`): `update()` ya no asigna `publicationStatus` y `create()` arranca siempre en `BORRADOR`. El campo sigue en el request DTO por compatibilidad (se ignora). No está en staging.

**Prioridad:** 🔴 · **Tipo:** bug (autorización)

**Problema**
- `service/OrganismProcedureLocationService.java:74` → `existing.setPublicationStatus(request.getPublicationStatus());` copia el estado del request, sin pasar por `isAllowedTransition` (`:109-116`).
- El `PUT` solo exige `UPDATE_VARIANT` (`controller/OrganismProcedureLocationController.java:55-56`), y AGENT lo tiene (`V0.1:81`).
- Resultado: un AGENT puede pasar una ficha a `PUBLICADO` sin revisión ni `PUBLISH_VARIANT`. Contradice `docs/design.md` D-3: "Ningún endpoint acepta un estado destino arbitrario".
- Además, si el request no trae `publicationStatus`, la columna es `NOT NULL` (`V2.12:21`) → **500**. Lo mismo con
  `active`: se copia del request (`:75`), es `NOT NULL` (`V2.12:22`; el `DEFAULT TRUE` no aplica porque JPA manda
  `null` explícito) y el DTO no tiene `@NotNull` → **500**.

**Impacto en el front** — mientras no se corrija, el front reenvía el estado actual en cada `PUT`. Es una mitigación de UI y no protege contra llamadas directas a la API.

**Propuesta concreta**
- En `update`: ignorar `request.publicationStatus` y conservar el estado actual. Solo `transition(...)` cambia el estado.
- Sacar `publicationStatus` de `OrganismProcedureLocationRequestDTO` (o dejarlo deprecado e ignorado). `create` ya lo ignora (`:39`).

**Criterio de aceptación**
- [ ] `PUT` con `publicationStatus: "PUBLICADO"` sobre una ficha en `BORRADOR` → la ficha sigue en `BORRADOR`.
- [ ] `PUT` sin `publicationStatus` → 200, no 500.
- [ ] `PUT` sin `active` → 400 `4012` (o se conserva el valor actual), no 500.
- [ ] Test que lo cubra.

---

## G-1 · Response completo de la ficha por localidad + filtro por adopción

> **Confirmado en ejecución 2026-11-20 (e2e contra staging, backend `586b670`; `e2e/final_runs/fichas_2026-11-19/07_fichas_y_sesion/`).**
> - **Contrato:** la lista y el `GET /{id}` traen `active`, `costs`, `currentVersionNumber`, `id`, `locationId`,
>   `organismProcedureId`, `publicationStatus`, `requirements`, `slug` y `url` (`FS-CON-02`, 5 fichas).
> - **Roundtrip sin pérdida:** editar solo los costos desde la UI (`GET` → `PUT`) deja intactos adopción, localidad,
>   slug, URL, requisitos, `active` y estado; la versión pasa de 1 a 2 (`FS-EDI-01`).
> - **Filtro:** `?organismProcedureId=` responde 200 y devuelve solo las fichas de esa adopción (`FS-CON-03`); con AO y
>   AGENT el listado trae solo las de su organismo (`AO-FIC-01`, `AG-FIC-01`, script 08).
> - **No ejercitado:** el 400 `4012` con `details` por campo (4.º criterio): el front valida antes de enviar.

> **Estado 2026-11-19 (`dev` @ `586b670`):** ✅ **Resuelto en `dev` (`3797fe7`, PPDT-5.6), en staging desde el 2026-11-19
> (OPS-1).**
> - **Response:** `OrganismProcedureLocationResponseDTO` suma `organismProcedureId`, `locationId`, `url`, `requirements`
>   y `costs` (`dto/organismProcedureLocation/OrganismProcedureLocationResponseDTO.java:17-26`; mapeo en
>   `service/OrganismProcedureLocationService.java:196-209`). Vale para `GET /`, `GET /{id}`, `POST`, `PUT` y las tres
>   transiciones (todas pasan por `toResponse`).
> - **Filtro:** `GET /api/organism-procedure-location?organismProcedureId=<uuid>`
>   (`controller/OrganismProcedureLocationController.java:38-44`), combinado con el alcance
>   (`OrganismProcedureLocationService.java:52-70`; `repository/OrganismProcedureLocationRepository.java:40-43`). Sin el
>   parámetro, el listado es el de antes. Una adopción inexistente o de otro organismo devuelve `200` con `[]` (no 404).
>   El listado filtrado incluye las fichas inactivas, igual que el listado sin filtro (G-12 §5).
> - **Validación:** `organismProcedureId`, `locationId`, `active` (`@NotNull`) y `slug` (`@NotBlank`) → 400 `4012`
>   (`OrganismProcedureLocationRequestDTO.java:19-33`). Cierra el cabo suelto de R-1.
> - **No se entregó lo "deseable":** nombres (`procedureTitle`, `organismName`, `locationName`), `procedureTemplateId`,
>   `organismId` y fechas. El front los resuelve por id; para AGENT el título del trámite sigue sin poder resolverse
>   (no tiene `READ_PROCEDURE`, G-3). `lockVersion` tampoco viaja (G-8).
> - **Efecto lateral a tener en cuenta (`1888e1a`):** el `PUT` vuelve a validar la adopción, ahora también su vigencia:
>   ver G-27.
> - Evidencia del backend: `odd/tasks/front-unblocking-contracts.md` (T1; tests de servicio y de controller con
>   MockMvc, incluido el roundtrip `GET` → `PUT` sin pérdida). **El front todavía no lo ejecutó** contra un backend real.
>
> **Estado 2026-11-03:** ⬜ **Pendiente** (backend lo tiene en su lista: "completar el response de OTL y sus filtros").

**Prioridad:** 🔴 · **Tipo:** contrato

**Problema**
- `dto/organismProcedureLocation/OrganismProcedureLocationResponseDTO.java:17-21` solo trae `id, slug, publicationStatus, active, currentVersionNumber`. `toResponse` (`service/OrganismProcedureLocationService.java:170-178`) no mapea nada más.
- El `PUT` es un reemplazo total (`:68-75`). Para editar, el front tiene que reenviar `organismProcedureId`, `locationId`, `url`, `requirements` y `costs`, que **no puede leer de ningún endpoint**. Si los manda vacíos, borra el contenido.
- `GET /` devuelve todas las fichas del alcance, sin filtro (`controller/OrganismProcedureLocationController.java:35-39`).
- El request no tiene validaciones (`OrganismProcedureLocationRequestDTO.java:17-24`, sin `@NotNull`). Si falta un campo NOT NULL, `findById(null)` o la base responden **500** en vez de 400 `4012`.

**Impacto en el front** — las pantallas de fichas (lista, form, detalle y bandeja de revisión) no se pueden conectar. Hoy quedan en mock también en producción.

**Propuesta concreta**

```json
{
  "id": "…", "slug": "licencia-de-conducir-obera",
  "organismProcedureId": "…", "locationId": "…",
  "url": "https://…", "requirements": "…", "costs": "…",
  "publicationStatus": "BORRADOR", "active": true, "currentVersionNumber": 3,
  "procedureTemplateId": "…", "procedureTitle": "Obtener licencia de conducir",
  "organismId": "…", "organismName": "…", "locationName": "Oberá",
  "createdAt": "2026-10-10T12:00:00Z", "updatedAt": "2026-10-12T09:30:00Z"
}
```
- **Obligatorio:** `organismProcedureId`, `locationId`, `url`, `requirements`, `costs`.
- **Deseable:** los nombres (`procedureTitle`, `organismName`, `locationName`) y las fechas, para no resolver N ids en el cliente. Lo mismo vale, como mejora, para `OrganismProcedureResponseDTO` (hoy solo ids).
- `GET /api/organism-procedure-location?organismProcedureId={uuid}`. Es el mismo tipo de filtro que piden G-7 (tabla
  de filtros) y G-11 §3 (adopciones por plantilla): conviene resolverlos juntos.
- `@NotNull` en `organismProcedureId`, `locationId`, `slug` y `active` → 400 `4012`.

**Criterio de aceptación** *(los tres primeros, confirmados en ejecución el 2026-11-20; el cuarto, tildado según el código y los tests de `586b670`)*
- [x] `GET /` y `GET /{id}` devuelven al menos los campos obligatorios. *(confirmado en ejecución, `FS-CON-02`)*
- [x] Un `GET /{id}` seguido de un `PUT` con ese mismo body no pierde contenido (si la adopción sigue vigente: G-27). *(confirmado en ejecución, `FS-EDI-01`)*
- [x] `?organismProcedureId=` filtra, respetando el alcance del usuario. *(confirmado en ejecución, `FS-CON-03`)*
- [x] Un request sin campos obligatorios → 400 `4012` con `details` por campo. *(sin ejecutar)*

---

## G-2 / BO-20 · Organismo del usuario en `/api/auth/me`

> **Confirmado en ejecución 2026-11-20 (e2e contra staging, backend `586b670`; `*-SES-01` en `e2e/final_runs/fichas_2026-11-19/08_roles_fichas_y_sesion/` y
> `FS-CON-01`, `FS-ORG-AO-01`, `FS-ORG-AGENT-01` en el script 07).** `GET /api/auth/me` con el token de cada rol:
>
> | Rol | `scope` | Organismo |
> |---|---|---|
> | SUPERADMIN | `global` | `organismId`, `organismName` y `organismAcronym` en `null` |
> | ADMIN_BACKOFFICE | `global` | `null` |
> | MANAGER | `global` | `null` |
> | USER | `global` | `null` (sin permisos; el front no lo deja entrar al backoffice) |
> | ADMIN_ORGANIZATION | `organismo` | "Silicon Misiones", **`organismAcronym: null`** |
> | AGENT | `organismo` | organismo de muestra, con sigla |
>
> - **Dato confirmado: la sigla es opcional.** El organismo de la cuenta ADMIN_ORGANIZATION de prueba no tiene sigla
>   y `/me` responde `organismAcronym: null` con `organismId` y `organismName` completos. Es el punto 2 de la ampliación
>   de abajo, que deja de ser una lectura del código: el front lo tolera (muestra solo el nombre). Falta que quede
>   escrito en el contrato (criterio abierto).
> - El response trae exactamente `email`, `organismAcronym`, `organismId`, `organismName`, `permissions`, `roles`,
>   `scope` y `userId`.
> - **No ejercitado:** usuario sin asignación vigente (403 `4029`), organismo desactivado y organismo inexistente.

> **Estado 2026-11-19 (`dev` @ `586b670`):** ✅ **Resuelto en `dev` (`d7aca1c`, PPDT-5.2), en staging desde el 2026-11-19
> (OPS-1).** `AuthMeResponseDTO` suma `scope` (`"global"` | `"organismo"`), `organismId`, `organismName` y
> `organismAcronym` (`security/dto/AuthMeResponseDTO.java:21-24`), con la forma de la propuesta de abajo.
> `AuthService.getCurrentAuthContext` (`security/service/AuthService.java:174-195`) los arma con
> `UserService.getCurrentScope()` (`security/service/UserService.java:424-447`):
> - Rol vigente de alcance global (SA, AB, MANAGER y también `USER`, por `V2.17`) → `scope: "global"` y los tres campos
>   de organismo en `null`.
> - Rol de alcance organismo (AO, AGENT) → `scope: "organismo"` con el organismo de la asignación vigente.
> - **Cambio de comportamiento:** `/me` ahora puede responder **403 `4029`** (usuario sin asignación vigente, dos
>   asignaciones igual de prioritarias, o rol de organismo sin organismo) y **404 `4073`** (el organismo de la asignación
>   no existe). Antes devolvía 200 con lo que hubiera en el token. Es lo que pedía el tercer criterio.
> - **No se hizo el punto complementario:** si el request de adopción o de etiqueta local llega sin `organismId`, el
>   backend sigue respondiendo 404 `4073` (no toma el del alcance). Ya no hace falta: el front lo manda desde `/me`.
> - El JWT sigue sin llevar el organismo; la única fuente es `/me`.
> - Evidencia del backend: `odd/tasks/front-unblocking-contracts.md` (T2; `AuthServiceTest`, `AuthControllerTest`).
>   **No ejecutado por el front.** En staging `/me` sigue con los cuatro campos viejos (`/api-docs` del 2026-11-19).
>
> **Estado 2026-11-03:** ⬜ **Pendiente.** `/api/auth/me` sigue devolviendo solo `userId, email, roles, permissions` (verificado en staging). Backend lo tiene en su lista.

> **Ampliación 2026-11-19 — contrato de `/me` a confirmar** (surge de integrar el front contra `586b670`; **leído en el
> código, no ejecutado**). El front ya consume `scope` y el organismo; quedan cuatro puntos que el código responde de
> una forma pero ningún documento ni test fija como contrato:
> 1. **¿`scope: "organismo"` implica siempre `organismId` no nulo?** Según el código, sí: `getCurrentScope`
>    (`security/service/UserService.java:438-446`) responde 403 `4029` si el rol es de organismo y la asignación no
>    tiene organismo, y `AuthService.java:175-184` responde 404 `4073` si no lo encuentra; no hay camino que devuelva
>    `"organismo"` con `organismId: null`. También `organismName` (columna `NOT NULL`, `entity/Organism.java:46-47`).
>    El front lo asume. **Pedimos confirmarlo como invariante** (y un test que lo cubra).
> 2. **`organismAcronym` puede ser `null` con `scope: "organismo"`.** La columna es opcional (`sigla VARCHAR(100)` sin
>    `NOT NULL`, `V1.7__rebuild_organisms.sql:9`; `entity/Organism.java:49-50`). El front lo tolera. Confirmar que es
>    lo esperado.
> 3. **Organismo desactivado: `/me` responde 200 como si nada.** `AuthService.java:177` usa `findById`, sin mirar
>    `active` (`entity/Organism.java:52-53`), y el response no trae el estado del organismo. Un AO o AGENT de un
>    organismo dado de baja (`OrganismService.deleteOrganism`, `service/OrganismService.java:93-97`, es baja lógica)
>    sigue entrando con su alcance completo y el front no tiene cómo avisarle. **A definir:** ¿debe poder operar? Si no,
>    un código propio (no `4029`, que el front no puede distinguir de "sin rol"); si sí, sumar `organismActive` al
>    response para mostrar el aviso.
> 4. **Los 403 `4029` y 404 `4073` de `/me` dejan al usuario sin sesión utilizable**, y no se distinguen entre sí:
>    - 403 `4029` sin `details` cubre tres casos (`UserService.java:427-432, 439-445, 769-775`): sin asignación vigente,
>      dos asignaciones igual de prioritarias, rol de organismo sin organismo. Es además el mismo código de "no tenés
>      permiso" de cualquier endpoint (ver G-30).
>    - 404 `4073` ("El objeto Organism con el identificador … no existe"): en la práctica no debería ocurrir, porque
>      `user_role_assignments.organism_id` tiene FK a `organisms` (`V1.7:54`) y el organismo no se borra físicamente.
>    - **El login no hace esa validación** (`AuthService.login`, `security/service/AuthService.java:65-110`, no llama
>      a `getCurrentScope`; solo lo hacen `/me` y los servicios de trámites y etiquetas): un usuario cuya asignación
>      venció ayer **inicia sesión bien y recibe 403 en `/me`**. El front toma esos dos errores (status y código
>      juntos) como "el alcance ya no existe" y deja la sesión **abierta pero sin organismo**; no puede decirle a la
>      persona por qué no ve nada. **Pedimos:** un código propio para "tu cuenta no tiene un rol vigente" (o
>      rechazarlo ya en el login), y confirmar que un `USER` recién registrado (asignación abierta desde el alta,
>      `UserService.java:177-182`) siempre obtiene 200.
>
> Criterios que se suman abajo.

**Prioridad:** 🔴 · **Tipo:** contrato

**Problema**
- `security/dto/AuthMeResponseDTO.java:17-20` solo trae `userId, email, roles, permissions`. El JWT tampoco lleva el organismo: solo `roles`, `permissions` y `userId` (`security/service/JwtTokenService.java:81-83`).
- El backend sí conoce el organismo: `UserService.getCurrentScope()` (`security/service/UserService.java:333-354`) lo saca de la asignación vigente.
- Para AO, crear una adopción exige mandar `organismId` igual al del alcance. Si no coincide → 404 `4073` (`service/OrganismProcedureService.java:99-104`). Lo mismo pasa con las etiquetas locales (`service/TagService.java:104-110`, `validateScope`).
- La alternativa de leerlo con `GET /api/user/{id}` requiere `READ_USER`, que AGENT no tiene (`V0.1:79-85`).

**Impacto en el front**
- AO no puede adoptar trámites desde la UI.
- AO/AGENT no pueden crear etiquetas locales: el select solo les ofrece "global" y el backend responde `4073`.
- No se puede preseleccionar el organismo en ningún formulario. `getUserOrganismoId()` del front siempre devuelve `null` contra el backend real.

**Propuesta concreta** — extender `AuthMeResponseDTO`:

```json
{
  "userId": "…", "email": "…",
  "roles": ["ROLE_ADMIN_ORGANIZATION"], "permissions": ["READ_TAG", "…"],
  "scope": "organismo",
  "organismId": "…", "organismName": "Dirección General de Rentas", "organismAcronym": "DGR"
}
```
- `scope`: `global` | `organismo`. Con `global`, `organismId` va en `null`.
- Complementario (opcional): con alcance de organismo, si el request de adopción o de etiqueta local viene sin `organismId`, que el backend tome el del alcance en vez de responder 404.

**Criterio de aceptación** *(los dos primeros, confirmados en ejecución el 2026-11-20; el tercero, tildado según el código y los tests de `586b670`)*
- [x] Con AO y AGENT, `/api/auth/me` devuelve `scope: "organismo"` y su `organismId`. *(confirmado en ejecución)*
- [x] Con SA, AB y MANAGER devuelve `scope: "global"` y `organismId: null`. *(confirmado en ejecución; USER también responde `global`)*
- [x] Un usuario sin asignación vigente responde 403 `4029` (en `/me` es nuevo: antes respondía 200). *(sin ejecutar)*
- [ ] *(ampliación 2026-11-19)* Está documentado como invariante que `scope: "organismo"` trae siempre `organismId` y
  `organismName`, y que `organismAcronym` puede ser `null`. *(El comportamiento quedó confirmado en ejecución el
  2026-11-20; el criterio sigue abierto porque pide que esté documentado.)*
- [ ] *(ampliación 2026-11-19)* Está definido qué responde `/me` para un usuario cuyo organismo está desactivado.
- [ ] *(ampliación 2026-11-19)* "Sin rol vigente" llega con un código que el front puede distinguir de "sin permiso"
  (en `/me` o en el login).

---

## BO-17 · Exponer `GET /api/user`

> **Estado 2026-11-16 (`dev` @ `58d383a`):** ✅ **Resuelto** (en `dev` y en staging). `GET /api/user` con `READ_USER`
> (`security/controller/UserController.java:67-76`). Sigue la salvedad: `findAllUserDTO`
> (`security/service/UserService.java:102-113`) mapea con ModelMapper, así que cada usuario llega **sin rol, sin
> organismo y sin nombre** (`UserResponseDTO` no tiene campos de perfil ni de organismo). Ver G-13 y G-20.
>
> **Estado 2026-11-03:** ✅ **Resuelto** (`4715be1`, también en staging): `GET /api/user` con `READ_USER`, filtrado por organismo para AO. **Salvedad:** cada usuario llega con `role: null` y `activeAssignments` vacío (ver G-13), así que el listado todavía no puede mostrar rol ni organismo.

**Prioridad:** 🔴 · **Tipo:** feature

**Problema**
- `security/controller/UserController.java` expone `POST /`, `GET /{id}`, `PUT /{id}`, `DELETE /{id}/admin` y otros, pero **no tiene un listado** (mappings en `:38, 56, 72, 90, 109, 153, 176, 199`).
- El servicio ya existe y está en la interfaz: `IUserService.findAllUserDTO()` (`security/service/abstraction/IUserService.java:24`). Su implementación (`security/service/UserService.java:102-112`) ya filtra por organismo para AO.
- Hoy `GET /api/user` responde **500 `5000`**, no 404/405: el método no soportado cae en el handler genérico (ver G-18).
- `findAllUserDTO` mapea con ModelMapper (`:111`), igual que `findUserDTO` (`:93`): hoy `GET /api/user/{id}` devuelve
  `role: null` y `activeAssignments: null` (ver G-13), y el listado heredaría el mismo problema.
- No tiene tarjeta en `docs/tasks/backlog_taiga.md`.

**Impacto en el front** — el listado de usuarios y sus acciones de fila (desactivar, cambiar email, etc.) siguen en mock.
Sin el rol ni el organismo en el response, el listado tampoco podría mostrar ni filtrar por esas columnas.

**Propuesta concreta**

```java
@GetMapping
@PreAuthorize("hasAuthority('READ_USER')")
public ResponseEntity<ResponseDTO<List<UserResponseDTO>>> getAll() {
    return ResponseEntity.ok(new ResponseDTO<>(2013, utilsCommons.getStatusMessage(2013), userService.findAllUserDTO()));
}
```
Más adelante se puede paginar (ver G-7).

**Criterio de aceptación**
- [ ] SA y AB reciben todos los usuarios. AO recibe solo los de su organismo.
- [ ] Sin `READ_USER` → 403.
- [ ] El response usa el mismo `UserResponseDTO` que `GET /{id}`, con `role`, `activeAssignments` y el organismo
  completos (no `null`; ver G-13).

---

## G-3 · Permisos de lectura para AO y AGENT

> **Confirmado en ejecución 2026-11-20 (e2e contra staging; `e2e/final_runs/fichas_2026-11-19/08_roles_fichas_y_sesion/`).** Con ADMIN_ORGANIZATION,
> `GET /api/procedure-template` → 200 (5 plantillas, las mismas que ve SUPERADMIN: `AO-TRA-03`) y "Adoptar trámite"
> le ofrece esas plantillas con su organismo fijo (`AO-TRA-02`). Con AGENT, `GET /api/organism-procedure` → 200 con
> solo la adopción de su organismo (`AG-TRA-01`). Lo que sigue faltando no cambió: la cuenta AGENT de prueba no tiene
> `READ_PROCEDURE` (sus 15 permisos figuran en `FS-ORG-AGENT-03`) y ADMIN_BACKOFFICE no tiene `READ_ORGANISM`.

> **Estado 2026-11-19 (`dev` @ `586b670`):** 🟠 **Parcial, con avance (`fb13104`, PPDT-5.4; en staging desde el 2026-11-19).**
> `V2.31__grant_organization_template_read.sql:1-6` otorga `READ_PROCEDURE` a `ADMIN_ORGANIZATION` (por el código con y
> sin prefijo). Con eso AO puede listar y consultar plantillas para adoptar; no las puede crear, editar ni desactivar.
> **Sigue faltando:**
> - **`READ_PROCEDURE` para AGENT:** `V2.31` filtra solo `ADMIN_ORGANIZATION`, y su test
>   (`OrganizationTemplateReadPermissionMigrationTest`) verifica a propósito que AGENT y USER quedan sin el permiso.
>   AGENT ve fichas y adopciones, pero no el título del trámite (el response de la ficha tampoco lo trae: G-1).
> - **`READ_ORGANISM` para AB:** ninguna migración se lo da. AB sigue sin poder elegir organismo al adoptar ni al crear
>   un usuario con rol de organismo. Para AO dejó de hacer falta: su organismo llega en `/api/auth/me` (G-2).
> - `docs/architecture/07_roles_flujo_y_demo.md` del backend lista como pendiente "Validación de permisos efectivos de
>   AO y AGENT".
>
> **Estado 2026-11-16 (`dev` @ `58d383a`):** 🟠 **Parcial.** AO tiene los cuatro `*_ADOPTION`; AGENT, `READ_ADOPTION` y
> `UPDATE_ADOPTION` (`V2.28` + `V2.30`). **Sigue faltando `READ_PROCEDURE` para AO y AGENT:** ninguna migración
> posterior a `V2.9` lo otorga. Se suma un hueco del mismo tipo, **`READ_ORGANISM`** (ver "Ampliación 2026-11-16").
>
> **Estado 2026-11-03:** 🟠 **Parcial.** `V2.28` asigna `READ_ADOPTION` también a AO y AGENT. Falta `READ_PROCEDURE` para AO y AGENT (no aparece en ninguna migración nueva). Backend: "verificar permisos de lectura para AO y AGENT".

**Prioridad:** 🟡 · **Tipo:** contrato (seed) — requiere confirmación de producto

**Problema** — seed vigente (`V0.1:53-92`, `V2.9:54-70`, `V2.20`):

| Permiso | SA | AB | AO | AGENT | MANAGER |
|---|---|---|---|---|---|
| `READ_PROCEDURE` | ✓ | ✓ | ✓ (`V2.31`; antes ✗) | **✗** | ✓ |
| `READ_ADOPTION` (`V2.28`) | ✓ | ✓ | ✓ | ✓ | ✗ |
| `READ_VARIANT` | ✓ | **✗** | ✓ | ✓ | ✓ |
| `READ_ORGANISM` | ✓ | **✗** | **✗** | ✗ | ✗ |

- AO puede crear adopciones (`CREATE_ADOPTION`) pero **no puede listar plantillas** (`GET /api/procedure-template` exige `READ_PROCEDURE`, `controller/ProcedureTemplateController.java:35-36`), así que no tiene cómo elegir qué adoptar.
- AGENT edita fichas pero no puede ver la adopción ni la plantilla a la que pertenecen.

**Impacto en el front** — el diálogo "Adoptar" queda inutilizable para AO, y AGENT ve fichas sin título de trámite. G-1 con nombres mitiga esto último.

**Propuesta concreta** — si producto lo confirma, sumar a la migración de R-3:
- AO: `READ_PROCEDURE`.
- AGENT: `READ_PROCEDURE` y `READ_ADOPTION`.

Las plantillas son globales, así que dar lectura no expone datos de otros organismos. Las adopciones ya se filtran por alcance (`service/OrganismProcedureService.java:60-62`).

**Ampliación 2026-11-16 — `READ_ORGANISM` solo lo tiene SUPERADMIN**
- `GET /api/organism` y `GET /api/organism/{id}` exigen `READ_ORGANISM` (`controller/OrganismController.java:38-39,
  49-50`). El seed se lo da solo a SUPERADMIN: `V0.1_permissions_standard_seed.sql:53-62` (AB) y `:64-76` (AO) no
  incluyen ningún permiso de organismo, y `V2.9:59-70` tampoco.
- **AB** tiene `CREATE_ADOPTION` y alcance global: para adoptar tiene que mandar `organismId`
  (`service/OrganismProcedureService.java:99-104`), pero no puede listar organismos para elegirlo. Lo mismo al crear un
  usuario con rol de organismo (`CREATE_USER`, `organizationId` obligatorio: `security/service/UserService.java:631-642`).
- **AO** no necesita la lista si se resuelve G-2 (su organismo en `/api/auth/me`); sin G-2, tampoco tiene cómo conocer
  su propio `organismId`.
- Pedido: `READ_ORGANISM` para AB (y para AO si G-2 no sale), o un endpoint acotado de organismos "seleccionables".

**Criterio de aceptación**
- [x] Con AO, `GET /api/procedure-template` → 200 (`V2.31`; confirmado en ejecución el 2026-11-20, `AO-TRA-03`).
- [x] Con AGENT, `GET /api/organism-procedure` → 200, solo las de su organismo (`V2.28`; confirmado en ejecución el 2026-11-20, `AG-TRA-01`).
- [ ] Con AGENT, `GET /api/procedure-template/{id}` → 200 (para mostrar el título del trámite de cada ficha).
- [ ] Con AB, `GET /api/organism` → 200 (o existe un endpoint equivalente para elegir organismo al adoptar).

---

## G-4 · Transiciones de la ficha: errores 4xx y endpoints faltantes

> **Estado 2026-11-16 (`dev` @ `58d383a`):** 🟠 **Parcial, sin cambios desde el 2026-11-03.** Transición inválida → 409
> `4077` (`service/OrganismProcedureLocationService.java:93-95`); "no existe" → 404 `4073` (`:136-165`). El controller
> sigue con `submit-review`, `publish` y `unpublish` (`controller/OrganismProcedureLocationController.java:62-81`): **no
> hay `reject` ni `return-to-draft`**, aunque el mapa admite `EN_REVISION → BORRADOR` y `DESPUBLICADO → BORRADOR`
> (`:117, 119`). `BORRADOR → DESPUBLICADO` sigue permitido (`:116`). **El código real de transición inválida es `4077`**:
> donde la propuesta y los criterios de abajo dicen `4081`, leer `4077` (`4081` quedó para asignaciones de rol
> superpuestas, G-20).
>
> **Estado 2026-11-03:** 🟠 **Parcial** (`5186ab1`): transición inválida → **409 `4077`** ("La transición de publicación solicitada no es válida desde el estado actual."); ficha, adopción o localidad inexistente o fuera de alcance → **404 `4073`**. Faltan los endpoints `reject` y `return-to-draft` (backend lo tiene en su lista). El punto 3 (`BORRADOR → DESPUBLICADO`) sigue sin respuesta. Nota: el código usado fue `4077`, no el `4081` propuesto; el `4081` quedó para asignaciones de rol superpuestas.

**Prioridad:** 🟡 · **Tipo:** bug + feature

**Problema**
1. **Las transiciones inválidas y los "no existe" responden 500.** `transition` lanza `IllegalArgumentException("Invalid publication transition")` (`service/OrganismProcedureLocationService.java:88-90`), que el handler genérico convierte en **500 `5000`** (`exception/GlobalExceptionHandler.java:99-106`). Pasa lo mismo con "ficha no encontrada o fuera de alcance" (`loadOrganismProcedureLocation`, `:142-150`), "adopción no encontrada" (`loadOrganismProcedure`, `:131-140`) y "localidad no encontrada" (`loadLocation`, `:152-155`): el front no puede decir "esa ficha no existe" (G-12 §1 remite acá). Contradice `docs/design.md` D-9 y el criterio de PPDT-5.6 (`docs/tasks/backlog_taiga.md:247`).
2. **Hay transiciones permitidas sin endpoint.** El mapa (`:109-116`) admite `EN_REVISION → BORRADOR` y `DESPUBLICADO → BORRADOR`, pero el controller solo expone `submit-review`, `publish` y `unpublish` (`controller/OrganismProcedureLocationController.java:62-81`). No hay forma de **rechazar** una ficha en revisión ni de volver a borrador una despublicada.
3. **A confirmar:** el mapa permite `BORRADOR → DESPUBLICADO` vía `unpublish` (`:111`). ¿Es intencional?

**Impacto en el front** — un 500 genérico no le dice al usuario qué pasó; hoy los textos son prudentes ("no se pudo completar la acción"). La bandeja de revisión no puede ofrecer "Rechazar".

**Propuesta concreta**
- Transición inválida → **409** con código nuevo: `"No se puede pasar la ficha de %s a %s."`. *(Hecho con el código `4077` y un mensaje fijo, sin los estados; la propuesta original sugería `4081`.)*
- Ficha, adopción o localidad inexistente o fuera de alcance → **404 `4073`**, como en `OrganismProcedureService` y `AttentionPointService`.
- Endpoints nuevos:
  - `POST /api/organism-procedure-location/{id}/reject` — `PUBLISH_VARIANT` — body `{ "reason": "Falta el costo del sellado" }` → `EN_REVISION → BORRADOR`. El motivo se guarda (en `otl_versions` o en `audit_events`) y se devuelve.
  - `POST /api/organism-procedure-location/{id}/return-to-draft` — `UPDATE_VARIANT` → `DESPUBLICADO → BORRADOR`.

**Criterio de aceptación**
- [x] `publish` sobre una ficha en `BORRADOR` → 409 `4077` con mensaje legible (el criterio original decía `4081`).
- [x] `GET /{id}` de una ficha de otro organismo (con AO) → 404 `4073`, no 500. *(confirmado en ejecución el 2026-11-20 con AO y con AGENT: `AO-FIC-01`, `AO-FIC-06`, `AG-FIC-01`, `AG-FIC-06`)*
- [x] `GET`/`PUT /api/organism-procedure-location/<uuid-inexistente>`, y un `POST`/`PUT` con adopción o localidad inexistente → 404 `4073`.
- [ ] `reject` y `return-to-draft` funcionan, generan versión y respetan el alcance.
- [ ] Tests de workflow para cada transición inválida.

---

## G-5 / D-3 · Quién publica: definición y seed de AB

> **Confirmado en ejecución 2026-11-20 (e2e contra staging, backend `586b670`; `AB-FIC-01`, `AB-FIC-02` y `AB-NAV-01`
> en `e2e/final_runs/fichas_2026-11-19/08_roles_fichas_y_sesion/`).** Con el token de ADMIN_BACKOFFICE, `GET /api/attention-point` → **200** (los 7 puntos de
> staging) y `GET /api/organism-procedure-location` → **403**. Su menú no tiene "Fichas por localidad" (sí "Plantillas
> provinciales" y "Trámites del organismo"), y los puntos de atención solo se gestionan desde el panel de la ficha:
> **AB tiene `*_ATTENTION_POINT` sin ninguna pantalla donde usarlos.** Sigue pendiente la misma decisión: o AB recibe
> `READ_VARIANT` (y se define si publica), o se le quitan los `*_ATTENTION_POINT`.

> **Estado 2026-11-16 (`dev` @ `58d383a`):** ⬜ **Pendiente, y más visible que antes.** `V2.28` le dio a AB los cuatro
> `*_ATTENTION_POINT` y los cuatro `*_ADOPTION`, pero AB sigue sin `READ_VARIANT` (ninguna migración se lo otorga). Los
> puntos de atención cuelgan de la ficha (`organismProcedureLocationId` obligatorio,
> `service/AttentionPointService.java:75-82`) y las fichas solo se leen con `READ_VARIANT`
> (`controller/OrganismProcedureLocationController.java:35-45`): **AB puede gestionar puntos de atención por API pero
> no tiene cómo llegar a la ficha de la que cuelgan**, ni ver las fichas de las adopciones que crea. Hay que decidir
> junto con D-3: o AB recibe `READ_VARIANT` (y se define si publica), o se le quitan los `*_ATTENTION_POINT`.

**Prioridad:** 🟡 · **Tipo:** contrato (seed + doc)

**Problema**
- La documentación del backend se contradice:
  - `docs/tasks/backlog_taiga.md:229,241` da D-3 por resuelta: "`ADMIN_ORGANIZATION` publica dentro de su organismo y `ADMIN_BACKOFFICE` publica fichas provinciales".
  - `docs/design.md:120` la sigue marcando **[ABIERTA]**.
- El código decide solo por permiso (`PUBLISH_VARIANT`, `controller/OrganismProcedureLocationController.java:69-81`), pero AB **no tiene `PUBLISH_VARIANT` ni `READ_VARIANT`** (`V0.1:53-62`, `V2.9:59-70`). Con el seed actual, AB no ve ni publica ninguna ficha.
- "Ficha provincial" no está modelada: ningún campo de la OTL ni de la adopción la distingue. ¿Es una adopción cuyo `organismId` es un organismo provincial? ¿Se usa `ownerOrganismId`?
- AB tiene alcance global (`V2.17:3`). Si recibe `PUBLISH_VARIANT`, podría publicar fichas de **cualquier** organismo, no solo las provinciales.

**Impacto en el front** — el front decide todo por permiso, así que se adapta a lo que diga el seed. Lo que falta es saber qué textos mostrar y si AB tiene bandeja de publicación.

**Propuesta concreta**
1. Cerrar D-3 por escrito y actualizar `docs/design.md`.
2. Si AB publica, sumar `READ_VARIANT` y `PUBLISH_VARIANT` a AB en la migración de R-3.
3. Si AB solo publica las "provinciales", definir el criterio y aplicarlo en `transition` (con 403 `4029` fuera del criterio).

**Criterio de aceptación**
- [ ] D-3 figura como resuelta en `design.md` y en el backlog, con el mismo texto.
- [ ] El seed refleja la decisión y se puede verificar con la query de R-3 (cambiando los códigos).
- [ ] Si hay restricción de "provincial", un test cubre el caso de AB sobre una ficha no provincial.
- [ ] La matriz de AB queda coherente: si conserva `*_ATTENTION_POINT`, tiene `READ_VARIANT`; si no, no los tiene.

---

## G-9 · Unicidad de fichas y de slug; cascada de vigencia

> **Confirmado en ejecución 2026-11-20 (e2e contra staging, backend `586b670`; `e2e/final_runs/fichas_2026-11-19/07_fichas_y_sesion/`).** Lo que la
> ampliación de abajo leyó en el código se reprodujo para las dos restricciones de `V2.27`:
> - **(adopción, localidad)** — `FS-DUP-03`, por API: `POST /api/organism-procedure-location` con una adopción y una
>   localidad que ya tienen ficha → **500**, body `{"code": 5000, "message": "Ocurrió un error inesperado. Contacte al
>   administrador.", "details": null}`. Es una de las 3 FALLA de la corrida (se esperaba 409 `4072`).
> - **(slug, adopción)** — `FS-DUP-02`, por la UI: un slug tomado después de abrir el alta → mismo `POST`, mismo
>   **500 `5000`** con `details: null`. El caso figura OK porque el front lo absorbe con su texto ("Puede que esa
>   localidad ya tenga una ficha de este trámite (activa o desactivada) o que el slug ya esté en uso…",
>   `screenshots/005_FS-DUP-02_carrera_resultado.png`); el hallazgo de backend quedó registrado igual.
> - Los dos bodies son idénticos: confirmado que el cliente no puede saber cuál de las dos restricciones falló.
> - En la misma corrida, el duplicado de **etiqueta** respondió 409 `4072` (`FS-ETI-01`): las fichas siguen siendo el
>   único recurso con este hueco.

> **Ampliación 2026-11-19 — el duplicado sigue en 500 y el front no sabe cuál de las dos restricciones falló**
> (surge de integrar el front contra `586b670`; **leído en el código, no ejecutado**).
> - **Sigue igual en `586b670`:** `create` (`service/OrganismProcedureLocationService.java:43-50`) y `update`
>   (`:80-98`) hacen `saveAndFlush` sin consultar duplicados y sin capturar `DataIntegrityViolationException`; el único
>   handler que la recibe es el genérico (`exception/GlobalExceptionHandler.java:99-110`) → **500 `5000`** con
>   `details: null`. En `src/main` solo la capturan `CategoryService` (`:53, 114`) y `OrganismService` (`:64, 86`).
> - **Quedó como el único recurso del backoffice con este hueco.** Desde `1f51bea` (G-6) los duplicados de plantillas,
>   etiquetas, categorías, modalidades, hechos de vida y destinatarios responden **409 `4072`** con el nombre del objeto
>   y el identificador; las fichas, 500.
> - **Las dos restricciones de `V2.27` (`:1-7`) son indistinguibles para el cliente:** `uk_otl_procedure_location`
>   (adopción + localidad) y `uk_otl_procedure_slug` (slug + adopción) llegan con el mismo body. El front no puede
>   marcar el campo que hay que corregir (localidad o slug): muestra un único texto que nombra las dos posibilidades, y
>   además tiene que tratar **todo** `5000` del guardado de una ficha como "posible duplicado", aunque sea una caída real.
> - **El front no puede prevenirlo del todo:** valida contra las fichas que ya listó, pero no ve las creadas después de
>   abrir el form ni las que quedan fuera de su alcance, y las fichas **desactivadas** también ocupan el par (las
>   constraints no son parciales). También aplica al `PUT` cuando cambia el slug o la localidad.
> - **Pedido concreto (reemplaza al "409 con código propio" de la propuesta de abajo):** validar antes de guardar (y
>   capturar la violación por si dos requests llegan juntos) y responder **409 `4072`**, como el resto de los recursos,
>   de modo que se pueda saber cuál fue: `%s` = "OrganismProcedureLocation" con el `locationId` para el par
>   adopción + localidad, y `%s` = "Slug" con el slug para el otro; o dos códigos distintos. Criterios sumados abajo.

> **Estado 2026-11-19 (`dev` @ `586b670`):** 🟠 **Parcial, con avance (`1888e1a`, PPDT-5.6; en staging desde el 2026-11-19).**
> - **Hecho — vigencia en las consultas públicas** (4.º criterio y último punto de la propuesta): el detalle
>   (`findPublishedBySlug`, `repository/OrganismProcedureLocationRepository.java:32-33`) y la búsqueda
>   (`repository/ProcedureSearchSpecification.java:38-41`, la que usa `ProcedureService.search`; también
>   `SEARCH_PREDICATES`, `OrganismProcedureLocationRepository.java:58-59`) exigen `effectiveFrom <= ahora` y
>   `effectiveTo` nulo o posterior. Una adopción vencida o que todavía no empezó ya no aparece en
>   `/api/procedure/search` ni en `/api/procedure/{slug}`. Cubierto por `ProcedureServiceTest`; no ejecutado por el front.
> - **Sigue faltando — cascada:** deshabilitar o vencer una adopción no toca sus fichas, que siguen figurando
>   `PUBLICADO` en el backoffice aunque el portal ya no las muestre. Backend lo dejó fuera a propósito
>   (`odd/tasks/claudinio-otl-validity.md`: "Do not implement adoption-to-OTL cascade behavior in this slice; that
>   remains a separate product decision").
> - **Sigue faltando — validación previa de duplicados** (una violación de `uk_otl_*` sale como 500) **y slug único
>   global:** sin cambios respecto del bloque de abajo.
> - **A confirmar (menor):** el detalle compara contra `CURRENT_TIMESTAMP` (reloj y zona de la base) y la búsqueda
>   contra `LocalDateTime.now()` (reloj y zona de la JVM). Si las zonas difieren, una adopción que empieza o vence puede
>   aparecer en una consulta y no en la otra durante esa diferencia. No verificado en ejecución. El problema de fondo
>   (ninguna zona fijada, fechas sin zona en el contrato) quedó como **G-32**.
>
> **Estado 2026-11-16 (`dev` @ `58d383a`):** 🟠 **Parcial.** `V2.27__add_organism_procedure_location_constraints.sql:1-7`
> agrega `uk_otl_procedure_location` `UNIQUE (organism_procedure_id, location_id)` y `uk_otl_procedure_slug`
> `UNIQUE (slug, organism_procedure_id)`. Falta:
> - **Validación previa:** `create` y `update` (`service/OrganismProcedureLocationService.java:42-49, 70-88`) hacen
>   `saveAndFlush` sin consultar duplicados ni capturar `DataIntegrityViolationException`; el handler no la contempla
>   (`exception/GlobalExceptionHandler.java:99-110`). Una violación de esas constraints sale como **500 `5000`** (leído en
>   el código, no ejecutado).
> - **Slug único global:** el UK es por adopción, pero la ruta pública sigue resolviendo solo por slug
>   (`repository/OrganismProcedureLocationRepository.java:20-34`, `findPublishedBySlug` devuelve `Optional`). Dos fichas
>   publicadas de adopciones distintas con el mismo slug siguen rompiendo `GET /api/procedure/{slug}` (punto 2 de abajo).
> - **Las constraints incluyen las fichas inactivas** (no son índices parciales `WHERE active`): una ficha desactivada
>   sigue ocupando su par adopción + localidad, y no hay endpoint para reactivarla salvo el `PUT` con `active: true`.
> - **Cascada de vigencia:** sin cambios (`OrganismProcedureService.update`/`delete`, `:71-97`, no tocan las fichas; las
>   consultas públicas siguen sin filtrar por vigencia, `OrganismProcedureLocationRepository.java:28-32, 47-51`).
>
> **Estado 2026-11-03:** 🟠 **Parcial** (`965fb21`, `V2.27`): `UNIQUE (organism_procedure_id, location_id)` y `UNIQUE (slug, organism_procedure_id)` en fichas. Falta la cascada de vigencia (backend lo tiene en su lista). Sin verificar qué status devuelve hoy una violación de esas constraints (si no se maneja, sería 500).

**Prioridad:** 🟡 · **Tipo:** bug (integridad)

**Problema**
1. **Sin unicidad.** `organism_procedure_locations` (`V2.12:13-25`) no tiene UNIQUE de `(organism_procedure_id, location_id)` ni de `slug`, y ninguna migración posterior lo agrega. Son criterios de aceptación de PPDT-5.6 que no se implementaron (`docs/tasks/backlog_taiga.md:248,250`).
2. **Slug duplicado rompe la ficha pública.** `findPublishedBySlug` devuelve `Optional` (`repository/OrganismProcedureLocationRepository.java:20-34`). Si hay dos fichas publicadas con el mismo slug, Spring lanza `IncorrectResultSizeDataAccessException` → 500 en `GET /api/procedure/{slug}` (`service/ProcedureService.java:79-81`). Además, el UK propuesto en el backlog, `(slug, organism_procedure_id)`, no alcanza: la ruta pública resuelve solo por slug.
3. **Vigencia.**
   - El criterio "cerrar `effective_to` marca las OTL activas como `despublicado`" (`docs/tasks/backlog_taiga.md:215`) no está implementado. `OrganismProcedureService.update`/`delete` (`:72-97`) no tocan las fichas.
   - La búsqueda y el detalle públicos filtran `op.enabled = true` pero **no la vigencia** (`repository/OrganismProcedureLocationRepository.java:28-32` y `SEARCH_PREDICATES :48-51`). Una adopción vencida sigue publicada.
   - Una adopción deshabilitada se oculta en el portal por ese filtro, pero sus fichas siguen figurando como `PUBLICADO` en el backoffice.
   - Relacionado: G-12 §3 pide además impedir **crear** fichas sobre adopciones deshabilitadas o vencidas. Este punto
     cubre las fichas que ya existen; conviene resolver los dos juntos.

**Impacto en el front** — el front no puede impedir duplicados de forma confiable, porque tendría que listar todo. Además, el estado que muestra el backoffice no coincide con lo que ve el ciudadano.

**Propuesta concreta**

```sql
-- V2.26: antes, detectar duplicados existentes
SELECT organism_procedure_id, location_id, COUNT(*) FROM organism_procedure_locations
WHERE active GROUP BY 1, 2 HAVING COUNT(*) > 1;
SELECT slug, COUNT(*) FROM organism_procedure_locations WHERE active GROUP BY 1 HAVING COUNT(*) > 1;

CREATE UNIQUE INDEX uk_otl_adoption_location_active
    ON organism_procedure_locations (organism_procedure_id, location_id) WHERE active = true;
CREATE UNIQUE INDEX uk_otl_slug_active
    ON organism_procedure_locations (slug) WHERE active = true;
```
- Validar antes de guardar y responder **409** con código propio (o `4072` con `%s` = "Ficha"/"Slug"), nunca el error de constraint.
- Cascada: al deshabilitar una adopción o cerrar su `effective_to`, pasar sus fichas `PUBLICADO → DESPUBLICADO` y generar versión.
- Agregar a las queries públicas `op.effectiveFrom <= :now and (op.effectiveTo is null or op.effectiveTo > :now)`. Esto cubre el vencimiento por paso del tiempo, que ningún evento dispara.

**Criterio de aceptación**
- [ ] Crear una segunda ficha activa para la misma adopción y localidad → 409. *(2026-11-20, en ejecución: hoy 500 `5000`, `FS-DUP-03`)*
- [ ] Crear una ficha con un slug activo ya usado → 409. *(2026-11-20, en ejecución: hoy 500 `5000`, `FS-DUP-02`)*
- [ ] *(ampliación 2026-11-19)* Los dos 409 se distinguen entre sí por el código o por un campo estructurado (no solo
  por el texto), y ninguno llega como 500 `5000`. Vale también para el `PUT` que cambia slug o localidad.
- [ ] *(ampliación 2026-11-19)* Test de servicio o de integración que cubra las dos violaciones de `V2.27`.
- [ ] Deshabilitar una adopción → sus fichas publicadas quedan `DESPUBLICADO`, con versión nueva.
- [x] Una adopción con `effectiveTo` en el pasado no aparece en `/api/procedure/search` ni en `/api/procedure/{slug}` (`1888e1a`; verificar en ejecución).

---

## G-7 · Paginación y filtros en los listados

> **Estado 2026-11-19 (`dev` @ `586b670`):** 🟠 **Parcial (en staging desde el 2026-11-19).** De la tabla de filtros de abajo salieron dos:
> - `GET /api/attention-point?organismProcedureLocationId=<uuid>` (`0db49a9`;
>   `controller/AttentionPointController.java:34-39`, `service/AttentionPointService.java:44-59`), dentro del alcance
>   (`repository/AttentionPointRepository.java:13-16`). Era "el más urgente". **Ojo:** con el filtro devuelve **solo los
>   activos**; sin el filtro, activos e inactivos, como antes. Ver G-29.
> - `GET /api/organism-procedure-location?organismProcedureId=<uuid>` (`3797fe7`, ver G-1).
>
> En los dos, un id inexistente o fuera de alcance devuelve `200` con `[]`, y un valor que no es UUID cae en el 500 de
> G-18. **Sigue faltando:** la paginación (backend la dejó explícitamente fuera:
> `odd/tasks/claudinio-attention-point-filter.md`), `active` en puntos de atención, `locationId` / `publicationStatus` /
> `active` en fichas, y todos los filtros de adopciones, plantillas y usuarios (incluye G-11 §3). Los cuatro listados
> siguen devolviendo `List<T>` completa.

**Prioridad:** 🟡 · **Tipo:** feature

**Problema** — los `GET /` de los cuatro controllers devuelven `List<T>` completa, sin parámetros:
- `ProcedureTemplateController.java:35`
- `OrganismProcedureController.java:35`
- `OrganismProcedureLocationController.java:35`
- `AttentionPointController.java:33`

Además:
- Puntos de atención: `AttentionPointService.getAll` (`:39-46`) trae **todos** los del alcance, sin filtro por ficha.
- Plantillas: solo lista las activas (`ProcedureTemplateService.java:65-66`).
- Adopciones: solo lista las habilitadas (`OrganismProcedureService.java:61-62`).
- No hay forma de ver ni reactivar las inactivas.

**Impacto en el front** — el panel de puntos de atención de una ficha tiene que bajar y filtrar todos los puntos del organismo. Todos los listados paginan y filtran en el cliente, lo que no escala.

**Propuesta concreta** — reutilizar el `PaginationResponse` que ya usa `/api/procedure/search`, con `page`, `size`, `sort` y `direction`, más estos filtros:

| Endpoint | Filtros |
|---|---|
| `/api/attention-point` | **`organismProcedureLocationId`** (el más urgente), `active` |
| `/api/organism-procedure-location` | `organismProcedureId` (ver G-1), `locationId`, `publicationStatus`, `active` |
| `/api/organism-procedure` | `procedureTemplateId` (ver G-11 §3), `organismId`, `includeDisabled` |
| `/api/procedure-template` | `q` (título o slug), `categoryId`, `includeInactive` |
| `/api/user` (BO-17) | `q`, `organismId`, `roleCode` |

**Criterio de aceptación**
- [x] `GET /api/attention-point?organismProcedureLocationId=…` devuelve solo los puntos de esa ficha, respetando el alcance (`0db49a9`; solo los activos: G-29). *(confirmado en ejecución el 2026-11-20 junto con `?organismProcedureId=`: `FS-CON-03`, `FS-PUN-04`)*
- [x] Sin parámetros, los endpoints mantienen el comportamiento actual (compatibilidad), o el cambio de contrato se avisa con anticipación.
- [ ] Paginación (`page`, `size`, `sort`, `direction`) y el resto de los filtros de la tabla.

---

## G-6 · Mensaje del `4080` y status del `4072`

> **Confirmado en ejecución 2026-11-20 (e2e contra staging; `FS-ETI-01` en `e2e/final_runs/fichas_2026-11-19/07_fichas_y_sesion/`).**
> `POST /api/tag` con un slug repetido en el mismo alcance → **409 `4072`**; el front lo marca en el campo. Solo se
> ejercitó el de etiquetas: los demás recursos (plantillas, categorías, modalidades, hechos de vida, destinatarios)
> siguen verificados por lectura del código. El de fichas no responde `4072`: ver G-9.

> **Estado 2026-11-19 (`dev` @ `586b670`):** ✅ **Resuelto en `dev` (`1f51bea`, PPDT-5.6), en staging desde el 2026-11-19
> (OPS-1).** El `4072` responde **409** en todos los servicios que lo usan para duplicados:
> `ProcedureTemplateService.java:104`, `TagService.java:74, 82, 132`, `CategoryService.java:35, 54, 91, 115`,
> `ModalityService.java:32, 69`, `LifeEventService.java:106, 114` y `RecipientService.java:32, 68`. El código y el
> mensaje no cambiaron (`messages/messages.properties:104`). El `4080` ya tenía mensaje (en staging desde el
> 2026-11-16). Quedó sin hacer el test opcional de consistencia de `messages.properties`. **Mientras staging no se
> actualice, ahí el `4072` sigue llegando con 400.**
>
> **Estado 2026-11-16 (`dev` @ `58d383a`):** 🟠 **Parcial, sin cambios.** `messages/messages.properties:110` trae el
> texto del `4080`. El `4072` sigue en **400** en todos los servicios (`ProcedureTemplateService.java:100`,
> `TagService.java:74, 82`, `CategoryService.java:35, 54, 91, 115`, `ModalityService.java:32, 69`,
> `LifeEventService.java:106, 114`, `RecipientService.java:32, 68`).
>
> **Estado 2026-11-03:** 🟠 **Parcial:** `response.code.4080` ya tiene mensaje. El `4072` sigue respondiendo 400 (`CategoryService`, `LifeEventService`).

**Prioridad:** 🔵 · **Tipo:** bug

**Problema**
- `OrganismProcedureService.java:145` lanza `4080` (409, adopciones con vigencias solapadas), pero `response.code.4080` **no existe** en `messages/messages.properties`: los códigos terminan en `4076`. El basename del bundle de defaults sí está configurado (`config/messagecustome/MessageSourceConfig.java:14`, `classpath:messages/defaults`), pero el archivo no existe. Como `MessageSourceConfig.java:21` tiene `setUseCodeAsDefaultMessage(true)`, el cliente recibe el literal `"response.code.4080"`.
- `4072` ("ya existe") responde **400** (`ProcedureTemplateService.java:100`, y también en Tag, Category, Modality, LifeEvent y Recipient), mientras que los conflictos equivalentes `4069` (acrónimo) y `4080` responden **409**.

**Impacto en el front** — hay que traducir el `4080` del lado del cliente, y los conflictos se tratan distinto según el código.

**Propuesta concreta**
- Agregar `response.code.4080=Ya existe una adopción habilitada de esta plantilla para el organismo con una vigencia que se superpone.`
- Responder `4072` con **409** en todos los servicios. El front ya mapea por `code`, así que el cambio de status no lo rompe.
- Opcional: un test en `MessagesPropertiesConsistencyTest` que verifique que todo código usado en `GlobalAppException` tenga mensaje.

**Criterio de aceptación**
- [x] El `4080` llega con un mensaje en español.
- [x] El `4072` llega con 409 en todos los endpoints (`1f51bea`; en staging desde el 2026-11-19; confirmado en ejecución el 2026-11-20 para etiquetas).

---

## G-8 · Historial de versiones y control de concurrencia

> **Ampliación 2026-11-19 — el `PUT` no lleva versión: un formulario viejo pisa cambios ajenos sin error** (surge de
> integrar el front contra `586b670`; **leído en el código, no ejecutado**).
> - **Sigue igual en `586b670`:** `OrganismProcedureLocationRequestDTO` (`dto/organismProcedureLocation/…RequestDTO.java:19-33`)
>   no tiene `lockVersion` ni `currentVersionNumber`. `update` (`service/OrganismProcedureLocationService.java:80-98`)
>   carga la entidad y la guarda en la misma transacción, así que el `@Version` (`entity/OrganismProcedureLocation.java:38-40`)
>   compara la versión que acaba de leer consigo misma: solo falla si otro commit entra en esos milisegundos. El caso
>   real (A abre el form, B guarda, A guarda diez minutos después) termina en **200 y se pierde lo de B**, sin 409.
> - **El response sí trae con qué compararse:** `currentVersionNumber` (`…ResponseDTO`, `toResponse` `:196-209`) sube en
>   cada `PUT` y en cada transición (`:93-96, 108-110`). Falta que el request lo acepte.
> - **Qué hace el front mientras tanto:** antes de cada `PUT` vuelve a pedir la ficha (`GET /{id}`) y, si
>   `currentVersionNumber` o `publicationStatus` cambiaron respecto de lo que leyó el form, no guarda y le avisa al
>   usuario. Cuesta **un `GET` extra por guardado** y no es un candado: entre esa lectura y el `PUT` queda una ventana
>   de milisegundos, y no protege a otros clientes de la API.
> - **Pedido concreto:** aceptar en el `PUT` la versión que el cliente leyó (`currentVersionNumber`, que ya viaja en el
>   response, o `lockVersion` si se expone) y responder **409 `4091`** si no coincide con la actual. Para no romper a
>   los clientes actuales puede ser opcional al principio (sin versión = comportamiento de hoy). Lo mismo conviene para
>   las transiciones y el `DELETE` (G-12 §4). Sigue pendiente lo de `ObjectOptimisticLockingFailureException` del bloque
>   de abajo: hoy incluso el choque simultáneo saldría como 500 (probable, no ejecutado).

> **Estado 2026-11-16 (`dev` @ `58d383a`):** 🟠 **Parcial, sin cambios.** Lo que hay: `@Version` sobre `lock_version`
> (`entity/OrganismProcedureLocation.java:38-40`, columna en `V2.27:9-10`) y un handler → 409 `4091`
> (`exception/GlobalExceptionHandler.java:112-121`). Lo que falta para que sirva:
> - **`lockVersion` no viaja en el contrato:** no está en el request ni en el response
>   (`dto/organismProcedureLocation/*.java`), y `update` carga la entidad y la guarda en la misma transacción
>   (`service/OrganismProcedureLocationService.java:70-88`). El control solo detecta dos transacciones que se pisan en
>   el mismo instante, no el caso real (A abre el form, B guarda, A guarda).
> - **El handler captura `jakarta.persistence.OptimisticLockException`** (`GlobalExceptionHandler.java:4, 112`), pero
>   los repositorios de Spring Data traducen el conflicto a `ObjectOptimisticLockingFailureException`
>   (`org.springframework.orm`), que no es subclase de la anterior: caería en el handler genérico (`:100`) como **500
>   `5000`**. **Probable, no ejecutado**: conviene un test que lo confirme y manejar también la excepción de Spring.
> - **Endpoint de versiones:** sigue sin existir.
>
> **Estado 2026-11-03:** 🟠 **Parcial** (`965fb21`): `@Version lockVersion` en `OrganismProcedureLocation` y handler de `OptimisticLockException` → **409 `4091`** ("El recurso fue modificado por otro usuario."). Pendiente: exponer `lockVersion` en request/response para que el control funcione entre requests, y el endpoint de versiones.

**Prioridad:** 🔵 · **Tipo:** feature

**Problema**
- Cada escritura y cada transición generan un `OtlVersion` (`OrganismProcedureLocationService.java:41, 81, 95`), pero **no hay endpoint de lectura**. FR-BACKOFFICE-07 figura ❌ en `docs/requirements.md:168`. `OtlVersionRepository.findByIdAndOrganismId` (`:13-19`) ya existe y no se usa.
- `otl_versions.created_by_id` (`V2.12:37`) nunca se completa: `buildSnapshot` no lo setea (`:157-167`).
- Concurrencia (D-5 del backend): `OrganismProcedureLocation` no tiene `@Version`. La última escritura gana, aunque es criterio de PPDT-5.6 (`docs/tasks/backlog_taiga.md:252`).

**Impacto en el front** — no se puede mostrar el historial ni el autor de cada cambio, y dos agentes pueden pisarse sin aviso.

**Propuesta concreta**
- `GET /api/organism-procedure-location/{id}/versions` (`READ_VARIANT`) → `[{ versionNumber, publicationStatus, slug, url, requirements, costs, active, createdBy: { id, email }, createdAt }]`, de la más nueva a la más vieja.
- `GET /api/organism-procedure-location/{id}/versions/{versionNumber}`.
- Setear `created_by_id` con el usuario autenticado.
- `@Version` en la OTL. `version` en el response y en el request del `PUT`. Si no coincide → 409 con código propio ("La ficha fue modificada por otro usuario").

**Criterio de aceptación**
- [ ] El historial se lista respetando el alcance.
- [ ] Cada versión trae su autor.
- [ ] Un `PUT` con `version` desactualizada → 409.
- [ ] *(ampliación 2026-11-19)* Secuencia A lee (v3) → B guarda (v4) → A manda su `PUT` con v3 → **409 `4091`** y la
  ficha conserva lo de B. Con test.
- [ ] *(ampliación 2026-11-19)* Dos `PUT` simultáneos → uno 200 y el otro 409 `4091`, no 500 `5000`.

---

## G-10 · Plantillas: canonicalizar `slugBase` y precisar el `4073` de catálogos

> **Estado 2026-11-19 (`dev` @ `586b670`):** ✅ **Resuelto en `dev` (`130c180`, PPDT-5.6), en staging desde el 2026-11-19
> (OPS-1).**
> - **Canonicalización:** `ProcedureTemplateService.canonicalize` (`service/ProcedureTemplateService.java:147-153`)
>   aplica NFD, quita las marcas (`\p{M}+`), pasa a minúsculas, reemplaza `[^a-z0-9]+` por `-` y recorta los guiones de
>   los extremos: el mismo criterio de `TagService`. `create` (`:50-53`) y `update` (`:79-81`) validan la unicidad y
>   persisten el valor canónico; el response devuelve el slug ya canonicalizado. Un duplicado → **409** `4072` (G-6).
> - **`4073` de catálogos:** `resolveAll` (`:131-145`) busca cuál de los ids no existe y lo informa. El id y la entidad
>   (`Category`, `Tag`, `LifeEvent`, `Recipient`) van interpolados en el **`message`** ("El objeto Tag con el
>   identificador <uuid> no existe."), no en `details` como decía el criterio. Alcanza para el front.
> - **Casos borde que quedaron abiertos:** un slug que se canonicaliza a vacío y las plantillas guardadas antes del fix
>   → G-28.
> - Cubierto por `ProcedureTemplateServiceTest`; no ejecutado por el front.

**Prioridad:** 🔵 mejora · **Tipo:** bug · Detectado al integrar `/api/procedure-template` (fase 1 del front).

**Problema**
- `slugBase` solo se valida con `@NotBlank` y unicidad (`ProcedureTemplateService.java:97-104`, `ensureUniqueSlug`
  compara el valor tal cual llega): el backend **no lo canonicaliza**, a diferencia de `/api/tag` (`TagService.java:139-146`,
  `canonicalize`). Otro cliente puede guardar `Obtener-DNI` y `obtener-dni` como plantillas distintas.
- Cuando uno de los ids de catálogo (`categoryIds`, `tagIds`, `lifeEventIds`, `recipientIds`) no existe, el `4073`
  informa siempre `ids.get(0)` (`resolveAll`, `ProcedureTemplateService.java:133`), no el id que falta.

**Impacto en el front:** el backoffice canonicaliza el slug antes de enviar (mitigación), pero no protege a otros
clientes. El "no encontrado" no permite señalar qué selección está mal.

**Propuesta:** aplicar a `slugBase` la misma canonicalización de `TagService` (NFD, sin diacríticos, minúsculas,
`[^a-z0-9]+`→`-`, sin guiones al borde) y que `resolveAll` informe el id faltante y su entidad.

**Criterio de aceptación**
- [x] `POST`/`PUT` con `slugBase: "Obtener DNI"` persiste `obtener-dni`; un segundo `obtener-DNI` devuelve `4072` (409).
- [x] Un `tagIds` con un UUID inexistente devuelve `4073` con ese UUID y la entidad (en `message`, no en `details`).

---

## G-11 · Adopciones: plantilla desactivada, filtro por plantilla y `ownerOrganismId`

**Prioridad:** 🟡 importante · **Tipo:** bug + contrato · Detectado al integrar `/api/organism-procedure` (fase 2 del front).

**Problema**
1. **No se puede editar una adopción cuya plantilla está desactivada:** `OrganismProcedureService.update` vuelve a validar
   la plantilla con `loadTemplate` (`OrganismProcedureService.java:114-118`), que exige `isActive`, y responde 404 `4073`.
   Incluye deshabilitarla por `PUT` (el `DELETE` sí funciona).
2. **Desactivar una plantilla no toca sus adopciones:** `ProcedureTemplateService.delete` (`:84-89`) solo hace
   `setActive(false)`; las adopciones siguen listadas y habilitadas apuntando a una plantilla que ya no se lista
   (`getAll`, `:64-66`, solo devuelve activas).
3. **`GET /api/organism-procedure` no filtra por plantilla:** con alcance global trae todo y filtra `enabled` en memoria.
   Es el filtro `procedureTemplateId` de la tabla de G-7 (y del mismo tipo que el `organismProcedureId` de G-1).
4. **`ownerOrganismId` no tiene semántica documentada** (con alcance de organismo debe ser el propio o responde `4073`).
5. Jackson serializa `LocalDateTime` omitiendo los segundos cuando son 0 (`2026-01-01T00:00`); el front lo tolera, pero
   conviene fijar el formato.

**Propuesta**
1. En `update`, validar que la plantilla exista (no que esté activa) cuando no cambia `procedureTemplateId`.
2. Definir la cascada: al desactivar una plantilla, deshabilitar sus adopciones (o impedir desactivarla si tiene
   adopciones habilitadas, con un error de negocio claro).
3. Ver G-7: `GET /api/organism-procedure?procedureTemplateId=<uuid>` (y `?organismId=` para el alcance global).
4. Documentar `ownerOrganismId` (¿organismo responsable del contenido cuando difiere del que adopta?).
5. `@JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")` en los `LocalDateTime` de los DTOs.

**Criterio de aceptación**
- [ ] `PUT` de una adopción con plantilla inactiva y `enabled: false` responde 200.
- [ ] Desactivar una plantilla con adopciones habilitadas aplica la cascada definida (o responde un 409 con mensaje).
- [ ] `GET /api/organism-procedure?procedureTemplateId=…` devuelve solo las de esa plantilla.
- [ ] `ownerOrganismId` documentado en Swagger.

---

## G-12 · Fichas por localidad y puntos de atención: validaciones faltantes

> **Estado 2026-11-19 (`dev` @ `586b670`):** 🟠 **Parcial, con avance en §3 (`1888e1a`, PPDT-5.6; en staging desde el 2026-11-19).**
> - **§3 hecho:** `loadOrganismProcedure` (`service/OrganismProcedureLocationService.java:146-161`) rechaza la adopción
>   que no está vigente —deshabilitada, con `effectiveFrom` futuro o con `effectiveTo` cumplido
>   (`entity/OrganismProcedure.java:74-78`, `isEffectiveAt`)— con **404 `4073`** ("El objeto OrganismProcedure con el
>   identificador … no existe"). Aplica al `POST` y también al `PUT` (`:84`). Cumple el criterio ("→ 4xx"), pero el
>   código es el mismo que "no existe" y el `PUT` deja las fichas existentes sin poder editarse: ver **G-27**.
> - **§1:** resuelto desde el 2026-11-03 (G-4).
> - **Sin cambios:** §2 (`transition`, `:100-112`, sigue sin mirar `active` ni la vigencia: se puede publicar una
>   ficha inactiva o de una adopción vencida), §4 (`delete`, `:114-122`, sin `buildSnapshot`), §5 (el listado, con o
>   sin filtro, incluye las inactivas: `:52-70`) y §6 (`AttentionPointService.map`, `service/AttentionPointService.java:88-104`,
>   no valida que la ficha esté activa ni la escala de las coordenadas).
>
> **Estado 2026-11-16 (`dev` @ `58d383a`):** 🟠 **Parcial, sin cambios.** `transition` sigue sin mirar `active`
> (`service/OrganismProcedureLocationService.java:90-102`), `loadOrganismProcedure` no valida `enabled` ni la vigencia
> (`:136-145`), `delete` no genera versión (`:104-112`), el listado incluye inactivas (`:51-60`) y
> `AttentionPointService.map` no valida que la ficha esté activa (`service/AttentionPointService.java:75-91`).
>
> **Estado 2026-11-03:** 🟠 **Parcial:** en fichas, "no existe" responde 404 `4073` (ver G-4). Puntos de atención, workflow sobre fichas inactivas, fichas sobre adopciones deshabilitadas y `DELETE` sin versión: sin cambios.

**Prioridad:** 🟡 importante · **Tipo:** bug · Detectado al integrar fichas y puntos de atención (fases 3 y 4 del front).

**Problema** (todo en `origin/dev` @ `23fd8f9`)
1. **"No existe" responde 500, no 404:** es el mismo bug que G-4 §1 (los `load*` de `OrganismProcedureLocationService`
   lanzan `IllegalArgumentException`); se desarrolla y se acepta allá.
2. **Workflow sobre fichas desactivadas:** `transition` no mira `active`; una ficha inactiva puede quedar `PUBLICADO`.
3. **Fichas sobre adopciones deshabilitadas o vencidas:** `loadOrganismProcedure` no valida `enabled` ni la vigencia, así
   que se pueden **crear** fichas nuevas sobre ellas. Las fichas que ya existen cuando la adopción se deshabilita o vence
   son G-9 §3 (cascada y filtro de vigencia); conviene resolver los dos juntos.
4. **El `DELETE` de la ficha no genera versión** aunque la despublique (no llama a `buildSnapshot`, a diferencia de
   `update` y `transition`).
5. **El listado de fichas incluye las inactivas** (`findAll`/`findAllByOrganismProcedureOrganismId` no filtran `active`).
   Si es intencional, documentarlo; si no, filtrar o agregar `?includeInactive`.
6. **Puntos de atención:** se pueden crear sobre una ficha inactiva (`AttentionPointService.map` no lo valida), y con más
   de 6 decimales `NUMERIC(9,6)` redondea en silencio (validar escala o documentar).

**Propuesta:** los "no existe", según G-4; rechazar con 4xx (código propio) el workflow sobre
fichas inactivas y la creación de fichas/puntos sobre padres deshabilitados o vencidos; snapshot en `delete`; validar
`@Digits(integer = 3, fraction = 6)` en latitud/longitud.

**Criterio de aceptación**
- [ ] (§1: ver criterios de G-4.)
- [ ] `POST /{id}/publish` sobre una ficha con `active=false` → 4xx con código de negocio.
- [x] `POST /api/organism-procedure-location` con una adopción deshabilitada o vencida → 4xx (404 `4073`, `1888e1a`; código propio pedido en G-27).
- [ ] `DELETE` de una ficha incrementa `currentVersionNumber`.
- [ ] `POST /api/attention-point` con latitud de 7 decimales → 400 `4012`.

---

## OPS-1 · Desplegar `dev` en staging

> **Estado 2026-11-20:** ✅ **Cumplido y verificado en flujos.** El e2e de los seis roles corrió contra staging
> (backend `586b670`): 114 casos OK, 3 FALLA y 4 sin cubrir (`e2e/final_runs/fichas_2026-11-19/`; detalle en el bloque
> "E2E 2026-11-20" de la cabecera). Lo que el 2026-11-19 solo se había visto en el esquema de `/api-docs` quedó
> ejercitado: alta, edición, workflow completo (`BORRADOR → EN_REVISION → PUBLICADO ↔ DESPUBLICADO`) y puntos de
> atención de una ficha, `/me` con `scope` y organismo para los seis roles, `READ_PROCEDURE` de ADMIN_ORGANIZATION
> (`V2.31`), el `4072` como 409 y los dos filtros nuevos. Ninguna de las 3 FALLA es del deploy: dos son pedidos
> abiertos (G-9, G-23) y una es del front.

> **Estado 2026-11-19 (más tarde, el mismo día):** ✅ **Cumplido de nuevo** (para `586b670`). `origin/staging` del
> backend = `0a555df` ("Merge branch 'dev' into 'staging'", contiene `586b670`). `/api-docs` de staging ya publica el
> contrato nuevo: `AuthMeResponseDTO` con `scope`, `organismId`, `organismName` y `organismAcronym`;
> `OrganismProcedureLocationResponseDTO` con `organismProcedureId`, `locationId`, `url`, `requirements` y `costs`.
> **Solo se verificó el esquema publicado; no se ejecutó ningún flujo todavía**: de los criterios de la reapertura de
> abajo queda tildado el primero; los otros dos (parámetros de filtro documentados y `READ_PROCEDURE` del AO de prueba)
> quedan por confirmar. El front de `feat/alinear-backend-586b670` ya se puede desplegar (requiere backend >=
> `586b670`). El bloque que sigue queda como historial.
>
> **Estado 2026-11-19 (historial; reapertura, cerrada ese mismo día):** ⬜ **Reabierto: staging quedó otra vez atrás de
> `dev`.** `origin/staging` seguía en `7f2a78f`
> (merge de `dev` @ `58d383a`) y `dev` avanzó 13 commits, hasta `586b670`
> (`git log --oneline origin/staging..origin/dev`). Verificado online el 2026-11-19, antes del deploy: `/api-docs` de
> staging seguía publicando el contrato anterior. Faltaba desplegar:
>
> | Commit | Tarjeta | Qué trae | Pedido |
> |---|---|---|---|
> | `a69925e` | PPDT-5.1 | AB asigna roles `assignableByBackoffice`; AB no puede dar de baja, cambiar estado ni email de cuentas SA/AB (403 `4029`) | G-22, G-26 |
> | `3797fe7` | PPDT-5.6 | Response completo de la ficha, filtro `?organismProcedureId=`, validación 400 `4012` | G-1, R-1 |
> | `d7aca1c` | PPDT-5.2 | `scope` y organismo en `/api/auth/me` | G-2 / BO-20 |
> | `fb13104` | PPDT-5.4 | `V2.31`: `READ_PROCEDURE` para ADMIN_ORGANIZATION | G-3 |
> | `1888e1a` | PPDT-5.6 | Vigencia de la adopción en fichas (alta y edición) y en las consultas públicas | G-9, G-12, G-27 |
> | `0db49a9` | PPDT-5.6 | Filtro `?organismProcedureLocationId=` en puntos de atención | G-7, G-29 |
> | `1f51bea` | PPDT-5.6 | `4072` → 409 | G-6 |
> | `130c180` | PPDT-5.6 | `slugBase` canónico y `4073` de catálogos con el id que falta | G-10, G-28 |
>
> (Los otros cinco commits son de documentación: `6e883b8`, `b0f2d07`, `3e94966`, `9a54179`, `586b670`.) Es una sola
> migración nueva (`V2.31`, un `INSERT … ON CONFLICT DO NOTHING`), sin cambios de esquema.
> **Por qué bloqueaba:** en esta rama el front pasa fichas y puntos de atención a real en staging y prod, y eso solo
> funciona con `3797fe7` desplegado: contra el backend que staging tenía hasta ese deploy (`58d383a`), el response de
> la ficha llegaba sin contenido y el formulario de edición lo habría borrado al guardar (el problema original de G-1).
> **Criterio de aceptación de esta reapertura:**
> - [x] `/api-docs` de staging: `OrganismProcedureLocationResponseDTO` incluye `organismProcedureId`, `locationId`,
>   `url`, `requirements` y `costs`; `AuthMeResponseDTO` incluye `scope` y `organismId`. *(Verificado el 2026-11-19.)*
> - [ ] `GET /api/attention-point` y `GET /api/organism-procedure-location` documentan sus parámetros de filtro.
> - [ ] Con el AO de prueba, `/api/auth/me` trae `READ_PROCEDURE` (`V2.31` aplicada).
>
> **Estado 2026-11-16 (tarde):** ✅ **Cumplido** (para `58d383a`). `origin/staging` del backend = `7f2a78f` (merge de `dev` @ `58d383a`).
> Verificado online en solo lectura con SUPERADMIN: `/api-docs` publica 58 paths (incluye `/api/tag`,
> `/api/procedure-template`, `/api/organism-procedure*`, `/api/attention-point`, `role-assignments`); `/me` trae los
> permisos `*_TAG`, `*_ADOPTION`, `*_ATTENTION_POINT`; los cuatro listados de trámites responden 200 (vacíos).
> El front pasó Etiquetas, Plantillas y Adopciones a real en `environment.staging.ts` y `environment.prod.ts`;
> fichas y puntos de atención siguen en mock por G-1. Las notas de abajo quedan como historial.
>
> **Estado 2026-11-16:** 🟠 **Parcial, sin cambios** (no verificable desde el código; según el estado de la rama,
> `origin/staging` sigue en el merge del 2026-10-17 más cambios de pipeline). Lo que falta desplegar ahora es **todo
> `dev` hasta `V2.30`**: `V2.25`–`V2.30` (alcance de asignaciones, constraints de fichas, grants de R-3 y su ajuste,
> `search_logs`), R-1, G-15, `role-assignments`, `GET /api/tag/public` y los códigos `4077`, `4080`, `4081`, `4091`.
> Con R-3 y G-15 resueltos en `dev`, **OPS-1 es lo único que separa a Etiquetas, Plantillas y Adopciones de pasar a
> real en staging** (fichas y puntos de atención siguen esperando G-1).
>
> **Estado 2026-11-03:** 🟠 **Parcial.** Hubo un merge `dev` → `staging` el 2026-10-17 (`2e3f277`, hasta `3b4e61e`): staging ya arranca (G-14) y tiene `GET /api/user`. Falta desplegar todo lo posterior: R-3 (`V2.28`), R-1, `V2.25`–`V2.29`, asignación de roles y búsqueda pública.

**Prioridad:** 🔴 bloquea · **Tipo:** ops · Verificado el 2026-10-15.

**Problema**
- El servidor online `https://tramitesmisiones.api.dev.stagemnes.net.ar` corre la rama **`staging`**: en
  `.gitlab-ci.yml`, `build_image_stage` y `dev_deploy_stage` tienen `only: staging`. La rama `dev` solo compila
  (`mvn compile`) y corre tests (`mvn verify`); no despliega.
- `origin/staging` está en `f7f0d38` (2026-09-23). Su último merge de `dev` es `2b558b7`, que llega hasta `d800be0`
  (2026-07-28, `/api/auth/me`). Después solo tiene cambios de `.gitlab-ci.yml`.
- **`dev` tiene 42 commits que no están en `staging`** (`git log --oneline origin/staging..origin/dev`), el primero del
  2026-08-24:
  - PPDT-2.4, 2.9 y 2.10: núcleo de trámites (plantillas, puentes de catálogo, flujo de adopción y fichas; migraciones
    `V2.10` en adelante).
  - PPDT-3.1: observabilidad (eventos base). PPDT-3.3 y 3.5: feedback, `search_logs` y búsqueda pública (`/api/procedure`).
  - PPDT-5.1, 5.2, 5.4–5.8, 5.10–5.12: escalada de privilegios, alcance por organismo, APIs de plantillas, adopciones,
    fichas por localidad, puntos de atención y etiquetas, filtros de búsqueda, ficha pública y feedback ciudadano.
- Staging solo tiene migraciones hasta `V2.9`: al desplegar se aplicarían `V2.10`–`V2.24` sobre su base actual, y
  `V2.21` corta el arranque (G-14).
- Comprobado en el servidor: `/api-docs` publica 40 paths, sin `/api/tag`, `/api/procedure-template`,
  `/api/organism-procedure`, `/api/organism-procedure-location` ni `/api/attention-point`, y `RoleResponseDTO` no trae
  `assignableByBackoffice`.

**Impacto en el front:** contra el backend online, Etiquetas, Plantillas, Adopciones, Fichas y Puntos de atención
tienen que correr en mock (`environment.staging.ts`). Lo que `dev` trae desde el 2026-08-24 solo se puede probar
levantando el backend local con Docker.

**Propuesta**
1. Antes del merge, resolver:
   - **G-14** (requisito duro): sin él, `V2.21` falla sobre la base de staging y la aplicación no arranca.
   - **R-3**: si no, en staging nadie tiene `*_TAG`, `*_ADOPTION` ni `*_ATTENTION_POINT`. Confirmado en staging: el JWT
     del SUPERADMIN trae 47 permisos y ninguno de esos.
   - **G-15**: para poder adoptar trámites (sin él, crear o editar adopciones habilitadas da 500).
2. Merge request `dev` → `staging` con el pipeline de `dev` en verde (compile + verify), y deploy.
3. Acordar una cadencia (p. ej. promover `dev` a `staging` al cerrar cada tarjeta PPDT) o desplegar `dev` en un
   entorno propio.

**Criterio de aceptación**
- [ ] `GET /api-docs` de staging incluye `/api/tag`, `/api/procedure-template`, `/api/organism-procedure`,
  `/api/organism-procedure-location` y `/api/attention-point`.
- [ ] `GET /api/role` devuelve `assignableByBackoffice`.
- [ ] La aplicación arranca en staging con todas las migraciones aplicadas (hasta `V2.30`).
- [ ] El JWT del SUPERADMIN de staging incluye `READ_TAG`, `READ_ADOPTION` y `READ_ATTENTION_POINT`.
- [ ] `POST /api/organism-procedure` con `enabled: true` responde 201 en staging (G-15).

---

## G-13 · El borrado definitivo de usuario siempre falla (500)

> **Estado 2026-11-19 (`dev` @ `586b670`):** ⬜ **Pendiente.** Lo único que cambió (`a69925e`) es el chequeo previo:
> `deleteLogicalUserById` y `deleteDefinitiveUserById` (`security/service/UserService.java:136-153`) llaman ahora a
> `validateUserMutationAccess`, que le niega a ADMIN_BACKOFFICE las cuentas SA/AB (403 `4029`). El borrado definitivo
> sigue siendo solo `userRepo.delete(user)` (`:152`), y `findUserDTO` (`:91-95`) y `findAllUserDTO` (`:103-113`) siguen
> con ModelMapper: `role` y `activeAssignments` en `null`. **Ese `null` pesa más que antes:** ver G-26.
>
> **Estado 2026-11-16 (`dev` @ `58d383a`):** ⬜ **Pendiente, sin cambios.** `deleteDefinitiveUserById` sigue con solo
> `userRepo.delete(user)` (`security/service/UserService.java:147-153`), y `findUserDTO` (`:90-95`) y `findAllUserDTO`
> (`:102-113`) siguen con ModelMapper. Los únicos caminos que arman el rol a mano (`buildUserResponse`, `:690-701`) son
> el alta (`:233`) y `role-assignments` (`:272`), y ni siquiera ahí se completan `activeAssignments` ni el organismo.
> G-20 amplía el punto 3 de la propuesta.
>
> **Estado 2026-11-03:** ⬜ **Pendiente.** Confirmado en staging el 2026-11-03: `GET /api/user` devuelve cada usuario con `role: null` y `activeAssignments` vacío. El borrado definitivo no se tocó.

**Prioridad:** 🔴 bloquea · **Tipo:** bug · Detectado por el e2e contra staging (2026-10-15); la causa también está en `dev`.

**Problema**
- `DELETE /api/user/{id}/admin` responde **500 `5000`**. `UserService.deleteDefinitiveUserById` hace solo
  `userRepo.delete(user)` (igual en `origin/staging` y `origin/dev`).
- `V0.2__align_identity_access_to_der.sql:38` crea `user_role_assignments.user_id ... REFERENCES users(id) ON DELETE
  RESTRICT`, y `User.roleAssignments` (`@OneToMany(mappedBy = "user")`) no tiene `cascade` ni `orphanRemoval`. Todo
  usuario tiene al menos una asignación, así que la base **siempre** rechaza el `DELETE`.
- Otras FKs a `users(id)` sin `ON DELETE` (`procedure_templates.created_by_id/updated_by_id`, `otl_versions.created_by_id`,
  `audit_events.actor_user_id`, `metric_events.user_id`, `procedure_feedbacks.user_id/reviewed_by_id`) van a bloquear
  el borrado de cualquier usuario que haya operado.
- **Confirmado: el `UserResponseDTO` llega con `role: null` y `activeAssignments: null`.** No es solo del `POST` (en el
  e2e, el alta con rol "User" lo devolvió así): es general. `findUserDTO` (`security/service/UserService.java:93`) arma
  la respuesta con ModelMapper (`convertDTOToEntity`), que no resuelve el rol ni las asignaciones vigentes, así que
  `GET /api/user/{id}` también los devuelve en `null`; `findAllUserDTO` (`:102-112`, mapeo en `:111`) usa el mismo
  mapeo, así que BO-17 lo heredaría.

**Impacto en el front:** la acción "Eliminar definitivamente" (BO-3, `DELETE_USER`) no puede funcionar contra el
backend real. Los usuarios de prueba no se pueden limpiar.

**Propuesta**
1. Definir la política: ¿el borrado "definitivo" debe existir, o alcanza con la baja lógica? Si existe:
   borrar primero las `user_role_assignments` (o `cascade = REMOVE` en la relación) y, para las referencias de
   auditoría y autoría, anonimizar (`SET NULL`) en vez de borrar historial.
2. Si el usuario tiene referencias que no se pueden anonimizar, responder **409** con un código de negocio claro
   ("El usuario tiene actividad registrada; desactivalo"), no 500.
3. Mapear explícitamente `role`, `activeAssignments` y el organismo en el `UserResponseDTO` (un `toResponse` propio en
   vez de ModelMapper), y usarlo en el alta, el `GET /{id}` y el listado de BO-17.

**Criterio de aceptación**
- [ ] `DELETE /api/user/{id}/admin` de un usuario recién creado (sin actividad) → 200 y deja de existir.
- [ ] De un usuario con actividad → 200 con referencias anonimizadas, o 409 con código de negocio (no 500).
- [ ] `POST /api/user` y `GET /api/user/{id}` devuelven `role` y `activeAssignments` completos (no `null`).

---

## OPS-2 · Purgar en staging los registros de prueba `E2E-*`

**Prioridad:** 🔵 mejora · **Tipo:** ops.

**Problema:** organismos y tipos de organismo solo tienen baja lógica, y el usuario de prueba no se puede borrar
(G-13). Las corridas del e2e del front (2026-10-15) dejaron en staging, todos inactivos y con prefijo `E2E-`:
4 organismos, 4 tipos de organismo y el usuario `e2e.1792075066@example.com`
(id `1fcb47e4-7231-4989-9d7c-82a72e715513`, desactivado). Los ids están en `e2e/final_runs/run_*/final_script_log.txt`
(líneas `CLEANUP`). El script ya se ajustó para no seguir acumulando.

**Propuesta:** borrar esos registros por SQL en la base de staging (`name LIKE 'E2E-%'` en `organisms` y
`organism_types`, y el usuario por id junto con sus `user_role_assignments`).

**Criterio de aceptación:** `GET /api/organism` y `GET /api/organism-type` de staging no devuelven ningún `E2E-%`.

---

## G-14 · `V2.21` impide arrancar el backend

> **Estado 2026-11-16 (`dev` @ `58d383a`):** ✅ **Resuelto** (en `dev` y en staging). `V2.21__expand_publication_status.sql:1-13`
> quedó reescrita: hace `DROP CONSTRAINT IF EXISTS` + `ADD CONSTRAINT … CHECK (publication_status IN ('BORRADOR',
> 'EN_REVISION', 'DESPUBLICADO', 'PUBLICADO'))` en `organism_procedure_locations` y en `otl_versions`.
>
> **Estado 2026-11-03:** ✅ **Resuelto** (`4a71cfa`, también en staging): `V2.21` ahora rehace los `CHECK` de `publication_status` en vez de alterar un enum inexistente. El parche local del e2e ya no hace falta.

**Prioridad:** 🔴 bloquea · **Tipo:** bug · Reproducido el 2026-10-15 levantando `dev` @ `23fd8f9` con Docker y una base vacía.

**Problema**
- `V2.12__create_organism_procedure_flow.sql:21,35` declara `publication_status VARCHAR NOT NULL` (columna de texto).
- `V2.21__expand_publication_status.sql` ejecuta `ALTER TYPE publication_status ADD VALUE IF NOT EXISTS 'EN_REVISION'`
  sobre un **tipo enum que ninguna migración crea**.
- `MigrationQueryRunner` corta con `ERROR: type "publication_status" does not exist` y la aplicación no arranca. Solo
  funciona en bases donde alguien creó ese tipo a mano.

**Impacto**
- **Bloquea OPS-1 aunque no se recree la base:** staging solo tiene migraciones hasta `V2.9` (no tiene `V2.10`–`V2.24`),
  así que al desplegar `dev`, `V2.21` corre sobre la base **actual** de staging y la aplicación no arranca.
- Además, nadie puede levantar `dev` desde cero (devs nuevos, CI con base efímera).

**Propuesta:** si el estado es `VARCHAR`, `V2.21` sobra. Reemplazarla por una migración nueva que no toque tipos (o que
valide los valores con un `CHECK (publication_status IN ('BORRADOR','EN_REVISION','PUBLICADO','DESPUBLICADO'))`). No
editar `V2.21` si ya está aplicada en alguna base: agregar una migración superadora y hacer que `V2.21` no falle
(p. ej. `DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_type WHERE typname='publication_status') THEN … END IF; END $$;`).
- El `DO $$ … $$` es compatible con el splitter de `MigrationQueryRunner` (`utils/MigrationQueryRunner.java:164-178`
  reconoce dollar-quote y no corta en los `;` internos).
- El fix tiene que actualizar `src/test/…/repository/PublicationStatusMigrationTest.java`, que lee el contenido de
  `V2.21` (`:14`) y valida lo que hoy hace.

**Mitigación usada en el front para el e2e local:** crear el tipo vacío antes del arranque
(`CREATE TYPE publication_status AS ENUM ('BORRADOR','PUBLICADO')`); la columna sigue siendo `VARCHAR`.

**Criterio de aceptación**
- [ ] `dev` arranca sobre una base Postgres vacía sin intervención manual y aplica todas las migraciones.
- [ ] `dev` arranca sobre una copia de la base actual de staging (migraciones hasta `V2.9`).
- [ ] `PublicationStatusMigrationTest` actualizado y en verde.

---

## G-15 · Adopciones: crear y editar una adopción habilitada responde 500

> **Estado 2026-11-16 (`dev` @ `58d383a`):** ✅ **Resuelto en `dev`, pendiente de deploy a staging (OPS-1).**
> `findOverlappingEnabled` (`repository/OrganismProcedureRepository.java:19-27`) ahora tipa los dos parámetros que
> pueden ser nulos: `cast(:excludeId as uuid) is null` (`:24`) y `cast(:effectiveTo as timestamp) is null` (`:25`).
> Backend dejó un test opt-in contra PostgreSQL (`src/test/…/repository/OrganismProcedurePostgresTest.java`; evidencia
> en `odd/tasks/g15-adoption-overlap.md`). **El front no lo ejecutó todavía**: falta correr el e2e local (CP16) sin el
> seed SQL. El caso aparte de la fecha sin hora (500 por `HttpMessageNotReadableException`) sigue vigente en G-18.
>
> **Estado 2026-11-03:** ⬜ **Pendiente — es el próximo bloqueo que backend anunció atacar** (2026-11-03).

**Prioridad:** 🔴 bloquea · **Tipo:** bug · Reproducido por el e2e contra `dev` @ `23fd8f9` en local (2026-10-15).

**Problema**
- `POST /api/organism-procedure` y `PUT /api/organism-procedure/{id}` con `enabled: true` responden **500 `5000`**, con
  o sin `effectiveTo` (ej. `{"procedureTemplateId":"…","organismId":"…","ownerOrganismId":null,"enabled":true,
  "effectiveFrom":"2026-01-01T00:00:00","effectiveTo":"2027-12-31T23:59:59"}`).
- Causa: la consulta de solapamiento `findOverlappingEnabled` (`repository/OrganismProcedureRepository.java:19-27`)
  incluye `(:effectiveTo is null or op.effectiveFrom < :effectiveTo)`. Según el SQL generado en el log, el `$5` del error
  `ERROR: could not determine data type of parameter $5` es el **primer `?` de esa condición**. pgjdbc envía el
  `LocalDateTime` sin tipo, así que `? is null` falla **aunque `effectiveTo` traiga fecha**. Por eso también falla el `PUT`,
  donde `excludeId` no es nulo: el problema no es `excludeId` (aunque `:excludeId is null` tiene el mismo riesgo).
- Con `enabled: false` **no** falla: `ensureNoOverlap` (`service/OrganismProcedureService.java:143`) solo ejecuta la
  consulta si la adopción viene habilitada.
- En consecuencia tampoco se puede probar la regla de solapamiento (`4080`).
- Aparte: una fecha sin hora (`"effectiveFrom": "2026-01-01"`) da **500** por error de parseo del JSON
  (`HttpMessageNotReadableException`), en vez de 400. Es el caso general de G-18.

**Impacto en el front:** "Adoptar trámite" y la edición de vigencias no funcionan contra el backend real. El e2e
local tuvo que sembrar una adopción por SQL para poder probar fichas y puntos de atención.

**Propuesta:** tipar los parámetros (`cast(:effectiveTo as timestamp) is null`, `cast(:excludeId as uuid) is null`),
o resolver los `null` en Java con consultas separadas (con y sin `excludeId` / `effectiveTo`). Agregar un test de
integración contra Postgres real (Testcontainers) que cree y edite adopciones habilitadas con y sin `effectiveTo`: el
bug no aparece con H2.

**Criterio de aceptación**
- [ ] `POST` con `enabled: true`, con `effectiveTo: null` y con fecha → 201.
- [ ] `PUT` de una adopción existente con `enabled: true` → 200.
- [ ] Dos adopciones solapadas de la misma plantilla y organismo → 409 `4080` con mensaje.

---

## G-16 · Borrar categorías, etiquetas o destinatarios en uso responde 500

> **Ampliación 2026-11-20 — mapa de borrados en uso (`dev` @ `586b670`; leído en el código y deducido del esquema,
> no ejecutado).** Los tres casos de abajo siguen igual (`CategoryService.java:129`, `TagService.java:92`,
> `RecipientService.java:83`: `delete` directo, sin consulta previa ni `catch`; el `GlobalExceptionHandler` no tiene
> handler para `DataIntegrityViolationException`, así que cae en el genérico de `:100-110`). Se suma un caso y se deja
> anotado cuáles sí responden con código:
>
> | Borrado | Qué lo frena | Respuesta |
> |---|---|---|
> | Categoría, etiqueta o destinatario usados por una plantilla | FK sin cascada (`V2.10:4, 18`, `V2.11:3, 15`) | **500 `5000`** (este pedido) |
> | **Permiso asignado a un rol** (`DELETE /api/permission/{id}`, solo SUPERADMIN: `security/controller/PermissionController.java:80-85`) | `role_permissions_permission_id_fkey` es `ON DELETE RESTRICT` desde `V0.6__align_role_permissions_delete_rules.sql:13-17` (la `V0.0:45` original era `CASCADE`); `PermissionService.deletePermission` (`security/service/PermissionService.java:72-77`) hace `deleteById` sin `catch` | **500 `5000`** (nuevo en este pedido) |
> | Usuario con asignaciones de rol (`DELETE /api/user/{id}/admin`) | FK `RESTRICT` de `user_role_assignments` | **500 `5000`** — ya está en **G-13** |
> | Organismo con hijos activos | `OrganismService.java:164-167` | 409 `4067` ✔ |
> | Tipo de organismo con organismos activos | `OrganismTypeService.java:135-137` | 409 `4066` ✔ |
> | Categoría con subcategorías | `CategoryService.java:125-126` | **400** `4065` (tiene código; pedimos que pase a 409) |
>
> El borrado de rol no entra: es baja lógica (`RoleService.java:96-104`).

> **Estado 2026-11-16 (`dev` @ `58d383a`):** ⬜ **Pendiente, sin cambios.**

**Prioridad:** 🟡 importante · **Tipo:** bug.

**Problema** — el borrado no valida si el registro está en uso y deja que la FK corte con **500 `5000`** (aunque la
plantilla que lo referencia esté desactivada):
- **Categorías:** `DELETE /api/category/{id}` de una categoría usada como principal (`procedure_templates.main_category_id`,
  `V2.10:4`, FK `procedure_templates_main_category_id_fkey`) o como secundaria (`procedure_categories.category_id`,
  `V2.10:18`).
- **Etiquetas:** `TagService.deleteTag` (`:92`) hace borrado físico, contra la FK de `procedure_tags` (`V2.11:3`).
- **Destinatarios:** `RecipientService.deleteRecipient` (`:83`) hace borrado físico, contra la FK de
  `procedure_recipients` (`V2.11:15`).
- El único caso validado es el de categorías con subcategorías (`4065`, `CategoryService.java:126`), y responde **400**.

**Propuesta:** validar antes de borrar y responder **409** con un código de negocio ("La categoría está en uso por N
plantillas", ídem etiqueta y destinatario). Sugerimos que el `4065` pase también a 409, por consistencia con G-6.

**Criterio de aceptación**
- [ ] Borrar una categoría (principal o secundaria), etiqueta o destinatario en uso → 409 con código y mensaje; el front
  lo muestra en el modal.
- [ ] Ningún borrado de catálogo responde 500 por FK.
- [ ] *(ampliación 2026-11-20)* `DELETE /api/permission/{id}` de un permiso asignado a algún rol → 409 con código y
  mensaje (o se define que primero se desasigna), no 500.

---

## G-17 · ¿AO y AGENT deben ver las etiquetas globales?

**Prioridad:** 🔵 decisión · **Tipo:** contrato.

**Situación:** `TagService.getTags` (`:50-53`) devuelve todas las etiquetas para alcance global y, para alcance de
organismo, `findAllByOrganismId` (solo las locales de su organismo). El AO de prueba **sí tiene organismo**: el seed
(`V0.0:194`) lo asigna a Silicon Misiones (`660e…0001`), con su `user_role_assignments`. Recibe `data: []` porque ese
organismo no tiene etiquetas locales, mientras SA y AB ven las globales (`salud`, `transito`). Un AO **sin** organismo
no recibiría `[]` sino **403 `4029`** (`UserService.getCurrentScope`, `security/service/UserService.java:346-353`).

**Pregunta:** para etiquetar plantillas o fichas desde un organismo, ¿AO/AGENT necesitan listar también las
globales? Si sí: que `GET /api/tag` con alcance de organismo devuelva globales + locales propias (solo lectura de las
globales).

**Criterio de aceptación** (si se aprueba)
- [ ] Con AO, `GET /api/tag` devuelve las globales más las locales de su organismo.
- [ ] Con AO, `PUT`/`DELETE` de una etiqueta global → 404 `4073` (o 403), como hoy.

---

## G-18 · Excepciones de Spring sin manejar responden 500

> **Estado 2026-11-16 (`dev` @ `58d383a`):** ⬜ **Pendiente.** El `GlobalExceptionHandler` solo sumó
> `OptimisticLockException` (`exception/GlobalExceptionHandler.java:112-121`, ver G-8). Las tres excepciones de abajo
> siguen cayendo en el genérico (`:100-110`). El ejemplo de "método no soportado" se cambió: `GET /api/user` ya existe
> (BO-17).

**Prioridad:** 🔵 mejora · **Tipo:** bug · Reproducido en `dev` local (2026-10-16).

**Problema** — el `GlobalExceptionHandler` solo maneja `MethodArgumentNotValidException`, `GlobalAppException`,
`GlobalMessageException` y `AccessDeniedException` (`exception/GlobalExceptionHandler.java:32,50,63,77`); todo lo demás
cae en el genérico (`:99`) como **500 `5000`** ("Ocurrió un error inesperado"):
- **Id que no es UUID:** `GET /api/procedure-template/pt-1` → 500. En el log: `MethodArgumentTypeMismatchException: …
  Invalid UUID string: pt-1`. Le pasa a cualquier endpoint con `@PathVariable UUID`. Debería ser **400**.
- **Método no soportado:** p. ej. `DELETE /api/user/{id}` (el controller solo mapea `GET` y `PUT` en esa ruta; la baja
  lógica es el `PUT`) o `PATCH /api/tag/{id}` → 500 por `HttpRequestMethodNotSupportedException`. Debería ser **405**.
  *(El ejemplo original era `GET /api/user`, que respondía así antes de BO-17.)*
- **Body ilegible:** un JSON mal formado o una fecha que no parsea (p. ej. `"effectiveFrom": "2026-01-01"`, ver G-15)
  → 500 por `HttpMessageNotReadableException`. Debería ser **400**.

**Propuesta:** manejar esas tres excepciones en el `GlobalExceptionHandler`:
- `MethodArgumentTypeMismatchException` → **400** con un código de negocio (o `4012` validación) y el nombre del parámetro.
- `HttpRequestMethodNotSupportedException` → **405** con los métodos admitidos.
- `HttpMessageNotReadableException` → **400** (`4012` o código propio), indicando el campo cuando se pueda.

**Criterio de aceptación**
- [ ] `GET /api/<recurso>/no-es-uuid` → 400 con código y mensaje, en todos los controllers.
- [ ] Un método no soportado (p. ej. `DELETE /api/user/{id}`) → 405, no 500.
- [ ] Un body con JSON inválido o una fecha mal formada → 400 con código y mensaje, no 500.

---

## G-19 · Seed de ejemplo para el núcleo de trámites

**Prioridad:** 🔵 mejora · **Tipo:** ops.

**Problema:** con una base nueva, `GET /api/procedure-template` devuelve `[]`: no hay plantillas, adopciones, fichas ni
puntos de atención de ejemplo. Cada QA o demo arranca cargando todo a mano (y hoy las adopciones no se pueden crear, G-15).

**Propuesta:** un seed **solo para perfiles dev/local** (no en la migración productiva) con 2–3 plantillas, una adopción
vigente y fichas en distintos estados, usando ids fijos documentados.
- Hoy no hay dónde ponerlo: `MigrationQueryRunner` aplica todo `classpath:db/V*.sql` (`utils/MigrationQueryRunner.java:89`)
  sin distinguir perfil. Un seed "solo dev/local" necesita un mecanismo nuevo, p. ej. una carpeta separada
  (`db/seed-dev/`) que se cargue solo con un perfil, o un `CommandLineRunner` con `@Profile("dev")`.

**Criterio de aceptación**
- [ ] Con el perfil dev/local, una base nueva arranca con las plantillas, la adopción y las fichas de ejemplo.
- [ ] Con el perfil de staging/prod, el seed no se aplica.

---

## G-20 · No se puede cambiar el rol de un usuario existente

**Prioridad:** 🔴 bloquea (BO-24) · **Tipo:** bug + feature · Detectado en la auditoría del 2026-11-16 (`dev` @ `58d383a`), leyendo el código; no ejecutado.

**Contexto:** `POST /api/user/{id}/role-assignments` (`CREATE_USER`, `security/controller/UserController.java:78-88`)
se presentó como la forma de asignar un rol a un usuario existente. La regla del modelo (`V2.26`) es **un usuario = un
único rol vigente**. En la práctica el endpoint no sirve para el caso de uso principal, que es cambiar el rol.

**Problema**
- **Todo usuario nace con una asignación abierta.** El alta por API (`security/service/UserService.java:207-213`) y el
  registro (`:177-182`) crean la asignación con `effectiveFrom = hoy` y sin `effectiveTo`.
- **`role-assignments` valida solapamiento contra todas las asignaciones del usuario**
  (`validateNoOverlappingAssignment`, `:282-292`; consulta en
  `security/repository/UserRoleAssignmentRepository.java:27-37`): una asignación con `effectiveTo IS NULL` se superpone
  con cualquier período que termine después de su inicio. Resultado: **409 `4081` siempre**, para cualquier rol y
  cualquier vigencia futura. El único pedido que pasa es uno enteramente anterior al alta del usuario, que no sirve.
- **No hay cómo cerrar una asignación.** `UserController` no tiene ningún endpoint que la cierre o la reemplace
  (mappings en `:39, 57, 68, 79, 96, 114, 133, 177, 200, 223`), y el único lugar del código que escribe `effectiveTo` es
  el alta de la asignación nueva (`UserService.java:265`).
- La base refuerza lo mismo: `V2.26__fix_user_role_assignments_organism_scope.sql:30-32` (índice único por usuario con
  `effective_to IS NULL`) y `:34-39` (exclusión por rango de fechas).
- Backend ya lo tiene identificado: `odd/tasks/assign-role-existing-user.md:68-70` ("give an administrator a way to
  change an assignment (close the previous one and open a new one)", Taiga refs 42 y 43).
- **Los GET no muestran qué rol tiene el usuario.** `GET /api/user` y `GET /api/user/{id}` devuelven `role` y
  `activeAssignments` en `null` (G-13), y `UserResponseDTO` (`security/dto/UserResponseDTO.java:18-28`) no tiene
  organismo ni vigencia. Aun con el cierre resuelto, el front no podría mostrar el rol actual ni desde cuándo rige.
- El response del propio `role-assignments` (`buildUserResponse`, `UserService.java:690-701`) trae el rol **vigente
  hoy**, que no es necesariamente el recién asignado si la asignación empieza en el futuro.

**Impacto en el front:** BO-24 ("Asignar rol a un usuario existente") no se puede construir: la acción respondería 409
en todos los casos reales. Para corregir un rol mal cargado hoy hay que crear otro usuario.

**Propuesta concreta**
1. Cierre de la asignación vigente, por una de estas dos vías (o las dos):
   - **Cierre automático al asignar:** si el usuario tiene una asignación abierta, `role-assignments` le pone
     `effectiveTo = effectiveFrom` de la nueva (el `[)` de la exclusión de `V2.26` admite períodos consecutivos) y crea
     la nueva en la misma transacción.
   - **Endpoint explícito:** `PATCH /api/user/{id}/role-assignments/{assignmentId}` con `{ "effectiveTo": "2026-12-01" }`
     (o `DELETE` = cerrar hoy), con el mismo permiso y las mismas reglas de alcance.
2. Que `GET /api/user`, `GET /api/user/{id}` y el response de `role-assignments` devuelvan el rol y sus asignaciones:

```json
{
  "id": "…", "email": "…", "accountActive": true,
  "role": { "id": "…", "code": "AGENT", "scopeType": "organismo" },
  "organismId": "…", "organismName": "Dirección General de Rentas",
  "activeAssignments": [
    { "id": "…", "roleId": "…", "roleCode": "AGENT", "organismId": "…",
      "effectiveFrom": "2026-11-16", "effectiveTo": null }
  ]
}
```
   Hoy `activeAssignments` está tipado como `Set<RoleResponseDTO>` (`UserResponseDTO.java:27`), sin id de asignación ni
   fechas: no alcanza para ofrecer "cerrar".

**Criterio de aceptación**
- [ ] A un usuario recién creado (rol A, asignación abierta) se le puede asignar el rol B sin intervención en la base;
  queda con un único rol vigente.
- [ ] Asignar un rol con vigencia superpuesta a una asignación **cerrada o con fin** sigue respondiendo 409 `4081`.
- [ ] `GET /api/user/{id}` y `GET /api/user` devuelven rol, organismo, vigencia y `activeAssignments` (no `null`).
- [ ] El response de `role-assignments` incluye la asignación creada (con su `id`, `effectiveFrom` y `effectiveTo`).

---

## G-21 · `LocalDate.MAX` en la consulta de solapamiento de asignaciones

**Prioridad:** 🔵 a confirmar · **Tipo:** bug · **NO confirmado en ejecución**: surge de leer el código (`dev` @ `58d383a`).

**Problema**
- Cuando el request de `role-assignments` no trae `effectiveTo`, `validateNoOverlappingAssignment` pasa
  **`LocalDate.MAX`** como fin de período (`security/service/UserService.java:283-286`), y la consulta compara
  `ura.effectiveFrom <= :periodEnd` (`security/repository/UserRoleAssignmentRepository.java:31`).
- `LocalDate.MAX` es `+999999999-12-31`, muy por encima del máximo de `date` en PostgreSQL (año 5874897). Según cómo se
  enlace el parámetro, el resultado puede ser un error de la base (→ **500 `5000`**) o un valor desbordado que haga que
  la comparación no matchee (→ **solapamiento no detectado**). En el segundo caso el `INSERT` choca contra el índice
  único o la exclusión de `V2.26` (`:30-39`), que tampoco se manejan: también **500**.
- `UserServiceTest` (`src/test/…/security/service/UserServiceTest.java`) mockea el repositorio con Mockito, así que
  la consulta nunca corre contra PostgreSQL. Es la misma clase de problema que G-15.
- Está tapado por G-20: mientras todo usuario tenga una asignación abierta, el caso con `effectiveTo` informado da 409
  antes de llegar acá; el camino sin `effectiveTo` (el default del endpoint) es justamente el que usa el centinela.

**Impacto en el front:** "Asignar rol" sin fecha de fin es el caso más común de BO-24. Si responde 500, el usuario ve un
error genérico en vez de "ya tiene un rol vigente".

**Propuesta**
- No usar centinela: `(:periodEnd is null or ura.effectiveFrom <= :periodEnd)` con el parámetro tipado
  (`cast(:periodEnd as date)`, la lección de G-15), o dos consultas (con y sin fin).
- Capturar la violación de `uk_user_role_assignments_active` / `ex_user_role_assignments_no_overlap` y responder 409
  `4081` (cubre además dos requests concurrentes).
- Test de integración contra PostgreSQL, como `OrganismProcedurePostgresTest`.

**Criterio de aceptación**
- [ ] Confirmado (o descartado) en ejecución contra PostgreSQL: `POST …/role-assignments` sin `effectiveTo` sobre un
  usuario con asignación abierta → 409 `4081`, no 500.
- [ ] Sobre un usuario sin asignación vigente → 201.
- [ ] Una violación de las constraints de `V2.26` → 409 `4081`, no 500.

---

## G-22 · ADMIN_BACKOFFICE tiene `CREATE_USER` pero `role-assignments` le responde siempre 403

> **Confirmado en ejecución 2026-11-20 (e2e contra staging; `AB-USR-02` y `AB-USR-06` en `e2e/final_runs/fichas_2026-11-19/08_roles_fichas_y_sesion/`).**
> Con ADMIN_BACKOFFICE, `GET /api/role/allowed` → 200 con `USER`, `ADMIN_ORGANIZATION`, `AGENT` y un rol de muestra
> creado por el e2e con el flag: solo roles `assignableByBackoffice`, sin `SUPERADMIN`, `ADMIN_BACKOFFICE` ni `MANAGER`
> (SUPERADMIN recibe todos, `SA-USR-02`). `POST /api/user` con rol `SUPERADMIN` → **403 `4029`**. No se ejercitó
> `role-assignments` (sigue tapado por G-20).

> **Estado 2026-11-19 (`dev` @ `586b670`):** ✅ **Resuelto en `dev` (`a69925e`, PPDT-5.1), en staging desde el 2026-11-19
> (OPS-1).** La definición quedó: **AB sí asigna**, con la misma regla que en el alta.
> `validateRoleAssignmentPermissions` (`security/service/UserService.java:294-325`) suma la rama de ADMIN_BACKOFFICE
> (`:308-313`): pasa si el rol destino tiene `assignableByBackoffice = true` (según `V2.16`: `USER`, `AGENT` y
> `ADMIN_ORGANIZATION`) y recibe 403 `4029` si no. Quedó documentado en
> `docs/architecture/04_seguridad_y_autorizacion.md` y como FR-BACKOFFICE-09 (`docs/requirements.md`). Cubierto por
> `UserServiceTest`; no ejecutado por el front.
> - **No se hizo:** el código propio para "combinación rol/organismo inválida" (3.er criterio). Rol global con
>   organismo y rol de organismo sin organismo siguen saliendo como 403 `4029` (`:297-301`), antes de mirar quién es el
>   actor.
> - **En la práctica sigue tapado por G-20:** aunque AB ya pasa la autorización, el pedido choca con la asignación
>   abierta del usuario y responde 409 `4081`.
> - **A confirmar:** `assignRole` no aplica la protección de cuentas privilegiadas de PPDT-5.1 (no llama a
>   `validateUserMutationAccess`): AB podría asignarle un rol delegable a un usuario que hoy es SA o AB si su asignación
>   tiene fecha de fin. Hoy también lo frena G-20 en el caso común. Leído en el código, no ejecutado.

**Prioridad:** 🟡 importante · **Tipo:** contrato (definición) · Detectado en la auditoría del 2026-11-16; no ejecutado.

**Problema**
- `POST /api/user/{id}/role-assignments` exige `CREATE_USER` (`security/controller/UserController.java:79-80`), y AB lo
  tiene (`V2.9__normalize_permission_codes_and_expand_catalog.sql:59-70`).
- Pero `validateRoleAssignmentPermissions` (`security/service/UserService.java:294-318`) solo deja pasar a SUPERADMIN
  (`:304-306`) y a ADMIN_ORGANIZATION con un rol `assignableByOrgAdmin` de su propio organismo (`:308-317`). Cualquier
  otro actor —AB incluido— recibe **403 `4029`** en todos los casos.
- En cambio, el **alta** sí contempla a AB: puede crear usuarios con los roles marcados `assignableByBackoffice`
  (`:577-587`; `V2.16` los pone en `USER`, `AGENT` y `ADMIN_ORGANIZATION`). Las dos reglas no coinciden: AB puede crear
  un AGENT pero no reasignarle el rol.
- El 403 llega como `MessageDTO` desde el servicio, igual que "rol global con organismo" o "rol de organismo sin
  organismo" (`:295-301`): con el mismo `4029` el front no distingue "no tenés permiso" de "combinación inválida".

**Impacto en el front:** el front gatea por permiso. Con `CREATE_USER`, AB vería "Asignar rol" y recibiría 403 siempre.
Hace falta saber si es intencional para ocultarle la acción (regla por rol, como en Roles/Permisos) o esperar el fix.

**Qué se pide** — una definición, y el código alineado a ella:
- **Si AB debe poder asignar:** aplicar en `role-assignments` la misma regla que en el alta (roles con
  `assignableByBackoffice`).
- **Si no debe:** documentarlo y, de ser posible, separar el permiso (`ASSIGN_ROLE` o similar) para que el front pueda
  gatear sin mirar el rol.
- En cualquier caso, un código distinto para "combinación rol/organismo inválida" (hoy `4029`), que es un error de
  datos y no de permisos (400/409).

**Criterio de aceptación**
- [x] La regla de quién asigna roles está documentada y coincide entre `POST /api/user` y `role-assignments`.
- [x] Con AB: 201 para los roles que le correspondan (pasa la autorización; el 201 real depende de G-20), o el endpoint deja de estar habilitado por un permiso que AB tiene.
- [ ] Rol global con `organismId`, o rol de organismo sin `organismId` → 4xx con código propio, distinto de `4029`.

---

## G-23 · Ningún rol es asignable por ADMIN_ORGANIZATION

> **Confirmado en ejecución 2026-11-20 (e2e contra staging, backend `586b670`; `AO-USR-01` y `AO-USR-02` en
> `e2e/final_runs/fichas_2026-11-19/08_roles_fichas_y_sesion/`, `FS-ORG-AO-05` en el script 07).** La cuenta ADMIN_ORGANIZATION de prueba tiene `CREATE_USER` (la
> lista de usuarios, acotada a su organismo, le ofrece "Nuevo usuario") y `GET /api/role/allowed` le responde **200 con
> `[]`**: ningún rol tiene `assignableByOrgAdmin`. El alta se abre y muestra "No hay roles que puedas asignar": no puede
> dar de alta a nadie. Es una de las 3 FALLA de la corrida (`AO-USR-02`) y dejó sin cubrir `FS-ORG-AO-05` (el organismo
> de solo lectura en ese form). **Cambió respecto del "Impacto en el front" de abajo:** desde que `/me` trae el
> organismo (G-2), AO ya llega al form sin `READ_ORGANISM`; lo único que lo frena es este flag.
> De paso, la lista de SUPERADMIN (`SA-USR-02`) incluye `TEST_1`, que el e2e anterior había registrado como rol
> inactivo (`e2e/INFORME_E2E_ROLES.md`): coincide con la nota de abajo sobre `/allowed` y los roles inactivos.

**Prioridad:** 🟡 importante · **Tipo:** bug (seed) · Detectado en la auditoría del 2026-11-16, en las migraciones; no ejecutado.

**Problema**
- `roles.assignable_by_org_admin` se crea con `DEFAULT FALSE` (`V0.2__align_identity_access_to_der.sql:6`, como
  `asignable_por_org_admin`; `V1.13__rename_role_columns_to_english.sql:3` la renombra). **Ninguna migración la pone en
  `TRUE`** para ningún rol: `V2.16:4-6` solo setea `assignable_by_backoffice`.
- AO tiene `CREATE_USER` desde el seed inicial (`V0.1_permissions_standard_seed.sql:73`, comentado "CREATE_USUARIO
  (Local)"), pero con el flag en `FALSE`:
  - `POST /api/user` → **403 `4029`** para cualquier rol (`security/service/UserService.java:589-597`).
  - `POST /api/user/{id}/role-assignments` → **403 `4029`** (`:308-312`).
  - `GET /api/role/allowed` → **`data: []`** (`security/controller/RoleController.java:127-150` filtra por
    `isAssignableByOrgAdmin`).
- Solo se destraba a mano: SUPERADMIN puede editar el rol con `assignableByOrgAdmin: true` (`PUT /api/role/{id}`,
  `security/service/RoleService.java:85`). En una base nueva, AO no puede dar de alta a nadie.

**Impacto en el front:** el form de usuario le muestra a AO un select de rol vacío. Hoy el front además exige
`READ_ORGANISM` para el alta (`PERMISSION_PREREQUISITES`), así que AO ni llega al form; aun resolviendo eso (G-2), el
alta seguiría bloqueada por este flag.

**Verificado el 2026-11-19 (`586b670`, leído en el código, no ejecutado) — `GET /api/role/allowed` filtra bien; no hace
falta un pedido aparte.** El controller (`security/controller/RoleController.java:127-150`) devuelve todos los roles a
SUPERADMIN (`:137-139`), los de `assignableByBackoffice` a ADMIN_BACKOFFICE y los de `assignableByOrgAdmin` al resto
(en la práctica ADMIN_ORGANIZATION, por el `@PreAuthorize` de `:129`) (`:144-148`). Son los mismos flags que valida el
alta (`UserService.java:584-604`) y `role-assignments` (`:308-319`), así que el select de rol no ofrece nada que
después dé 403 `4029` por el flag. Tres diferencias menores, por si sirven:
- `/allowed` decide quién consulta por las autoridades del **token** (`:133-143`) y el servicio por la **asignación
  vigente** en la base (`getCurrentRoleCode`, `UserService.java:729-731`): si el rol cambió después de emitido el token,
  pueden no coincidir hasta el próximo login.
- `/allowed` incluye los roles **inactivos** (`RoleService.getRoles`, `security/service/RoleService.java:42-46`, es un
  `findAll` sin filtrar `active`), y el alta no mira `active` del rol (`UserService.java:226-232`). Pero un rol inactivo
  no cuenta como asignación vigente (`getActiveAssignments`, `:789`): un usuario creado con ese rol quedaría sin rol
  vigente y recibiría 403 `4029` en `/me` y en todo lo demás. **A confirmar**; lo simple es que `/allowed` filtre
  `active = true` (o que el alta rechace un rol inactivo).
- Para ADMIN_ORGANIZATION, `/allowed` y el alta miran solo el flag, mientras que `role-assignments` exige además que el
  rol sea de alcance organismo (`UserService.java:315-317`). Hoy no se nota porque ningún rol tiene el flag.

**Propuesta:** una migración como `V2.16` que marque `assignable_by_org_admin = TRUE` para los roles que el
administrador del organismo debe poder otorgar (como mínimo `AGENT`; definir si también `ADMIN_ORGANIZATION`), filtrando
por el código sin prefijo.

**Criterio de aceptación**
- [ ] En una base nueva, con AO, `GET /api/role/allowed` devuelve al menos `AGENT`. *(2026-11-20, en ejecución contra staging: hoy devuelve `[]`)*
- [ ] Con AO, `POST /api/user` con rol `AGENT` → 201, y el usuario queda en el organismo del AO.
- [ ] Con AO, `POST /api/user` con rol `SUPERADMIN` o `ADMIN_BACKOFFICE` → 403 `4029`.

---

## G-24 · AGENT conserva por otra vía lo que `V2.30` le quitó

**Prioridad:** 🟡 importante · **Tipo:** bug (autorización) · Detectado en la auditoría del 2026-11-16; no ejecutado.

**Problema**
1. **Adopciones.** `V2.30__revoke_agent_adoption_management_grants.sql:1` declara la intención: "AGENT reads and edits
   adoptions of its organism, but does not create or disable them", y le quita `CREATE_ADOPTION` y `DELETE_ADOPTION`
   (`:7-15`). Pero AGENT conserva `UPDATE_ADOPTION`, y el `PUT` (`controller/OrganismProcedureController.java:56-57`)
   copia `enabled` del request (`service/OrganismProcedureService.java:85`): **un `PUT` con `enabled: false` hace
   exactamente lo que hace el `DELETE`** (`:91-97`). Con el mismo `PUT` puede además volver a habilitarla, cambiar la
   vigencia o cambiarle la plantilla (`:82-87`).
2. **Fichas.** El `DELETE` de la ficha exige **`UPDATE_VARIANT`**, no `DELETE_VARIANT`
   (`controller/OrganismProcedureLocationController.java:83-84`), y además de desactivarla la pasa de `PUBLICADO` a
   `DESPUBLICADO` (`service/OrganismProcedureLocationService.java:104-112`). AGENT tiene `UPDATE_VARIANT` y no tiene
   `PUBLISH_VARIANT` (`V0.1:79-85`): **puede despublicar desactivando**, salteando el permiso que protege `unpublish`
   (`:76-77`). `DELETE_VARIANT` existe en el catálogo (`V2.9:20`) y ningún `@PreAuthorize` lo usa.
3. Mismo efecto sin pasar por el `DELETE`: un `PUT` de la ficha con `active: false` (`UPDATE_VARIANT`,
   `OrganismProcedureLocationService.java:80`) la saca del portal, porque las consultas públicas filtran
   `otl.active = true` (`repository/OrganismProcedureLocationRepository.java:30, 49`), y la ficha sigue figurando
   `PUBLICADO` en el backoffice.

**Impacto en el front:** en el detalle de la adopción, "Deshabilitar" se gatea con `DELETE_ADOPTION`, pero el bloque
de edición (`UPDATE_ADOPTION`) incluye el interruptor "Habilitado", porque el `PUT` lo acepta: un AGENT lo ve. En
fichas, "Despublicar" se gatea con `PUBLISH_VARIANT`. La UI no puede ser más estricta que la API sin inventar reglas
por rol, y aunque lo fuera no protege contra llamadas directas.

**Propuesta**
- Adopciones: en `update`, cambiar `enabled` solo si el actor tiene `DELETE_ADOPTION` (deshabilitar) o
  `CREATE_ADOPTION` (rehabilitar); si no, conservar el valor actual o responder 403 `4029`. Definir qué campos edita
  AGENT (¿solo la vigencia?).
- Fichas: `DELETE` con `DELETE_VARIANT`; y que desactivar una ficha `PUBLICADO` (por `DELETE` o por `PUT` con
  `active: false`) exija `PUBLISH_VARIANT`, o que se rechace con un 409 "despublicala primero".

**Criterio de aceptación**
- [ ] Con AGENT, `PUT /api/organism-procedure/{id}` con `enabled: false` sobre una adopción habilitada → 403 (o 200 sin
  cambiar `enabled`).
- [ ] Con AGENT, `DELETE /api/organism-procedure-location/{id}` → 403.
- [ ] Con AGENT, `PUT` de una ficha `PUBLICADO` con `active: false` → 4xx; la ficha sigue visible en
  `GET /api/procedure/{slug}`.
- [ ] La matriz rol × permiso documentada coincide con lo que cada rol puede hacer por API.

---

## G-25 · Textos de error que no corresponden al error

> **Verificado el 2026-11-20 (`dev` @ `586b670`, leído en el código, no ejecutado): sigue igual.**
> `UserService.createUser` (`security/service/UserService.java:226-228`) responde 404 `4018` cuando el rol no existe, y
> `messages/messages.properties:57` sigue diciendo "Las contraseñas no coinciden." Lo mismo en `role-assignments`
> (`:249-251`) y en `validateUserCreationPermissions` (`:576-578` en `586b670`; la tabla cita `:569-571`, de `58d383a`).

**Prioridad:** 🔵 mejora · **Tipo:** bug · Detectado en la auditoría del 2026-11-16 (`dev` @ `58d383a`).

**Problema** — el status y el `code` son razonables, pero el `message` que llega al cliente dice otra cosa:

| Dónde | Código | El mensaje dice | Lo que pasó |
|---|---|---|---|
| `POST /api/user` y `role-assignments` (`security/service/UserService.java:226-228, 249-251, 569-571`) | 404 `4018` | "Las contraseñas no coinciden." (`messages/messages.properties:57`) | El rol no existe. El código correcto ya existe y se usa en el registro (`:161-163`) y en `RoleService`: `4059` "Rol no encontrado." (`messages.properties:91`) |
| `role-assignments` (`UserService.java:244-247`) | 409 `4002` | "El usuario ya está registrado. Por favor, intente con otro email/cuit." (`messages.properties:33`) | El usuario está inactivo. Existe `4001` "El usuario actualmente se encuentra inactivo…" (`messages.properties:28`) |
| `POST /api/user` y `POST /api/auth/register` (`security/dto/userprofile/CreateUserRequest.java:26`, `security/dto/UserRequestDTO.java:27`) | 400 `4012` | "La contraseña debe tener entre 8 a 30 caracteres" | El máximo real es **20** (`utils/AppConstants.java:10`, `PASSWORD_MAX_LENGTH`), que es el que aplica el `@Size` |
| `role-assignments` (`UserService.java:275-280`) | 400 `4011` | "Verifique el elemento enviado para realizar la búsqueda, inserción o eliminación." (`messages.properties:45`) | `effectiveTo` no es posterior a `effectiveFrom` |
| `PUT /api/user/{id}/change-password` (`security/controller/UserController.java:147-157`) | 406 `4034` | "La contraseña no cumple con los requisitos mínimos de seguridad." (`messages.properties:118`) | Se le pasan mínimo y máximo como argumentos, pero el texto no tiene placeholders: no dice cuáles son los requisitos |

**Impacto en el front:** el front muestra el `message` del backend cuando no tiene traducción propia para el código. Con
estos casos tiene que mantener traducciones por endpoint (un `4018` significa cosas distintas según quién lo emite).

**Propuesta:** `4059` para rol inexistente; `4001` (o un código nuevo) para usuario inactivo; corregir el texto a "entre
8 y 20 caracteres" (idealmente armado con las constantes); un código con mensaje propio para el período inválido; y un
`4034` que enumere los requisitos (8 a 20 caracteres, mayúscula, minúscula y número: `utils/UtilsCommons.java:90-98`).

**Criterio de aceptación**
- [ ] `POST /api/user` con un `role` inexistente → 404 `4059` "Rol no encontrado."
- [ ] `role-assignments` sobre un usuario inactivo → 409 con un mensaje que hable de la cuenta inactiva.
- [ ] El mensaje de validación de contraseña coincide con el límite real.
- [ ] Opcional: `MessagesPropertiesConsistencyTest` (ver G-6) cubre que el código usado corresponda al caso.

---

## G-26 · Cuentas privilegiadas: el front no puede saber a quién no puede tocar ADMIN_BACKOFFICE

> **Confirmado en ejecución 2026-11-20 (e2e contra staging, backend `586b670`; `AB-USR-03` a `AB-USR-06` en
> `e2e/final_runs/fichas_2026-11-19/08_roles_fichas_y_sesion/`).** Con ADMIN_BACKOFFICE sobre cuentas de muestra con rol SUPERADMIN y ADMIN_BACKOFFICE:
> desactivar la cuenta → **403 `4029`**; cambiar el email → 403 `4029`; baja lógica (`PUT /api/user/{id}`) → 403 `4029`;
> baja definitiva (`DELETE /api/user/{id}/admin`) → 403 `4029`; alta con rol `SUPERADMIN` → 403 `4029`. Ninguna cuenta
> cambió. El contrato de PPDT-5.1 funciona; **el pedido sigue abierto**: el listado sigue sin decir qué rol tiene cada
> usuario, así que el front le ofrece a AB las acciones y recién explica el rechazo después del 403 (con texto propio).

**Prioridad:** 🟡 importante · **Tipo:** contrato · Detectado en la auditoría del 2026-11-19 (`dev` @ `586b670`, commit `a69925e`), leyendo el código; **no ejecutado**.

**Contexto — contrato nuevo de PPDT-5.1 (no era pedido nuestro):** desde `a69925e`, cuando el actor es
ADMIN_BACKOFFICE y el usuario destino tiene una asignación vigente `SUPERADMIN` o `ADMIN_BACKOFFICE`, responden
**403 `4029`** (`MessageDTO`):

| Endpoint | Permiso | Servicio |
|---|---|---|
| `PUT /api/user/{id}` (baja lógica) | `DELETE_USER` | `deleteLogicalUserById` (`security/service/UserService.java:136-140`) |
| `DELETE /api/user/{id}/admin` (baja definitiva) | `DELETE_USER` | `deleteDefinitiveUserById` (`:149-153`) |
| `PATCH /api/user/{id}/change-email` | `UPDATE_USER` | `updateEmail` (`:468-472`) |
| `PUT /api/user/{id}/status-account` | `UPDATE_USER` | `changeAcountStatus` (`:484-492`) |

La regla está en `validateUserAccess` (`:668-691`, rama de AB en `:676-682`). SUPERADMIN conserva todo. Se suma al
`PUT /api/user/{id}/change-password`, que ya respondía 403 `4029` sobre cuentas SA/AB para cualquier actor
(`security/controller/UserController.java:138-147`). Documentado en `docs/architecture/04_seguridad_y_autorizacion.md`
y como FR-BACKOFFICE-10.

**Problema**
1. **El front no puede anticipar el 403.** La regla depende del rol vigente del usuario **destino**, y `GET /api/user`
   y `GET /api/user/{id}` devuelven `role` y `activeAssignments` en `null` (G-13). El backoffice gatea por permiso: AB
   tiene `UPDATE_USER` y `DELETE_USER`, así que ve "Cambiar email" y "Desactivar cuenta" en **todas** las filas, y en
   las de SA/AB la acción falla recién al confirmar.
2. **Incluye la cuenta propia.** El chequeo no excluye al actor (`hasAnyActiveRole(targetUser.getId(), …)`, `:677-678`):
   un AB tampoco puede cambiar su propio email ni desactivarse por estos endpoints, y `PUT /api/user/update-profile`
   solo cambia nombre, apellido y CUIL. Si es intencional, falta decirlo; si no, hoy el email de un AB solo lo cambia
   un SUPERADMIN.
3. **El detalle del error habla de otra cosa.** `forbiddenUserManagement()` (`:703-710`) arma el `4029` con
   `error.user.creation.permission.denied` = "El rol autenticado no tiene permisos para crear usuarios."
   (`messages/messages.properties:151`), también cuando lo que se intentó fue dar de baja o cambiar un email. Es el
   mismo tipo de problema que G-25.
4. **`role-assignments` quedó fuera de la protección** (ver "A confirmar" en G-22).

**Impacto en el front:** el menú de la fila le ofrece a AB acciones que el backend rechaza, y el detalle que llega no
explica por qué: hace falta un texto propio para el `4029` de estas acciones.

**Propuesta concreta**
- Resolver G-13 (rol y asignaciones en `UserResponseDTO`); con eso el front oculta las acciones sobre SA/AB cuando el
  actor es AB. Alternativa más barata: un booleano por usuario en el listado, calculado para quien consulta
  (`"managedByCurrentUser": false`).
- Un detalle propio para este caso ("No podés modificar una cuenta de administrador"), distinto del de alta de usuarios.
- Definir y documentar el caso de la cuenta propia.

**Criterio de aceptación**
- [ ] Con AB, `GET /api/user` permite distinguir las cuentas SA/AB (por `role` o por un flag).
- [ ] El 403 `4029` de estas cuatro operaciones trae un detalle que corresponde al caso.
- [ ] Está documentado si un AB puede cambiar su propio email y por dónde.

---

## G-27 · Ficha de una adopción no vigente: 404 "no existe" y fichas que no se pueden editar

**Prioridad:** 🟡 importante · **Tipo:** contrato (definición) · Detectado en la auditoría del 2026-11-19 (`dev` @ `586b670`, commit `1888e1a`), leyendo el código; **no ejecutado**.

**Contexto:** `1888e1a` resolvió G-12 §3: `loadOrganismProcedure`
(`service/OrganismProcedureLocationService.java:146-161`) rechaza con 404 `4073` la adopción que no está vigente
(`:157-159`; `isEffectiveAt`, `entity/OrganismProcedure.java:74-78`: `enabled`, `effectiveFrom <= ahora` y `effectiveTo`
nulo o posterior). El método se usa en el alta (`buildEntity`, `:135`) **y en la edición** (`update`, `:84`). El propio
backend lo declara intencional (`odd/tasks/claudinio-otl-validity.md`: "An OTL cannot be created or updated over a
disabled adoption").

**Problema**
1. **El error no se distingue de "no existe".** La adopción existe y el usuario la está viendo en pantalla, pero la
   respuesta es 404 `4073` "El objeto OrganismProcedure con el identificador … no existe." El front no puede mostrar
   "la adopción no está vigente" sin adivinar: el mismo código sale por adopción inexistente o de otro organismo
   (`:150-155`).
2. **Las fichas existentes quedan sin poder editarse.** Cuando una adopción vence o se deshabilita, cualquier `PUT` de
   sus fichas responde 404: no se puede corregir un requisito ni desactivarla con `active: false`. Sí siguen
   funcionando el `DELETE` (`:114-122`) y las transiciones (`:100-112`), que no validan la adopción: una ficha de una
   adopción vencida todavía se puede **publicar** (200), aunque el portal no la muestre (G-9). Combinado con la falta
   de cascada, el backoffice muestra `PUBLICADO` y editable algo que no es ninguna de las dos cosas.
3. **No se pueden preparar fichas antes del inicio de vigencia.** `GET /api/organism-procedure` lista las adopciones
   habilitadas sin mirar las fechas (`service/OrganismProcedureService.java:58-63`), así que una adopción con
   `effectiveFrom` futuro aparece en "Trámites del organismo"; "Agregar localidad" responde 404. No hay forma de dejar
   las fichas en `BORRADOR` listas para el día en que empieza a regir.

**Impacto en el front:** el front calcula `vigente` en el cliente y puede ocultar "Agregar localidad" y "Editar"
sobre adopciones no vigentes, pero es una regla duplicada (y con el reloj del navegador). Para los casos que se le
escapen necesita un código que pueda traducir.

**Ampliación 2026-11-19 — cómo lo resuelve hoy el front, y por qué es frágil** (surge de la implementación contra
`586b670`; leído en el código, no ejecutado):
- Los tres 404 del guardado de una ficha comparten el código `4073` y solo cambia la etiqueta que `notFound`
  (`service/OrganismProcedureLocationService.java:178-181`) interpola en el `message`: `"OrganismProcedure"` (adopción,
  `:151, 155, 158`), `"Location"` (`:175`) y `"OrganismProcedureLocation"` (la ficha, `:167, 170`). Para saber de cuál
  habla, **el front busca esa etiqueta dentro del texto del `message`** ("El objeto OrganismProcedure con el
  identificador … no existe.", `messages/messages.properties:105`). Si cambia la redacción, el idioma o el nombre de la
  clase, deja de reconocerlo.
- Aun leyendo la etiqueta, **adopción inexistente, adopción de otro organismo y adopción no vigente son el mismo
  mensaje, letra por letra** (misma etiqueta y mismo id: `:151`, `:155` y `:158`). El front asume "no vigente" porque es
  el caso más probable y lo dice con un texto que enumera las posibilidades (deshabilitada, todavía no empezó, ya
  venció), sin poder decir cuál.
- El "ahora" con el que el backend decide la vigencia es el de la JVM; ver **G-32** (zona horaria): si la JVM corre en
  UTC, este 404 aparece hasta 3 horas antes de lo que el front calcula como vencimiento.
- Refuerza el primer punto de "Qué se pide": un **código propio** para "adopción no vigente" (y, si se puede, que el
  `details` o un campo diga si es por `enabled`, por `effectiveFrom` o por `effectiveTo`), y que el recurso que no se
  encontró viaje en un campo y no solo dentro del texto.

**Qué se pide**
- Un código propio para "adopción no vigente" (409, como `4077` y `4080`), distinto del `4073`.
- Definir si se pueden crear y editar fichas en `BORRADOR` sobre una adopción **todavía no vigente** (el portal ya las
  filtra por vigencia desde `1888e1a`, así que no se filtrarían al público).
- En el `PUT`, no revalidar la vigencia cuando `organismProcedureId` no cambia (mismo criterio que G-11 §1), o al menos
  permitir `active: false`.
- Aplicar la misma regla a `publish` (G-12 §2), o resolver la cascada (G-9).

**Criterio de aceptación**
- [ ] `POST` de una ficha sobre una adopción vencida o deshabilitada → 409 con código propio y mensaje.
- [ ] `PUT` de una ficha existente cuya adopción venció: 200, o 409 con ese código (no 404 `4073`).
- [ ] Está definido y documentado el caso de la adopción con `effectiveFrom` futuro.
- [ ] `publish` sobre una ficha de una adopción no vigente → mismo código.
- [ ] *(ampliación 2026-11-19)* El cliente distingue "adopción no vigente" de "adopción inexistente o fuera de alcance"
  sin leer el `message`.

---

## G-28 · `slugBase`: canónico vacío y plantillas anteriores sin recanonicalizar

**Prioridad:** 🔵 a confirmar · **Tipo:** bug · Detectado en la auditoría del 2026-11-19 (`dev` @ `586b670`, commit `130c180`); **NO confirmado en ejecución**: surge de leer el código.

**Problema**
1. **El slug canónico puede quedar vacío.** `slugBase` se valida con `@NotBlank` sobre el valor **original**
   (`dto/procedureTemplate/ProcedureTemplateRequestDTO.java:19-20`); `canonicalize`
   (`service/ProcedureTemplateService.java:147-153`) corre después y no vuelve a validar. Un `slugBase` sin letras ni
   números (`"¡¡¡"`, `"---"`) pasa la validación y se canonicaliza a `""`. `create` (`:50-53`)
   persistiría una plantilla con `slug_base = ''` (la columna es `NOT NULL` y única, `V2.18`: lo admite), y la segunda
   respondería 409 `4072` con el identificador vacío.
2. **Las plantillas anteriores al fix no se migraron.** No hay migración que recanonicalice `procedure_templates.slug_base`
   (la única nueva es `V2.31`). `ensureUniqueSlug` (`:101-108`) compara el canónico con `findBySlugBase`
   (`repository/ProcedureTemplateRepository.java:10`, igualdad exacta): si una base tiene `Obtener-DNI` guardado de
   antes, un `obtener-dni` nuevo no lo encuentra y conviven los dos, que es lo que G-10 quería evitar. La plantilla
   vieja se corrige sola recién cuando alguien la edita. Depende de que existan datos así (el 2026-11-16 el listado de
   plantillas de staging estaba vacío).

**Impacto en el front:** el backoffice canonicaliza y valida antes de enviar, así que no genera estos casos; afecta a
otros clientes y a datos previos.

**Propuesta:** validar el resultado de `canonicalize` (vacío → 400 `4012` sobre `slugBase`),
y una migración que canonicalice los `slug_base` existentes resolviendo colisiones.

**Criterio de aceptación**
- [ ] `POST /api/procedure-template` con `slugBase: "¡¡¡"` → 400 `4012`.
- [ ] Tras la migración, ningún `slug_base` difiere de su forma canónica.

---

## G-29 · El filtro de puntos de atención por ficha devuelve solo los activos

> **Confirmado en ejecución 2026-11-20 (e2e contra staging; `FS-PUN-04` en `e2e/final_runs/fichas_2026-11-19/07_fichas_y_sesion/`).** Tras desactivar
> un punto de atención: con `?organismProcedureLocationId=` la API devuelve solo el activo; sin filtro, devuelve también
> el desactivado con `active: false`. El panel muestra el inactivo con "Mostrar inactivos" porque el front lo completa
> con el listado sin filtro.

**Prioridad:** 🟡 importante · **Tipo:** contrato · Detectado en la auditoría del 2026-11-19 (`dev` @ `586b670`, commit `0db49a9`), leyendo el código; **no ejecutado**.

**Problema**
- `GET /api/attention-point` **sin** parámetro devuelve todos los puntos del alcance, activos e inactivos
  (`service/AttentionPointService.java:48-51`: `findAll()` / `findAllByOrganismProcedureLocationOrganismProcedureOrganismId`).
- **Con** `?organismProcedureLocationId=` usa `findAllByOrganismProcedureLocationIdAndActiveTrue` y su variante con
  alcance (`:53-56`; `repository/AttentionPointRepository.java:13-16`): **solo activos**. El mismo endpoint cambia de
  criterio según lleve o no el filtro, y no está documentado (el Postman lo describe como "Optional filter by procedure
  sheet location").
- No hay `active` ni `includeInactive` (estaban en la tabla de G-7), y `GET /api/attention-point/{id}` sí devuelve un
  punto inactivo. Con el filtro no hay forma de listar los inactivos de una ficha.

**Impacto en el front:** el panel de puntos de atención de la ficha tiene el interruptor "Mostrar inactivos" y permite
reactivar un punto con el `PUT` (`active: true`). Si usa el filtro del servidor, los inactivos desaparecen y no se
pueden reactivar; para conservarlos tiene que seguir bajando todos los puntos del alcance y filtrar en el cliente, que
es lo que G-7 quería evitar.

**Propuesta:** que el filtro por ficha no cambie el criterio de `active`, y sumar `?active=true|false` (o
`includeInactive`) como parámetro explícito. Si se prefiere "solo activos" por defecto, que valga también sin filtro y
se avise como cambio de contrato.

**Criterio de aceptación**
- [ ] `GET /api/attention-point?organismProcedureLocationId=…` y `GET /api/attention-point` aplican el mismo criterio
  sobre `active`.
- [ ] Hay un parámetro documentado para incluir o excluir los inactivos.

---

## G-30 · Usuarios: los motivos del 403 `4029` solo se distinguen por el texto

**Prioridad:** 🔵 mejora · **Tipo:** contrato · Detectado el 2026-11-19 al implementar el form de usuarios contra `dev` @ `586b670`, leyendo el código; **no ejecutado**.

**Problema** — en usuarios, el 403 `4029` ("El usuario no tiene permisos para realizar esta acción.",
`messages/messages.properties:71`) es el único código para motivos que piden reacciones distintas del front. Lo único
que cambia es `details`, un texto libre que sale de `messages.properties`:

| # | Motivo | Dónde (`security/service/UserService.java`) | `details` |
|---|---|---|---|
| 1 | Alta: el rol elegido no es asignable por quien crea (AB sin `assignableByBackoffice`, AO sin `assignableByOrgAdmin`) | `:584-592`, `:596-604` | "El rol objetivo no puede ser creado por el rol autenticado." (`messages.properties:149`) |
| 2 | Alta: quien crea es ADMIN_ORGANIZATION y **su cuenta** no tiene organismo | `:605-613` | "El administrador de organización debe pertenecer a una organización." (`:150`) |
| 3 | Alta: el rol elegido es de alcance organismo y el request llegó **sin `organizationId`** | `validateOrganismScopeRequirement`, `:638-649` | **el mismo texto que el #2** (`:150`) |
| 4 | Alta: el rol de quien crea no da de alta usuarios (ni SA, ni AB, ni AO) | `:618-623` | "El rol autenticado no tiene permisos para crear usuarios." (`:151`) |
| 5 | `role-assignments`: combinación rol/organismo inválida (rol global con organismo, o de organismo sin organismo) | `:297-301` | *(sin `details`)* |
| 6 | `role-assignments`: rol no asignable por el actor, actor sin rol de administración, u organismo distinto del propio | `:308-324` → `forbiddenUserManagement` (`:703-710`) | el texto del #4, aunque no se esté creando nada |
| 7 | Baja, estado, email, `GET /{id}`: cuenta privilegiada (PPDT-5.1), usuario de otro organismo, o actor que no es SA/AB/AO | `validateUserAccess`, `:668-691` | el texto del #4 (G-26 §3) |
| 8 | `change-password` sobre una cuenta SA/AB | `security/controller/UserController.java:138-147` | "No se puede cambiar la contraseña de un usuario administrador." (`:152`) |
| 9 | El actor no tiene asignación vigente, o tiene dos igual de prioritarias (cualquier endpoint, también `/me`) | `:427-432`, `:733-741`, `:769-775` | *(sin `details`)* |

Consecuencias:
- **#2 y #3 son indistinguibles.** Uno se arregla en el form (elegir el organismo); el otro no depende de lo que se
  cargue (hay que asignarle un organismo a la cuenta de quien crea). El front muestra un texto que explica las dos cosas.
- **#1 es el único que corresponde marcar en el campo "Rol"**; para saberlo el front compara el `details` **completo**
  contra el texto en español (y contra la clave `error.user.creation.role.restricted`, por si al entorno le falta la
  traducción, como pasó con `response.code.4080`). Un cambio de redacción en `messages.properties` rompe el mapeo sin
  que ningún test lo note.
- **#5 no es un problema de permisos** sino de datos (es el criterio que quedó sin tildar en G-22), y llega igual que #9.
- **#6 y #7 reutilizan el texto de "crear usuarios"** para acciones que no crean nada (G-26 §3).
- De paso, leído en el mismo código: el alta **no** rechaza un rol global que llega con `organizationId`
  (`validateOrganismScopeRequirement` solo mira el caso inverso, `:638-649`), mientras que `role-assignments` sí
  (`:297-301`). La asignación quedaría con organismo para un rol global. **A confirmar.**

**Impacto en el front:** `pages/usuarios/usuario-save-error.ts` mantiene una tabla de textos del backend para decidir
qué campo marcar y qué decirle al usuario, y cae en un mensaje neutro cuando no reconoce el `details`.

**Qué se pide**
- Un código por motivo, o al menos por familia: rol no asignable por el actor · organismo requerido para el rol ·
  la cuenta del actor no tiene organismo · combinación rol/organismo inválida (400/409, no 403) · cuenta privilegiada ·
  usuario fuera del alcance del actor · actor sin rol vigente.
- Alternativa más barata: mantener `4029` y sumar al body un campo estable (`reason: "ROLE_NOT_ASSIGNABLE"`), dejando
  `details` solo como texto para mostrar.
- Que cada texto corresponda a la acción (cierra G-26 §3 y el tercer criterio de G-22).

**Criterio de aceptación**
- [ ] `POST /api/user` con un rol no asignable, con un rol de organismo sin `organizationId` y desde un AO sin
  organismo devuelve tres respuestas distinguibles sin leer texto libre.
- [ ] `role-assignments` con una combinación rol/organismo inválida responde 4xx con código propio, distinto del `4029`.
- [ ] Los códigos o motivos están documentados (Swagger o `docs/architecture/04_seguridad_y_autorizacion.md`).

---

## G-31 · `change-password` no valida el alcance del actor

**Prioridad:** 🟡 importante · **Tipo:** bug (autorización) · Detectado el 2026-11-19 leyendo el código de `dev` @ `586b670`; **no ejecutado**. **Latente:** con los permisos del seed no es explotable hoy (ver "Alcance real").

**Problema**
- `PUT /api/user/{id}/change-password` (`security/controller/UserController.java:135-172`) exige `UPDATE_USER` (`:136`)
  y resuelve todo en el controller, con dos validaciones:
  1. que el usuario destino **no** tenga un rol vigente `SUPERADMIN` o `ADMIN_BACKOFFICE` (`:138-147`, 403 `4029`),
     sin importar quién lo pide;
  2. que la contraseña nueva cumpla el formato (`:149-159`, 406 `4034`).
- Después hace `userSVC.findById(id)` + `userSVC.setPassword(...)` (`:161-162`). **Ninguno de los dos mira quién es el
  actor:** `findById` (`security/service/UserService.java:123-127`) es una búsqueda por id y `setPassword` (`:391-394`)
  codifica y guarda.
- Es **la única mutación de usuario que no pasa por `validateUserAccess`** (`:668-691`), que es donde vive la regla
  "ADMIN_ORGANIZATION solo sobre usuarios de su organismo" (`:688`):

| Endpoint | Permiso | ¿Valida el alcance del actor? |
|---|---|---|
| `GET /api/user/{id}` | `READ_USER` | sí (`findUserDTO`, `:91-95`) |
| `GET /api/user` | `READ_USER` | sí para AO (`findAllUserDTO`, `:103-113`) |
| `PUT /api/user/{id}` (baja lógica) | `DELETE_USER` | sí (`:136-140`) |
| `DELETE /api/user/{id}/admin` | `DELETE_USER` | sí (`:149-153`) |
| `PATCH /api/user/{id}/change-email` | `UPDATE_USER` | sí (`updateEmail`, `:468-472`) |
| `PUT /api/user/{id}/status-account` | `UPDATE_USER` | sí (`changeAcountStatus`, `:484-492`) |
| **`PUT /api/user/{id}/change-password`** | `UPDATE_USER` | **no** |

- **Resultado:** cualquier actor con `UPDATE_USER` puede fijar la contraseña de **cualquier** cuenta que no sea SA/AB:
  un ADMIN_ORGANIZATION, la de un usuario de **otro organismo** (otro AO incluido), o la de un MANAGER o un USER
  (roles globales). Con la contraseña nueva entra como esa persona. El mismo AO recibe 403 `4029` si intenta cambiarle
  el email o desactivar a ese usuario: la regla existe, pero este endpoint la saltea.
- Los tests no cubren el alcance: `UserControllerTest` (`src/test/…/security/controller/UserControllerTest.java:164-239`)
  prueba el rechazo sobre cuentas admin y la contraseña débil; `UserControllerSecurityTest` (`:34`), solo la anotación.

**Alcance real (por qué "latente")**
- En el seed, `UPDATE_USER` lo tienen solo SUPERADMIN (todos los permisos) y ADMIN_BACKOFFICE
  (`V2.9__normalize_permission_codes_and_expand_catalog.sql:59-70`), los dos de alcance global. ADMIN_ORGANIZATION tiene
  `CREATE_USER` y `READ_USER` (`V0.1_permissions_standard_seed.sql:73-74`); AGENT y MANAGER, ninguno de usuarios. Con
  esos grants **nadie de alcance organismo llega al endpoint**.
- Se vuelve real en cuanto un rol de alcance organismo reciba `UPDATE_USER`, y eso está a un clic: SUPERADMIN edita los
  permisos de un rol desde la pantalla de Roles del backoffice, y la documentación del propio backend dice que AO debe
  poder editar a los suyos ("`ADMIN_ORGANIZATION` solo puede listar, consultar, crear, **editar y desactivar** usuarios
  cuyo rol vigente pertenezca a su organismo", `docs/architecture/04_seguridad_y_autorizacion.md:111-112`). Para cumplir
  esa frase hay que darle `UPDATE_USER` a AO, y ese mismo grant abre este hueco.

**A confirmar con backend — rol que no es SA, AB ni AO con permisos de usuario (por ejemplo MANAGER con `UPDATE_USER`)**
Según `validateUserAccess` (`:684-686`), cualquier actor cuyo rol vigente no sea SUPERADMIN, ADMIN_BACKOFFICE ni
ADMIN_ORGANIZATION recibe **403 `4029` en toda acción sobre otro usuario**, tenga el permiso que tenga: `GET /{id}`,
cambio de email, cambio de estado y las dos bajas. Es decir, darle `UPDATE_USER` o `READ_USER` a MANAGER o a AGENT desde
la pantalla de Roles no habilita nada… salvo dos excepciones que no pasan por esa función:
- `change-password`, que le funcionaría sobre cualquier cuenta no SA/AB (este pedido);
- `GET /api/user`, que le devolvería **todos** los usuarios (`findAllUserDTO`, `:103-113`, solo filtra cuando el actor
  es AO), aunque después el `GET /{id}` de cada uno le responda 403.

¿Es lo esperado que la gestión de usuarios esté atada a esos tres roles además del permiso? Si lo es, pedimos que quede
documentado (el front gatea por permiso y le mostraría a ese rol acciones que siempre fallan) y que las dos excepciones
se alineen. Nota relacionada: para AO, `validateUserAccess` rechaza siempre las bajas (`deletion ||`, `:688`), lo que
coincide con la documentación ("la eliminación… queda reservada a administradores globales").

**Impacto en el front:** "Cambiar contraseña" se ofrece por permiso (`UPDATE_USER`), como el resto de las acciones de
cuenta. El listado de un AO ya viene filtrado por organismo, así que la UI no ofrecería la acción sobre usuarios
ajenos; pero la protección tiene que estar en la API: el id va en la URL.

**Propuesta concreta**
- Mover la lógica a `UserService` (hoy está en el controller) y pasar por `validateUserAccess`, igual que
  `changeAcountStatus`: mismo alcance para AO, misma protección de cuentas privilegiadas para AB.
- Definir si SUPERADMIN puede cambiar la contraseña de otra cuenta SA/AB (hoy no puede nadie, `:138-147`; en el resto
  de las acciones SUPERADMIN "conserva autoridad sobre esas cuentas").
- Deseable: revocar las sesiones del usuario al cambiarle la contraseña, como hace `changeAcountStatus` al desactivar
  (`refreshTokenSessionService.revokeAllUserSessions`, `:489-491`). No se verificó si hoy quedan vivas.

**Criterio de aceptación**
- [ ] Con ADMIN_ORGANIZATION (con `UPDATE_USER` otorgado), `change-password` sobre un usuario de otro organismo → 403
  `4029`; sobre uno del suyo → 200.
- [ ] Con un rol que no es SA, AB ni AO y tiene `UPDATE_USER` → la misma respuesta que en `change-email` y
  `status-account`.
- [ ] Test de servicio o de controller que cubra el alcance (hoy no hay ninguno).
- [ ] Está documentado qué roles pueden gestionar usuarios además de tener el permiso, y `GET /api/user` aplica la
  misma regla que `GET /api/user/{id}`.

---

## G-32 · Zona horaria de la vigencia de las adopciones

**Prioridad:** 🟡 importante · **Tipo:** bug + ops · Detectado el 2026-11-19 leyendo el código y la configuración de `dev` @ `586b670`; **NO confirmado en ejecución** y **no se sabe en qué zona corre la JVM de staging ni la de producción**.

**Problema**
- `organism_procedures.effective_from` / `effective_to` son `TIMESTAMPTZ` (`V2.12__create_organism_procedure_flow.sql:7-8`),
  pero la entidad los mapea a `LocalDateTime` (`entity/OrganismProcedure.java:50-54`) y los DTOs también
  (`dto/organismProcedure/OrganismProcedureRequestDTO.java:30, 32`; `OrganismProcedureResponseDTO.java:21-22`). Por la
  API viajan **sin zona** (`"2026-12-01T00:00:00"`): el backend los interpreta, y los vuelve a leer de la base, en la
  zona por defecto de la JVM.
- La vigencia se decide con el reloj de pared de la JVM: `isEffectiveAt(LocalDateTime.now())`
  (`service/OrganismProcedureLocationService.java:157`; `entity/OrganismProcedure.java:74-78`), y lo mismo en la
  búsqueda pública (G-9).
- **Nada fija esa zona:**
  - `Dockerfile:14` usa `eclipse-temurin:17-jre` y `:27` define `JAVA_TOOL_OPTIONS` sin `-Duser.timezone`; no hay `ENV TZ`.
  - `docker/docker-compose.backend.yml:9-15` y `docker/docker-compose.backend-dev.yml:12-18` no pasan `TZ`;
    `docker/docker-compose.yml:4-10` (PostgreSQL) tampoco (`TZ` / `PGTZ`).
  - `.env.example` (35 líneas) y `docker/.env.docker.example` (14) no tienen ninguna variable de zona.
  - `application*.properties` no tienen `spring.jackson.time-zone` ni `hibernate.jdbc.time_zone`, y en `src/main` no
    hay `TimeZone.setDefault` ni `ZoneId` (búsqueda en todo el repo). El `ObjectMapper`
    (`config/AppGlobalConfig.java:16-19`) solo desactiva `WRITE_DATES_AS_TIMESTAMPS`.
  - En un contenedor sin `TZ`, la JVM queda en **UTC**. Es lo que cabe esperar con este `Dockerfile` si el
    orquestador de staging/prod no inyecta la variable; **no lo pudimos verificar**.
- **Efecto si la JVM está en UTC** (Argentina es UTC−3 todo el año): quien carga la adopción escribe horas de
  Argentina, y el backend las toma como UTC. Una vigencia "desde el 01/12 a las 00:00" rige desde el **30/11 a las
  21:00** de Argentina, y una "hasta el 31/12 a las 23:59" vence a las **20:59**. Durante esas 3 horas:
  - el portal ya muestra (o ya dejó de mostrar) el trámite (`/api/procedure/search`, `/api/procedure/{slug}`);
  - el backoffice, que interpreta las mismas fechas como hora local del navegador, muestra la adopción como "todavía
    no vigente" o "vigente" al revés que el backend, y ofrece (o esconde) "Agregar localidad" y "Editar" mal: el `POST`
    y el `PUT` de la ficha responden el 404 `4073` de G-27 sobre una adopción que la pantalla da por vigente.
- **Probablemente reproducible en local, a confirmar:** levantando el backend con estos compose (sin `TZ`) contra un
  navegador en UTC−3.
- Relacionado con el "A confirmar (menor)" de G-9: el detalle público compara contra `CURRENT_TIMESTAMP` y la búsqueda
  contra `LocalDateTime.now()`. Mientras el driver convierta con la zona de la JVM, las dos deberían coincidir; el
  problema es contra qué hora de pared se interpretan los valores, no entre esas dos consultas.

**Impacto en el front:** el front manda y lee `yyyy-MM-ddTHH:mm:ss` en hora local del navegador (es lo que
`LocalDateTime` acepta) y calcula `vigente` con esa misma hora. No puede compensar una diferencia que no conoce: no
sabe en qué zona corre el backend, y hardcodear "+3 horas" rompería el día que se fije.

**Propuesta concreta** — una de dos, y documentarla:
1. **Fijar la zona del backend en `America/Argentina/Buenos_Aires`** (`ENV TZ=America/Argentina/Buenos_Aires` en el
   `Dockerfile`, o `-Duser.timezone=…` en `JAVA_TOOL_OPTIONS`, y la variable en `.env.example` y en los compose). Es el
   cambio mínimo y conserva el contrato actual ("fechas en hora de Argentina, sin zona").
2. **Serializar con offset:** `OffsetDateTime` o `Instant` en la entidad y los DTOs (`"2026-12-01T00:00:00-03:00"`),
   como ya hace `SearchLog` (`entity/SearchLog.java:57`), y comparar instantes. Es lo correcto a largo plazo, pero cambia
   el contrato: hay que avisarlo para que el front y el portal migren a la vez.

A tener en cuenta en cualquiera de los dos casos: si hoy la JVM está en UTC, **las adopciones ya cargadas quedaron
guardadas 3 horas corridas** respecto de lo que quiso decir quien las cargó, y al cambiar la zona se van a leer con
otra hora de pared. Conviene revisar los datos existentes (hoy son pocos) en el mismo cambio. Lo mismo vale, con menos
consecuencias, para los `createdAt` / `updatedAt` que se llenan con `LocalDateTime.now()`
(`entity/OrganismProcedure.java:62-72`) y para la vigencia de las asignaciones de rol, que usa `LocalDate.now()`
(`security/service/UserService.java:785`): cerca de la medianoche, "hoy" es otro día según la zona.

**Criterio de aceptación**
- [ ] Está documentado (README, `.env.example` o la guía de integración) en qué zona interpreta el backend las fechas
  sin zona, y staging y producción corren con esa zona explícita.
- [ ] Confirmado en ejecución: una adopción con `effectiveFrom` = ahora + 1 hora (hora de Argentina) **no** está
  vigente para el backend (crear una ficha sobre ella responde el error de G-27) y no aparece en `/api/procedure/search`.
- [ ] Una adopción con `effectiveTo` = ahora + 1 hora (hora de Argentina) **sigue** vigente.
- [ ] Un `GET` devuelve la misma hora que se envió en el `POST`, con el backend en la zona definida.

---

## G-33 · Bloqueo de login por intentos fallidos: duración, tiempo restante y desbloqueo

**Prioridad:** 🟡 importante (a confirmar en ejecución) · **Tipo:** bug + contrato · Detectado el 2026-11-20 (`dev` @ `586b670`), leyendo el código; **no ejecutado**: el e2e dejó `GEN-LOGIN-BLOQ` sin cubrir porque bloquear una cuenta exige más intentos fallidos de los que la prueba se permite en un staging compartido.

**Cómo funciona según el código**
- Contraseña incorrecta sobre una cuenta activa y no bloqueada (`security/service/SecurityUserDetailsService.java:54-66`):
  mientras `failedAttempts < MAX_FAILED_ATTEMPTS` (`utils/AppConstants.java:15`, **5**) suma un intento y responde
  **401 `4016`**; con el contador ya en 5 bloquea la cuenta y responde **401 `4015`**. Es decir: cinco intentos
  fallidos dan `4016` y **el sexto bloquea**.
- Un login correcto con intentos acumulados los pone en cero (`security/service/AuthService.java:77-79`).
- Sobre una cuenta bloqueada, `verifyIsBlocked` (`SecurityUserDetailsService.java:73-89`) responde **401 `4014`**
  mientras dure el bloqueo y **401 `4013`** ("Su cuenta ha sido desbloqueada. Inicie sesión nuevamente",
  `messages/messages.properties:51`) en el primer intento posterior, que es el que la desbloquea (`unlockUser`,
  `:119-134`).

**Problemas**
1. **La duración no coincide con su comentario.** `AppConstants.java:16`:
   `public static final int BLOCK_DURATION = 60 * 1000; // 5 MIN` → es **un minuto**, no cinco. (`LOCK_TIME_DURATION`,
   `:17`, de 24 horas, no se usa en el login.) Falta saber cuál es la decisión de producto.
2. **El tiempo restante viaja solo dentro del `message`.** `SecurityUserDetailsService.java:84-86` arma
   `String.format("%s Tiempo restante: %d minutos.", …)` y lo manda como `message` del `4014`; no hay campo
   estructurado. Además se calcula en minutos enteros más uno (`:80-83`): con un bloqueo de un minuto dice siempre
   "1 minutos". El front no interpreta textos del backend, así que no puede decir cuánto falta.
3. **El `4013` no inicia sesión aunque la contraseña sea correcta.** `CustomAuthenticationProvider.java:38-42` llama a
   `verifyIsBlocked` también cuando la contraseña coincide, y este lanza `4013` al desbloquear: la persona que esperó y
   escribió bien su contraseña recibe un 401 y tiene que enviar el formulario otra vez.
4. **A confirmar — una cuenta bloqueada respondería 500 y no se desbloquearía nunca.** `CustomAuthenticationProvider`
   extiende `AbstractUserDetailsAuthenticationProvider` (`security/configuration/CustomAuthenticationProvider.java:20`)
   sin reemplazar sus chequeos previos, y en Spring Security 6.5.3 (Spring Boot 3.5.5, `pom.xml:8`) `authenticate`
   corre `preAuthenticationChecks` **antes** de `additionalAuthenticationChecks`. El chequeo por defecto lanza
   `LockedException` si `UserDetails.isAccountNonLocked()` es `false`, y `CustomeUserDetails.isAccountNonLocked()`
   devuelve el flag del usuario (`security/entity/CustomeUserDetails.java:95-97`). Consecuencias, si es así:
   - desde el intento siguiente al bloqueo, el login responde **500 `5000`** (`LockedException` no es
     `GlobalAppException` y cae en el handler genérico, `exception/GlobalExceptionHandler.java:100-110`), con cualquier
     contraseña;
   - `verifyIsBlocked` no se alcanza: el `4014` y el `4013` no se emiten nunca, y `unlockUser` —el único lugar que
     vuelve a poner `accountNonLocked` en `true`, además del alta (`security/service/UserService.java:171, 201`)— no
     se ejecuta. **La cuenta quedaría bloqueada hasta que alguien la corrija en la base**, y cualquiera que conozca un
     email puede bloquear esa cuenta con seis intentos.
   - El mismo mecanismo ya se vio en ejecución para las cuentas **inactivas** (`DisabledException` → 500 `5000`,
     e2e de la corrida `1113a`: `e2e/INFORME_E2E_ROLES.md`, "El login de una cuenta inactiva responde 500"; ver G-34).
     Para las bloqueadas es una lectura del código y del orden de Spring: **hay que confirmarlo levantando el backend**.

**Impacto en el front:** el login tiene textos propios para `4015`/`4014` ("Tu cuenta está bloqueada… esperá un
momento") y `4013` ("Tu cuenta se desbloqueó. Volvé a intentar"), sin tiempo de espera (`auth/login/login-error.ts`).
Si el punto 4 se confirma, la persona bloqueada vería "El servidor no está disponible en este momento" (el texto de
cualquier 5xx del login) y nunca los textos de bloqueo.

**Propuesta concreta**
- Definir la duración (producto) y que la constante y su comentario digan lo mismo; idealmente configurable por
  propiedad.
- Un campo estructurado en el `4014` y el `4015` con el tiempo restante, por ejemplo `details: { "retryAfterSeconds": 240 }`
  (o `lockedUntil` en ISO 8601 con zona), y el header `Retry-After`.
- Si el bloqueo ya venció y la contraseña es correcta: desbloquear e **iniciar sesión** en ese mismo pedido; dejar el
  `4013` solo para la contraseña incorrecta (o eliminarlo).
- Confirmar el punto 4 y, si se reproduce, manejar `LockedException` (o hacer el chequeo y el desbloqueo antes del
  chequeo previo de Spring) para que el bloqueo responda 401 `4014` y venza solo.
- Test de integración del ciclo completo (hoy no hay ninguno que pase por el `AuthenticationManager` real).

**Criterio de aceptación**
- [ ] Está definida y documentada la duración del bloqueo y la cantidad de intentos; `BLOCK_DURATION` y su comentario
  coinciden.
- [ ] Seis intentos fallidos seguidos → el sexto responde 401 `4015`; el siguiente, dentro del bloqueo, 401 `4014`
  (no 500), con el tiempo restante en un campo estructurado.
- [ ] Vencido el bloqueo, un login con la contraseña correcta → 200 con tokens, en un solo pedido.
- [ ] Vencido el bloqueo, la cuenta vuelve a aceptar intentos sin intervención en la base.
- [ ] Test de integración que cubra bloqueo, espera y desbloqueo.

---

## G-34 · El login permite enumerar cuentas y su estado

**Prioridad:** 🟡 importante · **Tipo:** bug (seguridad) · Detectado el 2026-11-20 (`dev` @ `586b670`), leyendo el código; **no ejecutado** en la corrida del 2026-11-20 (el 404 `4023` y el 500 de la cuenta inactiva sí se observaron en corridas anteriores contra staging: `e2e/INFORME_E2E_ROLES.md`).

**Problema** — `POST /api/auth/login` es público y responde distinto según exista o no la cuenta y según su estado, sin
que haga falta conocer la contraseña:

| Caso | Respuesta | Dónde |
|---|---|---|
| El email no tiene cuenta | **404 `4023`** "El usuario no se encuentra registrado." | `security/service/SecurityUserDetailsService.java:41-46`; `messages/messages.properties:64` |
| La cuenta existe y la contraseña es incorrecta | **401 `4016`** "La contraseña ingresada es incorrecta." | `SecurityUserDetailsService.java:56-58`; `messages.properties:54` |
| La cuenta existe y este intento la bloquea | **401 `4015`** | `SecurityUserDetailsService.java:60-61` |
| La cuenta existe y está **inactiva**, con cualquier contraseña | **500 `5000`** (ver abajo) | chequeo previo de Spring + `exception/GlobalExceptionHandler.java:100-110` |
| La cuenta existe y está bloqueada | 401 `4014`/`4013` según el código; 500 `5000` si se confirma G-33 §4 | `SecurityUserDetailsService.java:73-89` |

Con eso un tercero arma la lista de emails con cuenta (404 contra 401) y, de cada una, si está activa, inactiva o
bloqueada. `POST /api/auth/register`, también público, lo permite igual: **409 `4002`** si el email ya existe
(`security/service/AuthService.java:209-211`).

**Cuenta inactiva: el camino real no es el que parece en el servicio.** Leyendo solo `CustomAuthenticationProvider` y
`AuthService` se llega a esta conclusión: con contraseña incorrecta y cuenta inactiva,
`additionalAuthenticationChecks` (`security/configuration/CustomAuthenticationProvider.java:38-39`) llama a
`verifyFailedAttempts`; como la cuenta no está activa, este cae en la rama de `verifyIsBlocked`
(`SecurityUserDetailsService.java:55, 63-65`), que no lanza nada si la cuenta no está bloqueada (`:73-89`); la
autenticación sigue **con la contraseña incorrecta dada por buena**, y `AuthService.login` responde 401 `4001` (con
token de activación pendiente) o 401 `4030` (sin él) (`AuthService.java:81-85`), después de poner en cero los intentos
fallidos (`:77-79`). Ese camino está en el código, pero **no se alcanza**: `AbstractUserDetailsAuthenticationProvider`
corre antes sus chequeos previos, que lanzan `DisabledException` cuando `UserDetails.isEnabled()` es `false`, y
`CustomeUserDetails.isEnabled()` devuelve `accountActive` (`security/entity/CustomeUserDetails.java:105-107`).
`DisabledException` no tiene handler y termina en el genérico: **500 `5000`**. Coincide con lo que se observó contra
staging en la corrida `1113a` (`e2e/INFORME_E2E_ROLES.md`: el login de las cuentas recién creadas, todavía inactivas,
respondió 500 `5000`). Dos consecuencias:
- El `4001` y el `4030` del login son código muerto: el front los traduce (`auth/login/login-error.ts`) pero no llegan.
- **Cuidado al arreglar el 500:** si se desactiva o se reemplaza el chequeo previo para que respondan `4001`/`4030`,
  el camino de arriba pasa a ser real, y cualquiera sabría que una cuenta está inactiva sin conocer la contraseña
  (además de resetearle los intentos fallidos). La rama de `verifyFailedAttempts` para cuentas inactivas tiene que
  lanzar el mismo error que una contraseña incorrecta.

**Impacto en el front:** el login ya muestra el mismo texto para `4023` y `4016` ("El email o la contraseña no son
correctos"), justamente para no revelar qué emails tienen cuenta; pero el status y el `code` viajan igual en la
respuesta, así que la protección tiene que estar en la API. Una cuenta inactiva hoy ve "El servidor no está disponible
en este momento".

**Propuesta concreta**
- Email inexistente y contraseña incorrecta → la **misma** respuesta (401, un único código, un único mensaje), con un
  tiempo de respuesta parejo (comparar contra un hash aunque el usuario no exista).
- Cuenta inactiva, eliminada o bloqueada → responder su código específico **solo si la contraseña es correcta**; con
  contraseña incorrecta, la respuesta genérica. Nunca 500.
- `register` y `forgot-password`: revisar con el mismo criterio (hoy `register` responde 409 `4002`).
- Límite de intentos por IP además del bloqueo por cuenta (ver G-33: el bloqueo por cuenta también sirve para dejar
  afuera a un tercero).

**Criterio de aceptación**
- [ ] `POST /api/auth/login` con un email inexistente y con un email existente y contraseña incorrecta devuelve el
  mismo status, `code` y `message`.
- [ ] Con contraseña incorrecta, una cuenta inactiva responde igual que una activa.
- [ ] Con contraseña correcta, una cuenta inactiva responde 401 `4001` o `4030` (no 500 `5000`).
- [ ] Ningún estado de cuenta hace que el login responda 500.
- [ ] Tests de integración sobre el `AuthenticationManager` real para estos casos.

---

## G-35 · Guardado de organismo: códigos reusados sin decir a qué campo se refieren

**Prioridad:** 🔵 mejora · **Tipo:** contrato · Detectado el 2026-11-20 (`dev` @ `586b670`), leyendo el código; **no ejecutado**.

**Problema** — `POST` y `PUT /api/organism` (`service/OrganismService.java:49-50, 71-78`) usan el mismo código para dos
campos distintos, con un mensaje genérico y sin `details`:

| Código | Mensaje | Caso 1 | Caso 2 |
|---|---|---|---|
| 409 `4071` | "La entidad relacionada no se encuentra activa." (`messages/messages.properties:103`) | El **tipo** elegido está inactivo (`resolveActiveType`, `OrganismService.java:110-112`) | El **organismo superior** elegido está inactivo (`resolveParent`, `:122-124`) |
| 404 `4058` | "Organización no encontrada." (`messages.properties:90`) | El organismo que se **edita** no existe (`findByIdOrThrow`, `:102-105`) | El **organismo superior** elegido no existe (`resolveParent`, `:120-121`) |

(El tipo inexistente sí tiene código propio: 404 `4053`, `:108-109`.)

**Impacto en el front:** para marcar el campo correcto, el front lo deduce del contexto
(`pages/organismos/organismo-save-error.ts`): en un alta, el `4058` solo puede ser el superior; sin superior elegido, el
`4071` solo puede ser el tipo. Cuando se edita un organismo que tiene superior no hay forma de saberlo, y el mensaje va
a un banner que nombra las dos posibilidades.

**Propuesta concreta** (cualquiera de las dos):
- Códigos distintos por caso (tipo inactivo / superior inactivo / superior inexistente), o
- un campo estructurado que nombre el campo del request, en el formato que ya usa el 400 `4012`:
  `details: { "typeId": "…" }` o `details: { "parentId": "…" }`. Serviría también para el resto de los errores de
  referencia (`4073`).

**Criterio de aceptación**
- [ ] Un `PUT /api/organism/{id}` con tipo inactivo y otro con superior inactivo se distinguen por el `code` o por un
  campo estructurado, no por el texto.
- [ ] Lo mismo para "el organismo no existe" y "el superior no existe".
- [ ] Documentado en Swagger o en `docs/architecture/`.

---

## DOC-1 · Corregir `docs/frontend_integration_guide.md`

**Prioridad:** 🔵 · **Tipo:** doc

**Problema** — la guía (último cambio en `2e41090`) contradice el código actual:

| Línea | Dice | Código actual |
|---|---|---|
| 98 | "No existe endpoint `/me`." | `GET /api/auth/me` existe (`security/controller/AuthController.java:99-107`) |
| 323-324, 347-348 | `GET /api/role`, `GET /api/role/{id}`, `GET /api/permission` y `GET /api/permission/{id}` son "solo `SUPERADMIN`" | `hasAnyRole('SUPERADMIN', 'ADMIN_BACKOFFICE')` (`RoleController.java:41,58`; `PermissionController.java:32,43`). La escritura sí es solo SUPERADMIN |
| 439-440 | No existe `/api/user/me` ni listado de usuarios | Es correcto, pero conviene aclarar que el "me" es `/api/auth/me` y referenciar BO-17 |
| 441-443 | No hay endpoints de `Procedure`, `procedure_templates`, `organism_procedures`, `organism_procedure_locations` ni `attention_points` | Existen: los públicos `/api/procedure` desde `00142d2` (2026-09-24); los controllers de plantillas (`1e07d88`), adopciones (`7dd5ce8`), fichas (`cc9c684`), puntos de atención (`7b5afda`) y `/api/tag` (`84fde37`), todos del 2026-10-09; feedback desde `23fd8f9` |
| 470 | `/api/organism-type` "exige `SUPERADMIN`" | Usa `hasAuthority('READ_ORGANISM_TYPE')` y equivalentes (`OrganismTypeController.java:39-88`) |

**Propuesta concreta** — actualizar esas filas y agregar las secciones de `/api/tag`, `/api/procedure-template`, `/api/organism-procedure`, `/api/organism-procedure-location` (con el mapa de transiciones) y `/api/attention-point`, con permisos y códigos de error.

**Criterio de aceptación**
- [ ] La guía coincide con los `@PreAuthorize` y los DTOs de `dev`.
- [ ] Documenta todos los endpoints nuevos.

---

## Orden sugerido de atención

Actualizado el 2026-11-20 (`dev` @ `586b670`; e2e de los seis roles ejecutado contra staging ese día). Ya resueltos en `dev`: R-3, R-1, G-14, G-15, BO-17 (en staging) y
G-1, G-2 / BO-20, G-6, G-10 y G-22 (en staging desde el 2026-11-19).

1. ~~**OPS-1:** desplegar `dev` @ `586b670` (13 commits y `V2.31`) en staging.~~ ✅ **Cumplido el 2026-11-19** (`origin/staging` @ `0a555df`). Era lo único que separaba a fichas y puntos de atención de funcionar en real online; con el deploy llegan también `/me` con organismo, `READ_PROCEDURE` para AO y el `4072` como 409. El 2026-11-19 se verificó solo el esquema de `/api-docs`; **los flujos se ejecutaron el 2026-11-20** (e2e de los seis roles contra staging: 114 OK, 3 FALLA, 4 sin cubrir). Sigue en pie acordar la cadencia (propuesta 3 de OPS-1): fue la segunda vez que staging quedó atrás.
2. **G-13 + G-20:** que `UserResponseDTO` traiga rol, organismo, vigencia y `activeAssignments`, y que se pueda cambiar el rol de un usuario (hoy `role-assignments` da siempre 409 `4081`, también para AB después de G-22). G-13 destraba además **G-26** (cuentas privilegiadas). De paso, confirmar **G-21** (`LocalDate.MAX`).
3. **G-27 + G-9 + G-12 §2:** una sola definición sobre fichas y vigencia de la adopción: código propio para "adopción no vigente", si se editan o preparan fichas fuera de vigencia, cascada al deshabilitar o vencer, y que `publish` respete la misma regla. De G-9 quedan además la validación previa de duplicados (hoy 500 `5000`, sin decir cuál de las dos restricciones falló; ampliado el 2026-11-19) y el slug único global. Va junto **G-32** (zona horaria): mientras no esté fijada, "vigente" puede diferir 3 horas entre el backend y lo que ve quien carga la adopción; fijar `TZ` es un cambio de una línea.
4. **G-29:** que el filtro de puntos de atención por ficha no esconda los inactivos (o exponer `active`). Es chico y condiciona el panel de la ficha.
5. **G-31:** que `change-password` valide el alcance del actor como el resto de las mutaciones de usuario. Es chico y hoy no es explotable con los permisos del seed, pero **tiene que entrar antes de darle `UPDATE_USER` a un rol de organismo** (lo que pide la documentación del backend para AO). De paso, confirmar la regla para roles que no son SA/AB/AO.
6. **G-34 + G-33:** login. Que no se puedan enumerar cuentas (misma respuesta para email inexistente y contraseña incorrecta; hoy 404 `4023` contra 401 `4016`) y que ningún estado de cuenta responda 500. De G-33, **confirmar primero en ejecución** si una cuenta bloqueada queda respondiendo 500 sin desbloquearse: si se reproduce, sube a bloqueante. Después, la duración del bloqueo y el tiempo restante en un campo estructurado. Conviene un solo cambio, con tests sobre el `AuthenticationManager` real.
7. **G-23:** `assignable_by_org_admin` (AO no puede crear usuarios ni asignar roles). Es seed. **Confirmado en ejecución el 2026-11-20**: con el front ya desplegable, AO ve "Nuevo usuario" y el alta no le ofrece ningún rol.
8. **G-3 / G-5:** `READ_PROCEDURE` para AGENT, `READ_ORGANISM` y `READ_VARIANT` para AB, y la definición de quién publica (decisiones de producto; conviene una sola migración).
9. **G-24:** que AGENT no pueda deshabilitar adopciones ni despublicar fichas por la vía del `PUT`/`DELETE`.
10. **G-4:** endpoints `reject` y `return-to-draft` (los 4xx ya están).
11. **G-11:** editar adopciones de plantillas desactivadas y cascada al desactivar una plantilla (backend lo anunció como próximo: `odd/tasks/claudinio-slugbase-catalog-errors.md`, "E2E11").
12. **G-12:** resto de las validaciones (§4 `DELETE` sin versión, §5 inactivas en el listado, §6 puntos sobre fichas inactivas y escala de coordenadas).
13. **G-7:** paginación y los filtros que faltan (incluye G-11 §3).
14. Mejoras y resto: **G-8** (aceptar la versión en el `PUT` → 409 `4091`; hoy el front paga un `GET` extra por guardado y un formulario viejo igual puede pisar cambios; además la excepción de Spring y el endpoint de versiones), **G-16**, **G-25** + **G-30** (textos de error y un código por motivo del `4029` de usuarios; suma el detalle de G-26), **G-2** (confirmar el contrato de `/me`: organismo desactivado y código para "sin rol vigente"), **G-28** (a confirmar), **G-17** (decisión), **G-18**, **G-19**, **DOC-1** y **OPS-2**. Sumados el 2026-11-20: **G-35** (códigos reusados en el guardado de organismo) y la ampliación de **G-16** (borrar un permiso asignado a un rol).

## Qué hace el front mientras tanto

- **R-3:** resuelto (`V2.28` + `V2.30`; en staging desde el 2026-11-16). Ya no hace falta que SUPERADMIN asigne los permisos a mano desde la pantalla de Roles.
- **R-1:** resuelto (en staging desde el 2026-11-16). El front igual reenvía el estado actual y nunca ofrece cambiarlo desde el formulario, y manda siempre `active`: contra un backend anterior a `3797fe7`, sin él el `PUT` da 500; desde `3797fe7` (en staging desde el 2026-11-19), 400 `4012`.
- **Cadena de trámites (plantillas → adopciones → fichas → puntos):** va toda con la misma fuente, porque se referencia por ids. En `ng serve` (`environment.ts`) va en **mock con la forma real del contrato**; en `npm run start:local`, staging y prod va toda en **real** (en esta rama, `feat/alinear-backend-586b670`, fichas y puntos de atención dejaron de tener override a mock). Siguen en mock en todos los entornos `dashboard`, `auditoria` y `feedback` (sin endpoint).
- **G-1:** el front consume el response completo y el filtro `?organismProcedureId=`. **Requiere backend >= `586b670`** (en staging desde el 2026-11-19, OPS-1 cumplido): contra uno anterior las fichas llegan sin `url`, `requirements`, `costs`, adopción ni localidad; el front lo detecta (`sinContenido`, compatibilidad temporal), avisa y no deja editar, para no borrar ese contenido al guardar. Los nombres (trámite, organismo, localidad) se resuelven en el cliente por id.
- **G-2 / G-3:** el front lee `scope` y el organismo de `/api/auth/me` (`auth.service.ts`). "Adoptar" y "Nueva etiqueta" se ofrecen a quien puede elegir organismo (`READ_ORGANISM`) **o** trae uno en la sesión (`ORGANISMO_ELEGIBLE` en `policy-overrides.constants.ts`); "Adoptar" exige además `READ_PROCEDURE`, que AO recibe con `V2.31`. Contra un backend anterior a `d7aca1c` (staging lo tiene desde el 2026-11-19) la sesión no trae organismo y AO sigue sin ver esas acciones. AB sigue sin `READ_ORGANISM` y AGENT sin `READ_PROCEDURE`: sin cambios de código, se gatea por permiso.
- **BO-17:** el listado de usuarios ya es real (BO-22, 2026-11-10). Mientras el rol llegue en `null` se muestra "Sin dato"; "Editar" queda no disponible (no hay endpoint de edición).
- **G-4 / G-12:** con el backend de `dev`, transición inválida → 409 `4077` y "no existe" → 404 `4073`; el front ya traduce los dos. "Rechazar" no se ofrece.
- **G-8:** el front traduce el `4091`. Como el `PUT` no lleva versión, antes de guardar relee la ficha (`GET /{id}`) y, si cambió de versión o de estado desde que se abrió el form, no guarda y avisa (`fichas-locales.facade.ts`, `verificarBase`). Es un `GET` extra por guardado y deja una ventana de milisegundos; se saca cuando el `PUT` acepte la versión.
- **G-5:** el front decide todo por permiso (`PUBLISH_VARIANT`) y nunca por rol, así que se adapta al seed sin cambios de código. Solo los textos dependen de D-3.
- **G-6:** resuelto (en staging desde el 2026-11-19). El front traduce el `4080` y trata el `4072` como conflicto por `code`, sin mirar el status: funciona igual con el 400 de un backend anterior y con el 409 de `586b670`.
- **G-7 / G-29:** paginación, orden y el resto de los filtros, en el cliente. El `HttpDataSource` de puntos de atención ya manda `?organismProcedureLocationId=`: con ese filtro el backend devuelve solo los activos, así que "Mostrar inactivos" del panel no tiene qué mostrar contra el backend real hasta que se resuelva G-29.
- **G-8:** el historial de versiones no se muestra.
- **G-9:** el front sugiere slugs a partir de la plantilla y la localidad para bajar la chance de duplicados, pero no los puede garantizar. Un 500 `5000` al guardar una ficha se muestra como "puede que esa localidad ya tenga una ficha de este trámite o que el slug ya esté en uso" (`pages/tramites/fichas/ficha-save-error.ts`), sin marcar ningún campo, porque no se sabe cuál de las dos restricciones falló. Sin cascada, una ficha de una adopción vencida sigue figurando `PUBLICADO` en el backoffice aunque el portal ya no la muestre (desde `1888e1a`).
- **G-10 / G-28:** resuelto (en staging desde el 2026-11-19). El front sigue canonicalizando `slugBase` antes de enviar (mismo criterio; inofensivo, y necesario contra un backend anterior a `130c180`) y no manda slugs que queden vacíos.
- **G-12 / G-27:** adopción no vigente → 404 `4073` al crear o editar una ficha. El front no lo distingue de "no existe" por el código: busca la etiqueta `OrganismProcedure` dentro del `message` para saber que el 404 habla de la adopción (y no de la ficha o la localidad) y muestra un texto que enumera las causas posibles; para ofrecer o no las acciones depende de la vigencia que calcula en el cliente (`AdopcionVM.vigente`).
- **G-32:** el front envía y lee las fechas de vigencia en hora local del navegador, sin zona, y calcula `vigente` con ese reloj. No compensa la zona del backend: si la JVM corre en UTC, durante 3 horas alrededor del inicio y del fin de la vigencia la pantalla y la API no coinciden.
- **G-11:** la vista "Organismos que la adoptaron" filtra en el cliente; con la fuente real, una adopción de plantilla desactivada no se puede editar.
- **G-13:** con la fuente real, "Eliminar definitivamente" no se ofrece; queda la baja lógica (desactivar). La columna Rol muestra "Sin dato".
- **G-14:** resuelto; el paso de crear el tipo `publication_status` antes de arrancar el backend local ya no hace falta.
- **G-15:** resuelto (en staging desde el 2026-11-16); falta verificarlo con el e2e local (CP16) y sacar el seed SQL (`E2E_SEED_SQL`).
- **G-16:** el error de borrado en uso se muestra con el mensaje genérico de 500 (también el de un permiso asignado a un rol).
- **G-17:** el front muestra lo que devuelve `GET /api/tag`, sin cambios de código: si se amplía el alcance, AO/AGENT las ven solas.
- **G-18:** los 500 se muestran con el mensaje genérico prudente; el front envía fechas completas (`yyyy-MM-ddTHH:mm:ss`) y nunca ids de mock contra el backend (por eso la cadena de trámites va con una sola fuente).
- **G-19:** el e2e local siembra por SQL lo que no se puede crear por API; QA y demos usan el mock.
- **G-22:** resuelto (en staging desde el 2026-11-19): AB ya puede asignar roles `assignableByBackoffice`. No cambia lo de abajo.
- **G-26 (PPDT-5.1):** el listado no trae el rol (G-13), así que el front no puede ocultarle a AB las acciones sobre cuentas SA/AB; el 403 `4029` se muestra con texto propio (`pages/usuarios/usuario-accion-error.ts`), no con el `message` del backend.
- **G-20 / G-21:** "Asignar rol" (BO-24) queda limitada: contra el backend real, cualquier usuario con rol vigente responde 409 `4081`. El front traduce ese código con texto propio (`pages/usuarios/usuario-rol-save-error.ts`) y no puede ofrecer "cambiar rol" hasta que exista el cierre de la asignación.
- **G-23:** el form de usuario consume `GET /api/role/allowed`, así que AO verá los roles en cuanto el flag esté en `TRUE`, sin cambios de código. Mientras tanto (confirmado en ejecución el 2026-11-20) el alta se abre y muestra "No hay roles que puedas asignar".
- **G-24:** el front gatea por permiso, tal como hoy autoriza el backend; no agrega reglas por rol para AGENT.
- **G-30:** el alta de usuarios distingue los motivos del 403 `4029` comparando `details` con los textos de `messages.properties` y con sus claves (`pages/usuarios/usuario-save-error.ts`); solo "rol no asignable" se marca en el campo Rol, y lo que no reconoce cae en un texto neutro.
- **G-31:** "Cambiar contraseña" se ofrece por permiso (`UPDATE_USER`), que en el seed solo tienen SA y AB. El front no agrega una regla por rol ni por organismo: si un rol de organismo recibe `UPDATE_USER` antes del fix, la UI no ofrecería la acción sobre usuarios ajenos (el listado viene filtrado), pero la API la aceptaría.
- **G-2 (contrato de `/me`):** un 403 `4029` o un 404 `4073` de `/me` deja la sesión abierta y sin organismo (`auth.service.ts`); `organismAcronym` nulo se tolera. No hay tratamiento para un organismo desactivado: el response no lo informa.
- **G-25:** el front no muestra el `message` del backend para `4018` ni `4002` en usuarios (usa texto propio por contexto) y valida la contraseña con el límite real (8 a 20).
- **OPS-1:** cumplido el 2026-11-16 para `58d383a` (Etiquetas, Plantillas y Adopciones en real en staging y prod), reabierto el 2026-11-19 para `586b670` y **cumplido de nuevo ese mismo día** (`origin/staging` @ `0a555df`). En esta rama `environment.staging.ts` y `environment.prod.ts` ya apuntan fichas y puntos de atención a la API real: el front requiere backend >= `586b670`, que staging ya tiene, así que se puede desplegar. Falta ejecutar los flujos contra staging (solo se verificó el esquema de `/api-docs`); mientras tanto lo nuevo está probado con el backend local en Docker (`npm run start:local`).
- **G-33:** el login muestra un texto propio para el bloqueo (`4015`/`4014`) y otro para el desbloqueo (`4013`), sin tiempo de espera, porque no interpreta el `message` del backend (`auth/login/login-error.ts`). Si la cuenta bloqueada responde 500 (G-33 §4, a confirmar), se ve el texto de servidor no disponible.
- **G-34:** el login muestra el mismo texto para `4023` y `4016` ("El email o la contraseña no son correctos"); el status y el `code` de la respuesta siguen siendo distintos. Una cuenta inactiva recibe 500 y ve el texto de servidor no disponible; los textos de `4001` y `4030` están listos para cuando lleguen.
- **G-35:** el front deduce del contexto a qué campo se refiere un `4071` o un `4058` del guardado de organismo (`pages/organismos/organismo-save-error.ts`); cuando no se puede saber (edición con superior elegido) muestra un banner que nombra las dos posibilidades.
- **OPS-2:** el e2e ya no deja registros nuevos en staging; los existentes quedan inactivos.
- **DOC-1:** el front se integra contra el código de `dev` y este documento, no contra la guía.
