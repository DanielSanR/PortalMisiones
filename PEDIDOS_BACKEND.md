# Pedidos del backoffice al backend — Portal Provincial de Trámites (Misiones)

**Fecha:** 2026-10-13 · **Backend relevado:** `origin/dev` @ `23fd8f9` · **Contacto:** Daniel Romero (frontend backoffice)

El backoffice (Angular) ya consume la API real de organismos, taxonomía, roles, permisos y etiquetas, y está por integrar el núcleo de trámites: plantillas (`/api/procedure-template`), adopciones (`/api/organism-procedure`), fichas por localidad (`/api/organism-procedure-location`, "OTL") y puntos de atención (`/api/attention-point`). En este documento juntamos lo que hace falta corregir o exponer del lado del backend para cerrar esa integración. Cada pedido se verificó contra el código de `origin/dev` @ `23fd8f9`. Las rutas son relativas a `src/main/java/org/silicon/misiones/portal_misiones/` (código) y a `src/main/resources/db/` (migraciones), salvo que se indique otra cosa. Cada ítem está pensado para copiarse tal cual como tarjeta de Taiga.

---

## Resumen

| ID | Título | Prioridad | Tipo | Qué desbloquea en el front |
|---|---|---|---|---|
| **R-3** | Grants de `V2.20`/`V2.23`/`V2.24` filtran por `ROLE_*` y no matchean ningún rol | 🔴 bloquea | bug | Etiquetas (hoy desaparece del menú incluso para SA), Adopciones y Puntos de atención reales |
| **R-1** | `PUT` de la ficha acepta `publicationStatus` y saltea el workflow | 🔴 bloquea | bug | Edición segura de fichas (hoy cualquiera con `UPDATE_VARIANT` puede publicar) |
| **G-1** | Response de la ficha (OTL) incompleto y sin filtro por adopción | 🔴 bloquea | contrato | Pantallas de fichas por localidad con datos reales (hoy editar borraría requisitos, costos y URL) |
| **G-2 / BO-20** | Organismo del usuario en `/api/auth/me` | 🔴 bloquea | contrato | AO adopta trámites; AO/AGENT crean etiquetas locales; preselección de organismo |
| **BO-17** | Exponer `GET /api/user` | 🔴 bloquea | feature | Listado de usuarios y acciones de fila reales (hoy en mock) |
| **G-3** | Permisos de lectura para AO y AGENT (`READ_PROCEDURE`, `READ_ADOPTION`) | 🟡 importante | contrato (seed) | AO elige plantilla para adoptar; AGENT ve de qué trámite es cada ficha |
| **G-4** | Transiciones inválidas como 4xx + endpoints "rechazar" y "volver a borrador" | 🟡 importante | bug + feature | Mensajes de error precisos y bandeja de revisión completa |
| **G-5 / D-3** | Definir quién publica; AB sin `READ_VARIANT`/`PUBLISH_VARIANT` | 🟡 importante | contrato (seed + doc) | Bandeja de publicación para AB y textos de la UI |
| **G-9** | Unicidad de ficha (adopción + localidad) y de slug; cascada de vigencia | 🟡 importante | bug | Evitar fichas duplicadas, 500 en la ficha pública y trámites vencidos visibles |
| **G-7** | Paginación y filtros en los listados | 🟡 importante | feature | Panel de puntos de atención por ficha; listados con volumen real |
| **G-6** | Código `4080` sin mensaje; `4072` responde 400 y no 409 | 🔵 mejora | bug | Mensajes de error consistentes sin traducciones locales |
| **G-8** | Endpoint de versiones de la ficha (`otl_versions`) y control de concurrencia | 🔵 mejora | feature | Historial de versiones (FR-BACKOFFICE-07) y aviso de edición concurrente |
| **G-10** | Plantillas: canonicalizar `slugBase` y precisar el `4073` de catálogos | 🔵 mejora | bug | Slugs consistentes entre clientes y errores de catálogo que nombran el id faltante |
| **G-11** | Adopciones: editar con plantilla desactivada, cascada al desactivar plantilla, filtro por plantilla, `ownerOrganismId` | 🟡 importante | bug + contrato | Editar/deshabilitar adopciones de plantillas inactivas; vista "Organismos que la adoptaron" sin bajar todo |
| **G-12** | Fichas y puntos de atención: "no existe" como 500, workflow sobre inactivas, fichas sobre adopciones deshabilitadas, `DELETE` sin versión | 🟡 importante | bug | Mensajes de error precisos y datos consistentes en fichas y puntos |
| **DOC-1** | Corregir `docs/frontend_integration_guide.md` | 🔵 mejora | doc | Evitar que otros equipos (portal) integren contra información vieja |

