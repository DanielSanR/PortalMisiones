# Pedidos del backoffice al backend — Portal Provincial de Trámites (Misiones)

**Fecha:** 2026-11-16 · **Backend relevado:** `origin/dev` @ `58d383a` (código; migraciones hasta `V2.30`) y API de staging (sondeo del 2026-11-03 con el usuario SA de e2e) · **Contacto:** Daniel Romero (frontend backoffice)

> **Auditoría 2026-11-16:** se revisó cada pedido contra el código de `dev` @ `58d383a` (lectura de código y
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
> "Estado 2026-11-03" de cada pedido se conservan; donde algo cambió hay un bloque "Estado 2026-11-16" arriba.

El backoffice (Angular) ya consume la API real de organismos, taxonomía, roles, permisos y etiquetas, y está por integrar el núcleo de trámites: plantillas (`/api/procedure-template`), adopciones (`/api/organism-procedure`), fichas por localidad (`/api/organism-procedure-location`, "OTL") y puntos de atención (`/api/attention-point`). En este documento juntamos lo que hace falta corregir o exponer del lado del backend para cerrar esa integración. Cada pedido se verificó contra el código de `origin/dev` @ `23fd8f9` y se volvió a auditar contra `58d383a` (las líneas citadas en los bloques "Estado 2026-11-16" y en G-20 a G-25 son de `58d383a`; las del cuerpo de los pedidos anteriores, de `23fd8f9`). Las rutas son relativas a `src/main/java/org/silicon/misiones/portal_misiones/` (código) y a `src/main/resources/db/` (migraciones), salvo que se indique otra cosa. Cada ítem está pensado para copiarse tal cual como tarjeta de Taiga.

---

## Resumen

Estado: ✅ resuelto en `dev` · 🟠 parcial · ⬜ pendiente. "En staging" indica si ya se puede probar online.

| ID | Título | Prioridad | Tipo | Estado (2026-11-16, `dev` @ `58d383a`) | Qué desbloquea en el front |
|---|---|---|---|---|---|
| **OPS-1** | Desplegar `dev` en staging (merge `dev` → `staging`) | 🔴 bloquea | ops | ✅ cumplido el 2026-11-16 (`staging` = `dev` @ `58d383a`, verificado online) | Probar online etiquetas, plantillas, adopciones y el workflow de fichas |
| **G-1** | Response de la ficha (OTL) incompleto y sin filtro por adopción | 🔴 bloquea | contrato | ⬜ | Pantallas de fichas por localidad con datos reales (hoy editar borraría requisitos, costos y URL) |
| **G-2 / BO-20** | Organismo del usuario en `/api/auth/me` | 🔴 bloquea | contrato | ⬜ (`/me` sigue con `userId, email, roles, permissions`) | AO adopta trámites; AO/AGENT crean etiquetas locales; preselección de organismo |
| **G-13** | Borrado definitivo de usuario siempre falla (500): FK `RESTRICT` de `user_role_assignments`; además el `UserResponseDTO` llega con `role` y `activeAssignments` en `null` | 🔴 bloquea | bug | ⬜ — `GET /api/user` y `GET /api/user/{id}` siguen mapeando con ModelMapper | "Eliminar definitivamente" de usuarios (BO-3) y rol/organismo en el listado y el detalle |
| **G-20** 🆕 | No se puede cambiar el rol de un usuario existente: `role-assignments` siempre da 409 `4081` y no hay cómo cerrar una asignación | 🔴 bloquea | bug + feature | ⬜ (backend lo tiene en Taiga, refs 42 y 43) | Asignar o cambiar rol desde el detalle del usuario (BO-24) |
| **G-23** 🆕 | `assignable_by_org_admin` es `FALSE` para todos los roles: ADMIN_ORGANIZATION no puede crear usuarios ni asignar roles | 🟡 importante | bug (seed) | ⬜ | Alta de usuarios por el administrador del organismo |
| **G-22** 🆕 | ADMIN_BACKOFFICE tiene `CREATE_USER` pero `role-assignments` le responde siempre 403 `4029` | 🟡 importante | contrato | ⬜ | Saber a quién ofrecerle "Asignar rol" (BO-24) |
| **G-3** | Permisos de lectura para AO y AGENT (`READ_PROCEDURE`, `READ_ADOPTION`) y `READ_ORGANISM` para quien adopta | 🟡 importante | contrato (seed) | 🟠 AO y AGENT tienen `READ_ADOPTION` (`V2.28`); falta `READ_PROCEDURE` para AO/AGENT y `READ_ORGANISM` para AB | AO elige plantilla para adoptar; AB elige organismo; AGENT ve de qué trámite es cada ficha |
| **G-4** | Transiciones inválidas como 4xx + endpoints "rechazar" y "volver a borrador" | 🟡 importante | bug + feature | 🟠 transición inválida → 409 `4077` y "no existe" → 404 `4073`; faltan `reject` y `return-to-draft`; `BORRADOR → DESPUBLICADO` sigue permitido | Bandeja de revisión completa |
| **G-5 / D-3** | Definir quién publica; AB sin `READ_VARIANT`/`PUBLISH_VARIANT` | 🟡 importante | contrato (seed + doc) | ⬜ — agravado por `V2.28`: AB gestiona puntos de atención pero no llega a la ficha de la que cuelgan | Bandeja de publicación para AB, puntos de atención para AB y textos de la UI |
| **G-9** | Unicidad de ficha (adopción + localidad) y de slug; cascada de vigencia | 🟡 importante | bug | 🟠 constraints únicas en `V2.27`; sin validación previa (una violación sale como 500), slug no único global y sin cascada de vigencia | Evitar fichas duplicadas y trámites vencidos visibles |
| **G-24** 🆕 | AGENT conserva `UPDATE_ADOPTION` (un `PUT` con `enabled: false` equivale al `DELETE` que `V2.30` le quitó) y el `DELETE` de la ficha exige `UPDATE_VARIANT` | 🟡 importante | bug (autorización) | ⬜ | Que la UI y la API coincidan en qué puede hacer un AGENT |
| **G-7** | Paginación y filtros en los listados | 🟡 importante | feature | ⬜ | Panel de puntos de atención por ficha; listados con volumen real |
| **G-11** | Adopciones: editar con plantilla desactivada, cascada al desactivar plantilla, filtro por plantilla, `ownerOrganismId` | 🟡 importante | bug + contrato | ⬜ | Editar/deshabilitar adopciones de plantillas inactivas; vista "Organismos que la adoptaron" sin bajar todo |
| **G-12** | Fichas y puntos de atención: "no existe" como 500 (ver G-4), workflow sobre inactivas, fichas sobre adopciones deshabilitadas, `DELETE` sin versión | 🟡 importante | bug | 🟠 "no existe" de fichas → 404 `4073`; el resto sin cambios | Mensajes de error precisos y datos consistentes en fichas y puntos |
| **G-16** | Borrar una categoría, etiqueta o destinatario en uso responde 500 (FK) en vez de 409 | 🟡 importante | bug | ⬜ | Mensaje claro al borrar datos de catálogo en uso |
| **G-21** 🆕 | `LocalDate.MAX` como parámetro de la consulta de solapamiento de asignaciones (posible 500 o solapamiento no detectado) | 🔵 a confirmar | bug | ⬜ — **no confirmado en ejecución** | Asignar un rol sin fecha de fin |
| **G-25** 🆕 | Textos de error engañosos: `4018` para rol inexistente, `4002` para usuario inactivo, contraseña "8 a 30" con máximo real 20 | 🔵 mejora | bug | ⬜ | Mostrar el mensaje del backend sin traducciones locales |
| **G-6** | Código `4080` sin mensaje; `4072` responde 400 y no 409 | 🔵 mejora | bug | 🟠 `4080` con mensaje; `4072` sigue en 400 | Mensajes de error consistentes sin traducciones locales |
| **G-8** | Endpoint de versiones de la ficha (`otl_versions`) y control de concurrencia | 🔵 mejora | feature | 🟠 `@Version` en la ficha y handler → 409 `4091`; `lockVersion` no viaja en el contrato, el handler no cubre la excepción de Spring y falta el endpoint de versiones | Historial de versiones (FR-BACKOFFICE-07) y aviso de edición concurrente |
| **G-10** | Plantillas: canonicalizar `slugBase` y precisar el `4073` de catálogos | 🔵 mejora | bug | ⬜ | Slugs consistentes entre clientes y errores de catálogo que nombran el id faltante |
| **G-17** | ¿AO/AGENT deben ver las etiquetas globales? Hoy `GET /api/tag` les devuelve solo las locales de su organismo | 🔵 decisión | contrato | ⬜ (existe `GET /api/tag/public`, pero no resuelve la decisión) | Etiquetar plantillas/fichas desde un organismo con etiquetas provinciales |
| **G-18** | Excepciones de Spring sin manejar responden 500: id no UUID (→ 400), método no soportado (→ 405), body ilegible (→ 400) | 🔵 mejora | bug | ⬜ (el handler solo sumó `OptimisticLockException`) | Errores precisos; no confundir un request inválido con una caída |
| **G-19** | Seed de ejemplo para el núcleo de trámites en `dev` (plantillas, adopción, fichas) | 🔵 mejora | ops | ⬜ | QA y demos sobre una base nueva sin cargar todo a mano |
| **OPS-2** | Purgar en staging los registros de prueba `E2E-*` que la API no permite borrar | 🔵 mejora | ops | ⬜ (no verificable desde el código) | Staging limpio (entorno compartido) |
| **DOC-1** | Corregir `docs/frontend_integration_guide.md` | 🔵 mejora | doc | ⬜ | Evitar que otros equipos (portal) integren contra información vieja |
| **R-3** | Grants de `V2.20`/`V2.23`/`V2.24` filtran por `ROLE_*` y no matchean ningún rol | 🔴 bloquea | bug | ✅ `V2.28` (`bab0993`) + `V2.30` · no en staging | Etiquetas, Adopciones y Puntos de atención reales |
| **R-1** | `PUT` de la ficha acepta `publicationStatus` y saltea el workflow | 🔴 bloquea | bug | ✅ `5186ab1` · no en staging · cabo suelto: `PUT` sin `active` → 500 | Edición segura de fichas |
| **G-15** | Adopciones: `POST`/`PUT /api/organism-procedure` habilitadas responden 500 (consulta de solapamiento con parámetros sin tipo) | 🔴 bloquea | bug | ✅ casts en `findOverlappingEnabled` · no en staging · no ejecutado por el front | Adoptar trámites y editar vigencias (toda la sección "Trámites del organismo") |
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

**Criterio de aceptación**
- [ ] `GET /` y `GET /{id}` devuelven al menos los campos obligatorios.
- [ ] Un `GET /{id}` seguido de un `PUT` con ese mismo body no pierde contenido.
- [ ] `?organismProcedureId=` filtra, respetando el alcance del usuario.
- [ ] Un request sin campos obligatorios → 400 `4012` con `details` por campo.

---

## G-2 / BO-20 · Organismo del usuario en `/api/auth/me`

> **Estado 2026-11-03:** ⬜ **Pendiente.** `/api/auth/me` sigue devolviendo solo `userId, email, roles, permissions` (verificado en staging). Backend lo tiene en su lista.

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

**Criterio de aceptación**
- [ ] Con AO y AGENT, `/api/auth/me` devuelve `scope: "organismo"` y su `organismId`.
- [ ] Con SA, AB y MANAGER devuelve `scope: "global"` y `organismId: null`.
- [ ] Un usuario sin asignación vigente sigue respondiendo 403 `4029`, como hoy.

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

> **Estado 2026-11-16 (`dev` @ `58d383a`):** 🟠 **Parcial.** AO tiene los cuatro `*_ADOPTION`; AGENT, `READ_ADOPTION` y
> `UPDATE_ADOPTION` (`V2.28` + `V2.30`). **Sigue faltando `READ_PROCEDURE` para AO y AGENT:** ninguna migración
> posterior a `V2.9` lo otorga. Se suma un hueco del mismo tipo, **`READ_ORGANISM`** (ver "Ampliación 2026-11-16").
>
> **Estado 2026-11-03:** 🟠 **Parcial.** `V2.28` asigna `READ_ADOPTION` también a AO y AGENT. Falta `READ_PROCEDURE` para AO y AGENT (no aparece en ninguna migración nueva). Backend: "verificar permisos de lectura para AO y AGENT".

**Prioridad:** 🟡 · **Tipo:** contrato (seed) — requiere confirmación de producto

**Problema** — seed vigente (`V0.1:53-92`, `V2.9:54-70`, `V2.20`):

| Permiso | SA | AB | AO | AGENT | MANAGER |
|---|---|---|---|---|---|
| `READ_PROCEDURE` | ✓ | ✓ | **✗** | **✗** | ✓ |
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
- [ ] Con AO, `GET /api/procedure-template` → 200.
- [x] Con AGENT, `GET /api/organism-procedure` → 200, solo las de su organismo (`V2.28`; verificar en ejecución).
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
- [x] `GET /{id}` de una ficha de otro organismo (con AO) → 404 `4073`, no 500.
- [x] `GET`/`PUT /api/organism-procedure-location/<uuid-inexistente>`, y un `POST`/`PUT` con adopción o localidad inexistente → 404 `4073`.
- [ ] `reject` y `return-to-draft` funcionan, generan versión y respetan el alcance.
- [ ] Tests de workflow para cada transición inválida.

---

## G-5 / D-3 · Quién publica: definición y seed de AB

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
- [ ] Crear una segunda ficha activa para la misma adopción y localidad → 409.
- [ ] Crear una ficha con un slug activo ya usado → 409.
- [ ] Deshabilitar una adopción → sus fichas publicadas quedan `DESPUBLICADO`, con versión nueva.
- [ ] Una adopción con `effectiveTo` en el pasado no aparece en `/api/procedure/search` ni en `/api/procedure/{slug}`.

---

## G-7 · Paginación y filtros en los listados

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
- [ ] `GET /api/attention-point?organismProcedureLocationId=…` devuelve solo los puntos de esa ficha, respetando el alcance.
- [ ] Sin parámetros, los endpoints mantienen el comportamiento actual (compatibilidad), o el cambio de contrato se avisa con anticipación.

---

## G-6 · Mensaje del `4080` y status del `4072`

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
- [ ] El `4080` llega con un mensaje en español.
- [ ] El `4072` llega con 409 en todos los endpoints.

---

## G-8 · Historial de versiones y control de concurrencia

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

---

## G-10 · Plantillas: canonicalizar `slugBase` y precisar el `4073` de catálogos

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
- [ ] `POST`/`PUT` con `slugBase: "Obtener DNI"` persiste `obtener-dni`; un segundo `obtener-DNI` devuelve `4072`.
- [ ] Un `tagIds` con un UUID inexistente devuelve `4073` con ese UUID y la entidad en `details`.

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
- [ ] `POST /api/organism-procedure-location` con una adopción deshabilitada o vencida → 4xx.
- [ ] `DELETE` de una ficha incrementa `currentVersionNumber`.
- [ ] `POST /api/attention-point` con latitud de 7 decimales → 400 `4012`.

---

## OPS-1 · Desplegar `dev` en staging

> **Estado 2026-11-16 (tarde):** ✅ **Cumplido.** `origin/staging` del backend = `7f2a78f` (merge de `dev` @ `58d383a`).
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
- [ ] La regla de quién asigna roles está documentada y coincide entre `POST /api/user` y `role-assignments`.
- [ ] Con AB: 201 para los roles que le correspondan, o el endpoint deja de estar habilitado por un permiso que AB tiene.
- [ ] Rol global con `organismId`, o rol de organismo sin `organismId` → 4xx con código propio, distinto de `4029`.

---

## G-23 · Ningún rol es asignable por ADMIN_ORGANIZATION

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

**Propuesta:** una migración como `V2.16` que marque `assignable_by_org_admin = TRUE` para los roles que el
administrador del organismo debe poder otorgar (como mínimo `AGENT`; definir si también `ADMIN_ORGANIZATION`), filtrando
por el código sin prefijo.

**Criterio de aceptación**
- [ ] En una base nueva, con AO, `GET /api/role/allowed` devuelve al menos `AGENT`.
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

Actualizado el 2026-11-16 (`dev` @ `58d383a`). Ya resueltos en `dev`: R-3, R-1, G-14, G-15 y BO-17.

1. **OPS-1:** desplegar `dev` (hasta `V2.30`) en staging. Con R-3 y G-15 resueltos, es lo único que falta para pasar Etiquetas, Plantillas y Adopciones a real online. Sin esto, `/api/tag`, `/api/organism-procedure` y `/api/attention-point` dan 403 incluso para SA.
2. **G-1:** mapear campos que ya están en la entidad y sumar los `@NotNull` (cierra también el cabo de R-1: `PUT` sin `active` → 500). Desbloquea toda la sección de fichas y, con ella, puntos de atención.
3. **G-13 + G-20:** que `UserResponseDTO` traiga rol, organismo, vigencia y `activeAssignments`, y que se pueda cambiar el rol de un usuario (hoy `role-assignments` da siempre 409 `4081`). De paso, confirmar **G-21** (`LocalDate.MAX`).
4. **G-2 / BO-20:** extender `/api/auth/me`. Desbloquea "Adoptar" y etiquetas locales para AO/AGENT.
5. **G-23 / G-22:** quién puede crear usuarios y asignar roles (AO no puede hacer ninguna de las dos cosas; AB no puede asignar). Es seed + una definición.
6. **G-3 / G-5:** `READ_PROCEDURE` para AO/AGENT, `READ_ORGANISM` y `READ_VARIANT` para AB, y la definición de quién publica (decisiones de producto; conviene una sola migración).
7. **G-24:** que AGENT no pueda deshabilitar adopciones ni despublicar fichas por la vía del `PUT`/`DELETE`.
8. **G-4:** endpoints `reject` y `return-to-draft` (los 4xx ya están).
9. **G-9:** validación previa de duplicados (hoy una violación de `uk_otl_*` sería 500), slug único global y cascada de vigencia.
10. **G-11:** editar adopciones de plantillas desactivadas y cascada al desactivar una plantilla.
11. **G-12:** resto de las validaciones de fichas y puntos de atención (resolver §3 junto con G-9 §3).
12. **G-7:** primero el filtro de puntos de atención por ficha; después la paginación (incluye los filtros de G-1 y G-11 §3).
13. Mejoras y resto: **G-16**, **G-25** (textos de error), **G-6** (`4072`), **G-8** (`lockVersion` en el contrato, excepción de Spring y versiones), **G-10**, **G-17** (decisión), **G-18**, **G-19**, **DOC-1** y **OPS-2**.

## Qué hace el front mientras tanto

- **R-3:** resuelto en `dev` (`V2.28` + `V2.30`). Mientras no llegue a staging (OPS-1), SUPERADMIN puede asignar los permisos a mano desde la pantalla de Roles; si no, Etiquetas queda oculta.
- **R-1:** resuelto en `dev` (el backend ignora el estado en el `PUT`). El front igual reenvía el estado actual y nunca ofrece cambiarlo desde el formulario, y manda siempre `active` (sin él, el `PUT` da 500).
- **Cadena de trámites (plantillas → adopciones → fichas → puntos):** va toda con la misma fuente, porque se referencia por ids. En `ng serve`, staging y prod va en **mock con la forma real del contrato**; solo `npm run start:local` (`environment.local.ts`, contra `dev` local) la usa en real, fichas y puntos de atención incluidos.
- **G-1:** el `HttpDataSource` de fichas está escrito y se ejercita con `start:local`, pero con el response mínimo la edición de fichas perdería contenido; por eso fuera de local sigue en mock.
- **G-2 / G-3:** "Adoptar" se oculta para AO, y el select de organismo de etiquetas solo ofrece lo que el backend acepta.
- **BO-17:** el listado de usuarios ya es real (BO-22, 2026-11-10). Mientras el rol llegue en `null` se muestra "Sin dato"; "Editar" queda no disponible (no hay endpoint de edición).
- **G-4 / G-12:** con el backend de `dev`, transición inválida → 409 `4077` y "no existe" → 404 `4073`; el front ya traduce los dos. "Rechazar" no se ofrece.
- **G-8:** el front traduce el `4091` ("Otro usuario modificó la ficha mientras la editabas. Recargá para ver los cambios.").
- **G-5:** el front decide todo por permiso (`PUBLISH_VARIANT`) y nunca por rol, así que se adapta al seed sin cambios de código. Solo los textos dependen de D-3.
- **G-6:** el front traduce el `4080` (el backend ya trae su mensaje) y trata el `4072` como conflicto, sin mirar el status.
- **G-7:** paginación, orden y filtros en el cliente.
- **G-8:** el historial de versiones no se muestra.
- **G-9:** el front sugiere slugs a partir de la plantilla y la localidad para bajar la chance de duplicados, pero no los puede garantizar.
- **G-10:** el front canonicaliza `slugBase` antes de enviar (mismo criterio que `TagService`). No protege a otros clientes.
- **G-11:** la vista "Organismos que la adoptaron" filtra en el cliente; con la fuente real, una adopción de plantilla desactivada no se puede editar.
- **G-13:** con la fuente real, "Eliminar definitivamente" no se ofrece; queda la baja lógica (desactivar). La columna Rol muestra "Sin dato".
- **G-14:** resuelto; el paso de crear el tipo `publication_status` antes de arrancar el backend local ya no hace falta.
- **G-15:** resuelto en `dev`; falta verificarlo con el e2e local (CP16) y sacar el seed SQL (`E2E_SEED_SQL`). Adopciones sigue en mock fuera de `start:local` hasta OPS-1.
- **G-16:** el error de borrado en uso se muestra con el mensaje genérico de 500.
- **G-17:** el front muestra lo que devuelve `GET /api/tag`, sin cambios de código: si se amplía el alcance, AO/AGENT las ven solas.
- **G-18:** los 500 se muestran con el mensaje genérico prudente; el front envía fechas completas (`yyyy-MM-ddTHH:mm:ss`) y nunca ids de mock contra el backend (por eso la cadena de trámites va con una sola fuente).
- **G-19:** el e2e local siembra por SQL lo que no se puede crear por API; QA y demos usan el mock.
- **G-20 / G-21 / G-22:** "Asignar rol" (BO-24) queda limitada: contra el backend real, cualquier usuario con rol vigente responde 409 `4081`. El front traduce ese código con texto propio (`pages/usuarios/usuario-rol-save-error.ts`) y no puede ofrecer "cambiar rol" hasta que exista el cierre de la asignación.
- **G-23:** el form de usuario consume `GET /api/role/allowed`, así que AO verá los roles en cuanto el flag esté en `TRUE`, sin cambios de código.
- **G-24:** el front gatea por permiso, tal como hoy autoriza el backend; no agrega reglas por rol para AGENT.
- **G-25:** el front no muestra el `message` del backend para `4018` ni `4002` en usuarios (usa texto propio por contexto) y valida la contraseña con el límite real (8 a 20).
- **OPS-1:** staging y prod corren con la cadena de trámites y etiquetas en mock (`environment.staging.ts`, `environment.prod.ts`); lo nuevo se prueba con el backend local en Docker (`npm run start:local`). Cuando staging tenga `dev` hasta `V2.30`, se pasan Etiquetas a real; Plantillas y Adopciones van juntas con el resto de la cadena (se referencian por ids), es decir cuando además cierre G-1, salvo que se decida activar la cadena con la edición de fichas bloqueada como en `start:local`.
- **OPS-2:** el e2e ya no deja registros nuevos en staging; los existentes quedan inactivos.
- **DOC-1:** el front se integra contra el código de `dev` y este documento, no contra la guía.