---

## R-3 · Grants de `V2.20`, `V2.23` y `V2.24` sin efecto por el prefijo `ROLE_`

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

**Prioridad:** 🔴 · **Tipo:** bug (autorización)

**Problema**
- `service/OrganismProcedureLocationService.java:74` → `existing.setPublicationStatus(request.getPublicationStatus());` copia el estado del request, sin pasar por `isAllowedTransition` (`:109-116`).
- El `PUT` solo exige `UPDATE_VARIANT` (`controller/OrganismProcedureLocationController.java:55-56`), y AGENT lo tiene (`V0.1:81`).
- Resultado: un AGENT puede pasar una ficha a `PUBLICADO` sin revisión ni `PUBLISH_VARIANT`. Contradice `docs/design.md` D-3: "Ningún endpoint acepta un estado destino arbitrario".
- Además, si el request no trae `publicationStatus`, la columna es `NOT NULL` (`V2.12:21`) → **500**.

**Impacto en el front** — mientras no se corrija, el front reenvía el estado actual en cada `PUT`. Es una mitigación de UI y no protege contra llamadas directas a la API.

**Propuesta concreta**
- En `update`: ignorar `request.publicationStatus` y conservar el estado actual. Solo `transition(...)` cambia el estado.
- Sacar `publicationStatus` de `OrganismProcedureLocationRequestDTO` (o dejarlo deprecado e ignorado). `create` ya lo ignora (`:39`).

**Criterio de aceptación**
- [ ] `PUT` con `publicationStatus: "PUBLICADO"` sobre una ficha en `BORRADOR` → la ficha sigue en `BORRADOR`.
- [ ] `PUT` sin `publicationStatus` → 200, no 500.
- [ ] Test que lo cubra.

---

## G-1 · Response completo de la ficha por localidad + filtro por adopción

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
- `GET /api/organism-procedure-location?organismProcedureId={uuid}` (ver también G-7).
- `@NotNull` en `organismProcedureId`, `locationId`, `slug` y `active` → 400 `4012`.

**Criterio de aceptación**
- [ ] `GET /` y `GET /{id}` devuelven al menos los campos obligatorios.
- [ ] Un `GET /{id}` seguido de un `PUT` con ese mismo body no pierde contenido.
- [ ] `?organismProcedureId=` filtra, respetando el alcance del usuario.
- [ ] Un request sin campos obligatorios → 400 `4012` con `details` por campo.

---

## G-2 / BO-20 · Organismo del usuario en `/api/auth/me`

**Prioridad:** 🔴 · **Tipo:** contrato

**Problema**
- `security/dto/AuthMeResponseDTO.java:17-20` solo trae `userId, email, roles, permissions`. El JWT tampoco lleva el organismo: solo `roles`, `permissions` y `userId` (`security/service/JwtTokenService.java:81-83`).
- El backend sí conoce el organismo: `UserService.getCurrentScope()` (`security/service/UserService.java:333-354`) lo saca de la asignación vigente.
- Para AO, crear una adopción exige mandar `organismId` igual al del alcance. Si no coincide → 404 `4073` (`service/OrganismProcedureService.java:99-104`). Lo mismo pasa con las etiquetas locales (`service/TagService.java:105-108`).
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

**Prioridad:** 🔴 · **Tipo:** feature

**Problema**
- `security/controller/UserController.java` expone `POST /`, `GET /{id}`, `PUT /{id}`, `DELETE /{id}/admin` y otros, pero **no tiene un listado** (mappings en `:38, 56, 72, 90, 109, 153, 176, 199`).
- El servicio ya existe y está en la interfaz: `IUserService.findAllUserDTO()` (`security/service/abstraction/IUserService.java:24`). Su implementación (`security/service/UserService.java:102-112`) ya filtra por organismo para AO.
- No tiene tarjeta en `docs/tasks/backlog_taiga.md`.

**Impacto en el front** — el listado de usuarios y sus acciones de fila (desactivar, cambiar email, etc.) siguen en mock.

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
- [ ] El response usa el mismo `UserResponseDTO` que `GET /{id}`.

---

## G-3 · Permisos de lectura para AO y AGENT

**Prioridad:** 🟡 · **Tipo:** contrato (seed) — requiere confirmación de producto

**Problema** — seed vigente (`V0.1:53-92`, `V2.9:54-70`, `V2.20`):

| Permiso | SA | AB | AO | AGENT | MANAGER |
|---|---|---|---|---|---|
| `READ_PROCEDURE` | ✓ | ✓ | **✗** | **✗** | ✓ |
| `READ_ADOPTION` (tras R-3) | ✓ | ✓ | ✓ | **✗** | ✗ |
| `READ_VARIANT` | ✓ | ✗ | ✓ | ✓ | ✓ |

- AO puede crear adopciones (`CREATE_ADOPTION`) pero **no puede listar plantillas** (`GET /api/procedure-template` exige `READ_PROCEDURE`, `controller/ProcedureTemplateController.java:35-36`), así que no tiene cómo elegir qué adoptar.
- AGENT edita fichas pero no puede ver la adopción ni la plantilla a la que pertenecen.

**Impacto en el front** — el diálogo "Adoptar" queda inutilizable para AO, y AGENT ve fichas sin título de trámite. G-1 con nombres mitiga esto último.

**Propuesta concreta** — si producto lo confirma, sumar a la migración de R-3:
- AO: `READ_PROCEDURE`.
- AGENT: `READ_PROCEDURE` y `READ_ADOPTION`.

Las plantillas son globales, así que dar lectura no expone datos de otros organismos. Las adopciones ya se filtran por alcance (`service/OrganismProcedureService.java:60-62`).

**Criterio de aceptación**
- [ ] Con AO, `GET /api/procedure-template` → 200.
- [ ] Con AGENT, `GET /api/organism-procedure` → 200, solo las de su organismo.

---

## G-4 · Transiciones de la ficha: errores 4xx y endpoints faltantes

**Prioridad:** 🟡 · **Tipo:** bug + feature

**Problema**
1. **Las transiciones inválidas responden 500.** `transition` lanza `IllegalArgumentException("Invalid publication transition")` (`service/OrganismProcedureLocationService.java:88-90`), que el handler genérico convierte en **500 `5000`** (`exception/GlobalExceptionHandler.java:99-106`). Pasa lo mismo con "ficha no encontrada o fuera de alcance" (`:142-150`), "adopción no encontrada" (`:131-140`) y "localidad no encontrada" (`:152-155`). Contradice `docs/design.md` D-9 y el criterio de PPDT-5.6 (`docs/tasks/backlog_taiga.md:247`).
2. **Hay transiciones permitidas sin endpoint.** El mapa (`:109-116`) admite `EN_REVISION → BORRADOR` y `DESPUBLICADO → BORRADOR`, pero el controller solo expone `submit-review`, `publish` y `unpublish` (`controller/OrganismProcedureLocationController.java:62-81`). No hay forma de **rechazar** una ficha en revisión ni de volver a borrador una despublicada.
3. **A confirmar:** el mapa permite `BORRADOR → DESPUBLICADO` vía `unpublish` (`:111`). ¿Es intencional?

**Impacto en el front** — un 500 genérico no le dice al usuario qué pasó; hoy los textos son prudentes ("no se pudo completar la acción"). La bandeja de revisión no puede ofrecer "Rechazar".

**Propuesta concreta**
- Transición inválida → **409** con código nuevo, por ejemplo `4081`: `"No se puede pasar la ficha de %s a %s."`.
- Ficha, adopción o localidad inexistente o fuera de alcance → **404 `4073`**, como en `OrganismProcedureService` y `AttentionPointService`.
- Endpoints nuevos:
  - `POST /api/organism-procedure-location/{id}/reject` — `PUBLISH_VARIANT` — body `{ "reason": "Falta el costo del sellado" }` → `EN_REVISION → BORRADOR`. El motivo se guarda (en `otl_versions` o en `audit_events`) y se devuelve.
  - `POST /api/organism-procedure-location/{id}/return-to-draft` — `UPDATE_VARIANT` → `DESPUBLICADO → BORRADOR`.

**Criterio de aceptación**
- [ ] `publish` sobre una ficha en `BORRADOR` → 409 `4081` con mensaje legible.
- [ ] `GET /{id}` de una ficha de otro organismo (con AO) → 404 `4073`, no 500.
- [ ] `reject` y `return-to-draft` funcionan, generan versión y respetan el alcance.
- [ ] Tests de workflow para cada transición inválida.

---

## G-5 / D-3 · Quién publica: definición y seed de AB

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

---

## G-9 · Unicidad de fichas y de slug; cascada de vigencia

**Prioridad:** 🟡 · **Tipo:** bug (integridad)

**Problema**
1. **Sin unicidad.** `organism_procedure_locations` (`V2.12:13-25`) no tiene UNIQUE de `(organism_procedure_id, location_id)` ni de `slug`, y ninguna migración posterior lo agrega. Son criterios de aceptación de PPDT-5.6 que no se implementaron (`docs/tasks/backlog_taiga.md:248,250`).
2. **Slug duplicado rompe la ficha pública.** `findPublishedBySlug` devuelve `Optional` (`repository/OrganismProcedureLocationRepository.java:20-34`). Si hay dos fichas publicadas con el mismo slug, Spring lanza `IncorrectResultSizeDataAccessException` → 500 en `GET /api/procedure/{slug}` (`service/ProcedureService.java:79-81`). Además, el UK propuesto en el backlog, `(slug, organism_procedure_id)`, no alcanza: la ruta pública resuelve solo por slug.
3. **Vigencia.**
   - El criterio "cerrar `effective_to` marca las OTL activas como `despublicado`" (`docs/tasks/backlog_taiga.md:215`) no está implementado. `OrganismProcedureService.update`/`delete` (`:72-97`) no tocan las fichas.
   - La búsqueda y el detalle públicos filtran `op.enabled = true` pero **no la vigencia** (`repository/OrganismProcedureLocationRepository.java:28-32, 47-51`). Una adopción vencida sigue publicada.
   - Una adopción deshabilitada se oculta en el portal por ese filtro, pero sus fichas siguen figurando como `PUBLICADO` en el backoffice.

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
| `/api/organism-procedure-location` | `organismProcedureId`, `locationId`, `publicationStatus`, `active` |
| `/api/organism-procedure` | `procedureTemplateId`, `organismId`, `includeDisabled` |
| `/api/procedure-template` | `q` (título o slug), `categoryId`, `includeInactive` |
| `/api/user` (BO-17) | `q`, `organismId`, `roleCode` |

**Criterio de aceptación**
- [ ] `GET /api/attention-point?organismProcedureLocationId=…` devuelve solo los puntos de esa ficha, respetando el alcance.
- [ ] Sin parámetros, los endpoints mantienen el comportamiento actual (compatibilidad), o el cambio de contrato se avisa con anticipación.

---

## G-6 · Mensaje del `4080` y status del `4072`

**Prioridad:** 🔵 · **Tipo:** bug

**Problema**
- `OrganismProcedureService.java:145` lanza `4080` (409, adopciones con vigencias solapadas), pero `response.code.4080` **no existe** en `messages/messages.properties`: los códigos terminan en `4076` y no hay bundle `messages/defaults`. Como `MessageSourceConfig.java:21` tiene `setUseCodeAsDefaultMessage(true)`, el cliente recibe el literal `"response.code.4080"`.
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
- `slugBase` solo se valida con `@NotBlank` y unicidad: el backend **no lo canonicaliza**, a diferencia de `/api/tag`
  (`TagService` sí normaliza). Otro cliente puede guardar `Obtener-DNI` y `obtener-dni` como plantillas distintas.
- Cuando uno de los ids de catálogo (`categoryIds`, `tagIds`, `lifeEventIds`, `recipientIds`) no existe, el `4073`
  informa siempre `ids.get(0)` (`resolveAll`), no el id que falta.

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
   la plantilla con `loadTemplate`, que exige `isActive`, y responde 404 `4073`. Incluye deshabilitarla por `PUT`
   (el `DELETE` sí funciona).
2. **Desactivar una plantilla no toca sus adopciones:** `ProcedureTemplateService.delete` solo hace `setActive(false)`;
   las adopciones siguen listadas y habilitadas apuntando a una plantilla que ya no se lista.
3. **`GET /api/organism-procedure` no filtra por plantilla:** con alcance global trae todo y filtra `enabled` en memoria.
4. **`ownerOrganismId` no tiene semántica documentada** (con alcance de organismo debe ser el propio o responde `4073`).
5. Jackson serializa `LocalDateTime` omitiendo los segundos cuando son 0 (`2026-01-01T00:00`); el front lo tolera, pero
   conviene fijar el formato.

**Propuesta**
1. En `update`, validar que la plantilla exista (no que esté activa) cuando no cambia `procedureTemplateId`.
2. Definir la cascada: al desactivar una plantilla, deshabilitar sus adopciones (o impedir desactivarla si tiene
   adopciones habilitadas, con un error de negocio claro).
3. `GET /api/organism-procedure?procedureTemplateId=<uuid>` (y `?organismId=` para el alcance global).
4. Documentar `ownerOrganismId` (¿organismo responsable del contenido cuando difiere del que adopta?).
5. `@JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")` en los `LocalDateTime` de los DTOs.

**Criterio de aceptación**
- [ ] `PUT` de una adopción con plantilla inactiva y `enabled: false` responde 200.
- [ ] Desactivar una plantilla con adopciones habilitadas aplica la cascada definida (o responde un 409 con mensaje).
- [ ] `GET /api/organism-procedure?procedureTemplateId=…` devuelve solo las de esa plantilla.
- [ ] `ownerOrganismId` documentado en Swagger.

---

## G-12 · Fichas por localidad y puntos de atención: validaciones faltantes

**Prioridad:** 🟡 importante · **Tipo:** bug · Detectado al integrar fichas y puntos de atención (fases 3 y 4 del front).

**Problema** (todo en `origin/dev` @ `23fd8f9`)
1. **"No existe" responde 500, no 404:** `loadOrganismProcedureLocation`, `loadLocation` y `loadOrganismProcedure`
   (`OrganismProcedureLocationService`) lanzan `IllegalArgumentException`. El front no puede decir "esa ficha no existe".
2. **Workflow sobre fichas desactivadas:** `transition` no mira `active`; una ficha inactiva puede quedar `PUBLICADO`.
3. **Fichas sobre adopciones deshabilitadas o vencidas:** `loadOrganismProcedure` no valida `enabled` ni la vigencia.
4. **El `DELETE` de la ficha no genera versión** aunque la despublique (no llama a `buildSnapshot`, a diferencia de
   `update` y `transition`).
5. **El listado de fichas incluye las inactivas** (`findAll`/`findAllByOrganismProcedureOrganismId` no filtran `active`).
   Si es intencional, documentarlo; si no, filtrar o agregar `?includeInactive`.
6. **Puntos de atención:** se pueden crear sobre una ficha inactiva (`AttentionPointService.map` no lo valida), y con más
   de 6 decimales `NUMERIC(9,6)` redondea en silencio (validar escala o documentar).

**Propuesta:** `GlobalAppException` 404 `4073` para los "no existe"; rechazar con 4xx (código propio) el workflow sobre
fichas inactivas y la creación de fichas/puntos sobre padres deshabilitados o vencidos; snapshot en `delete`; validar
`@Digits(integer = 3, fraction = 6)` en latitud/longitud.

**Criterio de aceptación**
- [ ] `GET/PUT /api/organism-procedure-location/<uuid-inexistente>` → 404 `4073`.
- [ ] `POST /{id}/publish` sobre una ficha con `active=false` → 4xx con código de negocio.
- [ ] `POST /api/organism-procedure-location` con una adopción deshabilitada o vencida → 4xx.
- [ ] `DELETE` de una ficha incrementa `currentVersionNumber`.
- [ ] `POST /api/attention-point` con latitud de 7 decimales → 400 `4012`.

---

## DOC-1 · Corregir `docs/frontend_integration_guide.md`

**Prioridad:** 🔵 · **Tipo:** doc

**Problema** — la guía (último cambio en `2e41090`) contradice el código actual:

| Línea | Dice | Código actual |
|---|---|---|
| 98 | "No existe endpoint `/me`." | `GET /api/auth/me` existe (`security/controller/AuthController.java:99-107`) |
| 323-324, 347-348 | `GET /api/role`, `GET /api/role/{id}`, `GET /api/permission` y `GET /api/permission/{id}` son "solo `SUPERADMIN`" | `hasAnyRole('SUPERADMIN', 'ADMIN_BACKOFFICE')` (`RoleController.java:41,58`; `PermissionController.java:32,43`). La escritura sí es solo SUPERADMIN |
| 439-440 | No existe `/api/user/me` ni listado de usuarios | Es correcto, pero conviene aclarar que el "me" es `/api/auth/me` y referenciar BO-17 |
| 441-443 | No hay endpoints de `Procedure`, `procedure_templates`, `organism_procedures`, `organism_procedure_locations` ni `attention_points` | Existen desde `23fd8f9` (y `/api/tag` desde `84fde37`) |
| 470 | `/api/organism-type` "exige `SUPERADMIN`" | Usa `hasAuthority('READ_ORGANISM_TYPE')` y equivalentes (`OrganismTypeController.java:39-88`) |

**Propuesta concreta** — actualizar esas filas y agregar las secciones de `/api/tag`, `/api/procedure-template`, `/api/organism-procedure`, `/api/organism-procedure-location` (con el mapa de transiciones) y `/api/attention-point`, con permisos y códigos de error.

**Criterio de aceptación**
- [ ] La guía coincide con los `@PreAuthorize` y los DTOs de `dev`.
- [ ] Documenta todos los endpoints nuevos.

---

## Orden sugerido de atención

1. **R-3:** una migración chica que habilita Etiquetas, Adopciones y Puntos de atención para todos los roles. Conviene sumar en el mismo archivo los grants que se decidan en **G-3** y **G-5**.
2. **R-1:** cambio de una línea, y cierra un agujero de autorización.
3. **G-1:** mapear campos que ya están en la entidad. Desbloquea toda la sección de fichas.
4. **G-2 / BO-20:** extender `/api/auth/me`. Desbloquea "Adoptar" y etiquetas locales para AO/AGENT.
5. **BO-17:** un método de controller sobre un servicio que ya existe.
6. **G-4:** errores 4xx y endpoints de rechazo y vuelta a borrador.
7. **G-9:** unicidad y vigencia, antes de que haya datos reales duplicados.
8. **G-7:** primero el filtro de puntos de atención por ficha; después la paginación.
9. **G-6**, **G-8** y **DOC-1**.

## Qué hace el front mientras tanto

- **R-3:** SUPERADMIN puede asignar los permisos a mano desde la pantalla de Roles. Si no, Etiquetas queda oculta.
- **R-1:** el `PUT` de la ficha reenvía siempre el estado actual. La UI nunca ofrece cambiar el estado desde el formulario.
- **G-1:** fichas por localidad y puntos de atención en **mock con la forma real del contrato**, también en producción. El `HttpDataSource` queda escrito pero no se activa.
- **G-2 / G-3:** "Adoptar" se oculta para AO, y el select de organismo de etiquetas solo ofrece lo que el backend acepta.
- **BO-17:** el listado de usuarios sigue en mock. El detalle (`GET /api/user/{id}`) ya es real.
- **G-4:** los 500 de fichas se muestran con un mensaje genérico. "Rechazar" no se ofrece.
- **G-5:** el front decide todo por permiso (`PUBLISH_VARIANT`) y nunca por rol, así que se adapta al seed sin cambios de código. Solo los textos dependen de D-3.
- **G-6:** el front traduce el `4080` y trata el `4072` como conflicto, sin mirar el status.
- **G-7:** paginación, orden y filtros en el cliente.
- **G-8:** el historial de versiones no se muestra.
- **G-9:** el front sugiere slugs a partir de la plantilla y la localidad para bajar la chance de duplicados, pero no los puede garantizar.
