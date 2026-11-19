# Plan — Trámites contra la API real (BO-15 + BO-19)

Fecha: 2026-10-13 · Backend leído desde `origin/dev` @ `23fd8f9` · Front: working tree de `feat/abm-secciones`.
Estado: **propuesta para revisar**. No hay código escrito.

> **Actualización 2026-11-19:** contrato (§1), riesgos (§6), preguntas (§7) y estado (§9) revisados contra
> `origin/dev` @ `586b670` (13 commits sobre `58d383a`; migraciones hasta `V2.31`). Resueltos en `dev`: **G-1** (response
> completo de la ficha y filtro por adopción), **G-2** (organismo en `/api/auth/me`), G-6 (`4072` → 409), G-10
> (`slugBase` canónico) y G-22; parciales: G-3 (`READ_PROCEDURE` para AO), G-7, G-9 y G-12. Con G-1 resuelto, fichas y
> puntos de atención pasan a **real en staging y prod** (rama `feat/alinear-backend-586b670`). Ese pase requiere backend >=
> `586b670`: al relevar, staging seguía en `58d383a` y OPS-1 se reabrió; **el mismo 2026-11-19 el backend desplegó `dev`
> en staging** (`origin/staging` @ `0a555df`, contiene `586b670`) y `/api-docs` ya publica el contrato nuevo de la ficha
> y de `/me` (solo se verificó el esquema; todavía no se ejecutó ningún flujo). Lo marcado 🆕 en §1 es de `586b670` y
> está en staging desde ese día. Pedidos nuevos: G-26 a G-29 (`PEDIDOS_BACKEND.md`).
>
> **Actualización 2026-11-16 (historial; `58d383a` se desplegó en staging esa misma tarde):** contrato (§1), riesgos (§6), preguntas (§7) y estado (§9) revisados contra
> `origin/dev` @ `58d383a` (migraciones hasta `V2.30`). Resueltos en `dev`: R-3 (`V2.28` + `V2.30`), R-1, G-14 y G-15.
> **Staging todavía no tiene nada de eso** (quedó en el merge del 2026-10-17): activar features en real online depende
> de OPS-1. El resto del plan (§2 a §5 y §8) es el original del 2026-10-13. Estado de cada pedido en `PEDIDOS_BACKEND.md`.

---

## 0. Resumen

1. **El backend no tiene una entidad "trámite".** Tiene cuatro recursos encadenados:
   - **Plantilla provincial** (`/api/procedure-template`).
   - **Adopción por organismo, con vigencia** (`/api/organism-procedure`).
   - **Ficha por localidad** (`/api/organism-procedure-location`, "OTL"). Tiene el estado de publicación, los requisitos, los costos y la URL.
   - **Puntos de atención** (`/api/attention-point`), que cuelgan de la ficha.

   El mock actual (`TramiteVM` con organismo, estado y "contenido por localidad" que hereda lo provincial) no tiene esta forma, así que es una **reestructura**.
2. **Plantillas y puntos de atención se pueden integrar ya.** Adopciones se puede integrar para SA; para AO hay un bloqueo (G-2).
3. ~~**Las fichas por localidad están bloqueadas por el contrato (G-1).**~~ ✅ Resuelto en `586b670` (`3797fe7`; en staging desde el 2026-11-19): el response trae adopción, localidad, URL, requisitos y costos (§1.4). Contra un backend anterior (`58d383a`, lo que staging tuvo hasta el 2026-11-19) el response devuelve solo `id, slug, publicationStatus, active, currentVersionNumber` y, como el `PUT` reemplaza todo, editar una ficha borraría requisitos, costos y URL.
4. **D-3 (quién aprueba la publicación):** en el código depende solo del permiso `PUBLISH_VARIANT`. Si el front decide todo por permiso y nunca por rol, D-3 se puede cambiar desde el seed. Solo hay que dejar configurables los textos.

> ✅ **R-3 resuelto (`V2.28` + `V2.30`), en staging desde el 2026-11-16:**
> - El problema: `V0.4__normalize_role_codes.sql` les quitó el prefijo `ROLE_` a los códigos de rol, y `V2.20`
>   (`*_ADOPTION`), `V2.23` (`*_ATTENTION_POINT`) y `V2.24` (`*_TAG`) filtraban solo por `'ROLE_…'`: ningún rol recibía
>   esos permisos.
> - El fix: `V2.28` los otorga a `SUPERADMIN`, `ADMIN_BACKOFFICE`, `ADMIN_ORGANIZATION` y `AGENT` por el código sin
>   prefijo, y `V2.30` le quita a AGENT `CREATE_ADOPTION` y `DELETE_ADOPTION`.
> - Hasta el deploy del 2026-11-16, en staging Etiquetas (gateada por `READ_TAG`), Adopciones y Puntos de atención
>   respondían 403 incluso para SUPERADMIN, y por eso iban en mock.
> - Verificar en cada base: `SELECT r.code, p.code FROM role_permissions rp JOIN roles r ON r.id = rp.role_id JOIN permissions p ON p.id = rp.permission_id WHERE p.code LIKE '%\_TAG' ESCAPE '\';`

---

## 1. Contrato real

### 1.1 Convenciones comunes
- **Éxito:** `ResponseDTO<T> = { code, details, data }`. Códigos 2001 (creado), 2002 (actualizado), 2003 (borrado lógico) y 2013 (consulta).
- **Error:** `MessageDTO { code, message, details }`.
  - Validación → 400, código `4012`. En `details` viene `"campo: mensaje; ..."`.
  - Sin permiso → 403. Sin token → 401, código `4025`.
  - Usuario sin asignación vigente o rol de organismo sin organismo → 403, código `4029`.
  - **Excepción no manejada o error de base de datos → 500, código `5000`.** En `58d383a` las fichas ya responden
    404 `4073` ("no existe" o fuera de alcance) y 409 `4077` (transición inválida); siguen en 500 una violación de las
    constraints únicas (G-9), un id que no es UUID y un body ilegible (G-18). 🆕 Desde `586b670`, un campo obligatorio
    faltante en la ficha responde 400 `4012` (antes 500).
  - 🆕 **Duplicado (`4072`) → 409** desde `586b670` (en staging desde el 2026-11-19; antes 400). Mapear por `code`.
- **Listados:** ningún endpoint de estos cuatro controllers pagina ni ordena. Devuelven `List<T>` completa dentro del alcance. 🆕 Desde `586b670` hay dos filtros: `?organismProcedureId=` en fichas (§1.4) y `?organismProcedureLocationId=` en puntos de atención (§1.5); el resto se filtra en el cliente (G-7).
- **Alcance (`OrganismScope`, `545fffa`):**
  - Rol de la asignación vigente con `scope_type=global` (SA, AB, MANAGER) → global.
  - Con `organismo` (AO, AGENT) → el organismo de la asignación.
  - 🆕 **Desde `586b670` (`d7aca1c`, G-2) `/api/auth/me` devuelve el alcance:** `scope` (`"global"` | `"organismo"`), `organismId`, `organismName` y `organismAcronym` (los tres en `null` con alcance global). Sin asignación vigente responde 403 `4029`. El JWT sigue sin llevar el organismo. Contra un backend anterior (`58d383a`) `/me` no trae esos campos y la sesión queda sin organismo.

### 1.2 `/api/procedure-template` — plantilla provincial (alcance global)
| Método | Ruta | Permiso | Notas |
|---|---|---|---|
| GET | `/` | `READ_PROCEDURE` | **solo `active=true`** |
| GET | `/{id}` | `READ_PROCEDURE` | también inactivas |
| POST | `/` | `CREATE_PROCEDURE` | 201 |
| PUT | `/{id}` | `UPDATE_PROCEDURE` | reemplazo total, incluidos los puentes |
| DELETE | `/{id}` | `DELETE_PROCEDURE` | pone `active=false` |

- **Request:** `slugBase*` (único; 🆕 desde `586b670` el servidor lo canonicaliza antes de validar y persistir: NFD, sin marcas diacríticas, minúsculas, `[^a-z0-9]+` → `-`, sin guiones en los extremos; el response devuelve el canónico), `titleBase*` (máximo 255), `shortDescription?`, `longDescription?`, `modalityId?`, `mainCategoryId?`, `categoryIds?`, `tagIds?`, `lifeEventIds?`, `recipientIds?`, `active*`.
- **Response:** los mismos campos más `id`. **Solo ids, sin nombres ni fechas.**
- **Errores:** `4072` (slug en uso; 🆕 **409** desde `586b670`, 400 antes), `4073` (404, plantilla o algún id inexistente; 🆕 desde `586b670` el mensaje nombra el id de catálogo que falta y su entidad), `4012`.
- No valida que `mainCategoryId` esté dentro de `categoryIds`. Una plantilla desactivada deja de listarse.

### 1.3 `/api/organism-procedure` — adopción
| Método | Ruta | Permiso | Notas |
|---|---|---|---|
| GET | `/` | `READ_ADOPTION` | global: todas `enabled=true`; organismo: las suyas. **Las deshabilitadas no se listan** |
| GET | `/{id}` | `READ_ADOPTION` | fuera del alcance → 404 `4073` |
| POST | `/` | `CREATE_ADOPTION` | |
| PUT | `/{id}` | `UPDATE_ADOPTION` | reemplazo total |
| DELETE | `/{id}` | `DELETE_ADOPTION` | pone `enabled=false` |

- **Request:** `procedureTemplateId*` (plantilla activa), `organismId*` (organismo activo), `ownerOrganismId?`, `enabled*`, `effectiveFrom*` (`LocalDateTime` sin zona), `effectiveTo?`.
- **Response:** los mismos campos más `id`. Solo ids.
- **Reglas:**
  - Con alcance de organismo, `organismId` y `ownerOrganismId` tienen que ser el propio. Si no, responde 404 `4073` (no 403).
  - `effectiveTo` tiene que ser posterior a `effectiveFrom` → si no, `4012`.
  - No puede haber dos adopciones habilitadas de la misma plantilla en el mismo organismo con vigencias solapadas → **409 `4080`**. Desde `58d383a` el código trae mensaje ("No se puede activar una adopción de plantilla porque se superpone en vigencia con otra adopción del mismo organismo."); el front igual lo traduce.
  - La consulta de solapamiento ya no da 500 al crear o editar una adopción habilitada (G-15, casts en `findOverlappingEnabled`; resuelto en `dev`, sin verificar todavía con el e2e).
- **Pendiente en el backend:** deshabilitar o vencer una adopción **no despublica sus fichas** (G-9). 🆕 Desde `586b670` (`1888e1a`) la búsqueda y el detalle públicos sí filtran por vigencia, y no se pueden crear ni editar fichas sobre una adopción no vigente (§1.4).
- El listado devuelve las adopciones habilitadas sin mirar las fechas: incluye las que todavía no empezaron y las vencidas.

### 1.4 `/api/organism-procedure-location` — ficha por localidad (OTL)
| Método | Ruta | Permiso | Acción |
|---|---|---|---|
| GET | `/` | `READ_VARIANT` | global: todas; organismo: las suyas. 🆕 `?organismProcedureId=<uuid>` filtra por adopción dentro del alcance (`586b670`); incluye inactivas |
| GET | `/{id}` | `READ_VARIANT` | |
| POST | `/` | `CREATE_VARIANT` | siempre en `BORRADOR` (ignora el estado enviado); versión 1 |
| PUT | `/{id}` | `UPDATE_VARIANT` | reemplazo total **salvo el estado**: desde `58d383a` ya no aplica `publicationStatus` (R-1 resuelto; el campo sigue en el DTO y se ignora); versión N+1 |
| POST | `/{id}/submit-review` | `UPDATE_VARIANT` | → `EN_REVISION` |
| POST | `/{id}/publish` | `PUBLISH_VARIANT` | → `PUBLICADO` |
| POST | `/{id}/unpublish` | `PUBLISH_VARIANT` | → `DESPUBLICADO` |
| DELETE | `/{id}` | **`UPDATE_VARIANT`** | pone `active=false`; si estaba publicada → `DESPUBLICADO` |

- **Request** (🆕 `586b670`): `organismProcedureId*`, `locationId*`, `slug*`, `active*`, `url?`, `requirements?`, `costs?`, `publicationStatus` (se ignora en el `POST` y en el `PUT`). Si falta un obligatorio → **400 `4012`** con el detalle por campo. *(Hasta `58d383a`: sin validaciones, y un campo NOT NULL faltante daba 500.)*
- **Response** (🆕 `586b670`, G-1 ✅): `id, organismProcedureId, locationId, slug, url, requirements, costs, publicationStatus, active, currentVersionNumber`, en el listado, el detalle, el alta, la edición y las transiciones. Sin nombres (trámite, organismo, localidad), fechas ni `lockVersion`: se resuelven por id. *(Hasta `58d383a`: solo `id, slug, publicationStatus, active, currentVersionNumber`.)*
- 🆕 **Vigencia de la adopción** (`586b670`, `1888e1a`): `POST` y `PUT` responden **404 `4073`** si la adopción está deshabilitada, todavía no empezó o venció. Es el mismo código que "no existe" y también bloquea la edición de fichas existentes (G-27). Las transiciones y el `DELETE` no la validan.
- **Transiciones permitidas.** Las inválidas responden **409 `4077`** ("La transición de publicación solicitada no es válida desde el estado actual."; antes de `58d383a`, 500 `5000`):

| Estado | `submit-review` | `publish` | `unpublish` | Sin endpoint |
|---|---|---|---|---|
| `BORRADOR` | → `EN_REVISION` | ✗ | → `DESPUBLICADO` | — |
| `EN_REVISION` | ✗ | → `PUBLICADO` | ✗ | → `BORRADOR` (rechazar) |
| `PUBLICADO` | ✗ | ✗ | → `DESPUBLICADO` | — |
| `DESPUBLICADO` | ✗ | → `PUBLICADO` (sin revisión) | ✗ | → `BORRADOR` |

- **Versionado:** `otl_versions` sin endpoint de lectura.
- **Concurrencia:** la ficha tiene `@Version` (`lock_version`, `V2.27`) y hay un handler → **409 `4091`** ("El recurso fue modificado por otro usuario."). Pero `lockVersion` no viaja en el request ni en el response, así que entre dos ediciones sucesivas **la última escritura sigue ganando**; solo se detectan dos transacciones simultáneas (y probablemente como 500: G-8).
- **Unicidad (`V2.27`):** `UNIQUE (organism_procedure_id, location_id)` y `UNIQUE (slug, organism_procedure_id)`. No hay validación previa: una violación sale como 500 (G-9). El slug **no** es único global, y dos fichas publicadas con el mismo slug (de adopciones distintas) rompen el detalle público, que resuelve solo por slug.

### 1.5 `/api/attention-point` — puntos de atención
| Método | Ruta | Permiso | Notas |
|---|---|---|---|
| GET | `/` | `READ_ATTENTION_POINT` | todos los del alcance, activos e inactivos. 🆕 `?organismProcedureLocationId=<uuid>` (`586b670`): los de esa ficha, **solo activos** (G-29) |
| GET | `/{id}` | `READ_ATTENTION_POINT` | |
| POST | `/` | `CREATE_ATTENTION_POINT` | |
| PUT | `/{id}` | `UPDATE_ATTENTION_POINT` | reemplazo total |
| DELETE | `/{id}` | `DELETE_ATTENTION_POINT` | pone `active=false` |

- **Request:** `organismProcedureLocationId*`, `name*`, `address*`, `contactInfo?`, `openingHours?`, `latitude*`, `longitude*` (`NUMERIC(9,6)`), `active*`.
- **Errores:**
  - `4012`: latitud fuera de [-90, 90] o longitud fuera de [-180, 180].
  - `4073`: la ficha o el punto no existe o está fuera del alcance.

### 1.6 Permisos por rol según el seed (`dev` @ `586b670`, con `V2.28`, `V2.30` y `V2.31`; staging tiene hasta `V2.30`)
| Permiso | SA | AB | AO | AGENT | MANAGER |
|---|---|---|---|---|---|
| `READ_PROCEDURE` | ✓ | ✓ | ✓ (`V2.31`) | ✗ | ✓ |
| `CREATE/UPDATE_PROCEDURE` | ✓ | ✓ | ✗ | ✗ | ✗ |
| `DELETE_PROCEDURE` | ✓ | **✗** | ✗ | ✗ | ✗ |
| `READ_ADOPTION` / `UPDATE_ADOPTION` | ✓ | ✓ | ✓ | ✓ | ✗ |
| `CREATE_ADOPTION` / `DELETE_ADOPTION` | ✓ | ✓ | ✓ | **✗** (`V2.30`) | ✗ |
| `READ_VARIANT` | ✓ | **✗** | ✓ | ✓ | ✓ |
| `CREATE_VARIANT` | ✓ | ✗ | ✓ | **✗** | ✗ |
| `UPDATE_VARIANT` | ✓ | ✗ | ✓ | ✓ | ✗ |
| `PUBLISH_VARIANT` | ✓ | **✗** | ✓ | ✗ | ✗ |
| `*_ATTENTION_POINT` | ✓ | ✓ | ✓ | ✓ | ✗ |
| `READ_ORGANISM` | ✓ | ✗ | ✗ | ✗ | ✗ |
| `*_TAG` | ✓ | ✓ | ✓ | ✓ | — |

**Qué puede hacer cada rol:**
- **SA:** todo.
- **AB:**
  - Gestiona plantillas, sin desactivarlas, y adopta para cualquier organismo.
  - No ve fichas ni las publica, y no ve la lista de organismos.
  - Tiene `*_ATTENTION_POINT`, pero sin `READ_VARIANT` no llega a la ficha de la que cuelgan los puntos (G-5).
- **AO:**
  - Adopta y gestiona fichas, las publica y gestiona puntos de atención, todo dentro de su organismo.
  - 🆕 Lista y consulta plantillas para adoptar (`READ_PROCEDURE`, `V2.31`; en staging desde el 2026-11-19). Su organismo llega en `/api/auth/me` (G-2).
- **AGENT:**
  - Edita fichas existentes, las envía a revisión y gestiona puntos de atención.
  - No crea fichas.
  - Ve y edita las adopciones de su organismo (`READ_ADOPTION`, `UPDATE_ADOPTION`); no las crea ni las deshabilita
    con el `DELETE`. Ojo: con el `PUT` puede mandar `enabled: false`, y con el `DELETE` de la ficha (`UPDATE_VARIANT`)
    puede despublicar sin `PUBLISH_VARIANT` (G-24).
  - No sabe de qué trámite es cada ficha: ve la adopción, pero no la plantilla (sin `READ_PROCEDURE`, G-3; el response de la ficha tampoco trae el título).
- **MANAGER:** solo lectura.

### 1.7 Endpoints públicos útiles
`GET /api/procedure/{slug}` devuelve la ficha publicada completa, con los nombres de organismo, localidad, categoría y modalidad y los puntos de atención. Sirve para la "Vista previa pública" de fichas `PUBLICADO`. 🆕 Desde `586b670` responde 404 `4073` si la adopción no está vigente, aunque la ficha figure `PUBLICADO`.

---

## 2. Qué cambia respecto del front actual

### 2.1 `TramiteVM` frente al modelo real
| Actual | Real | Qué hacer |
|---|---|---|
| `titulo`, `slug`, `resumen`, `descripcionLarga` | plantilla `titleBase`, `slugBase`, `shortDescription`, `longDescription` | Se mapean |
| `modalidadId: number` | plantilla `modalityId` (UUID) | Pasa a `string` |
| `categorias`, `etiquetas`, `destinatarios`, `eventosDeVida` | `categoryIds`, `tagIds`, `recipientIds`, `lifeEventIds` | Se mapean; se agrega **categoría principal** |
| — | plantilla `active` | **Falta** |
| `organismoId/Nombre` | adopción `organismId` | Sale de la plantilla |
| `estado` | ficha `publicationStatus` | Sale de la plantilla; `revision` → `EN_REVISION` |
| `requisitos`, `costos` | ficha `requirements`, `costs` | Son por localidad |
| `urlOficial`, `sitioWebTramite` | ficha `url` | Se unifican |
| `contacto` | punto de atención `contactInfo` | Se mueve |
| `localidades` | una ficha por localidad | Se reemplaza |
| `formularios`, `icono`, `destacado`, `createdAt`/`updatedAt` | — | **Se quitan** |
| — | adopción vigencia (`effectiveFrom/To`, `enabled`) | **Falta** |
| — | ficha `slug`, `active`, `currentVersionNumber` | **Falta** |

### 2.2 `ContenidoLocalidadVM` frente a ficha y puntos de atención
- `localidadId` → ficha `locationId` (UUID).
- `costos` → ficha `costs`.
- `urlTramite`/`sitioWeb` → ficha `url`.
- `contacto`/`horarios` → punto de atención `contactInfo`/`openingHours`.
- `notas` se quita.
- **Faltan:** ficha `requirements`, `slug`, `active`, estado y versión; punto de atención `name`, `address`, `latitude` y `longitude`.
- **"Hereda el valor provincial" desaparece**, porque la plantilla no tiene requisitos, costos ni URL.

### 2.3 Lo que se queda sin backend
- **Conteos:** se calculan en el cliente.
- **Resumen de feedback:** sigue en mock hasta PPDT-5.15.
- **Organismo del usuario:** `getOrganismoDelUsuario` da `null` contra el backend real (G-2).
- **Catálogos del form:** pasan a los repositorios reales (UUID) en lugar de los servicios legacy.

---

## 3. Modelo de features

**Cuatro features (uno por recurso) y retirar `tramites`:**

```
core/features/
  plantillas/        ProcedureTemplate   FeatureKey 'plantillas'
  adopciones/        OrganismProcedure   FeatureKey 'adopciones'
  fichas-locales/    OTL + workflow      FeatureKey 'fichas-locales'
  puntos-atencion/   AttentionPoint      FeatureKey 'puntos-atencion'
```

**Por qué:**
- `provideDataSource` toma una sola `FeatureKey`. Separarlos permite pasar a real recurso por recurso: plantillas ya, fichas en mock hasta G-1.
- Las reglas de capas se cumplen sin excepciones. Todas las dependencias son Facade → Repository, cross-feature vía barrel:
  - `PlantillasFacade` → su repositorio y los de modalidades, categorías, etiquetas, destinatarios y eventos de vida.
  - `AdopcionesFacade` → su repositorio y los de plantillas, organismos (con `READ_ORGANISM`) y fichas-locales (conteo, cuando se cierre G-1).
  - `FichasLocalesFacade` → su repositorio y los de adopciones, plantillas, localidades y feedback (mock).
  - `PuntosAtencionFacade` → solo su repositorio.
- El panel de puntos de atención es un **componente hijo** con su propio facade (`@Input() fichaId`). Así la pantalla de la ficha no inyecta dos facades.

**Barrels:** exportar `XxxRepository` desde modalidades, categorías, etiquetas, destinatarios, eventos de vida y feedback, siguiendo el patrón ya aceptado de organismos y localidades. Vigilar un posible ciclo en madge entre adopciones y fichas-locales. Si aparece, el conteo de fichas por adopción se resuelve en la pantalla con `FichasLocalesFacade`.

**VMs:**
- `PlantillaVM` (con nombres resueltos).
- `AdopcionVM { …, vigente }`. `vigente` lo calcula el facade. Las fechas se mandan como `yyyy-MM-ddTHH:mm:ss` local, sin `Z`.
- `FichaLocalVM { id, adopcionId, localidadId, localidadNombre, plantillaTitulo, organismoNombre, slug, url, requisitos, costos, estado, activa, version }`. Los campos que dependen de G-1 son `| null`. El PUT siempre manda el estado **actual**, para mitigar R-1.
- `PuntoAtencionVM`. Se filtra en el cliente por `fichaId` y se cachea con `shareReplay(1)`.

**Infraestructura:**
- `FeatureKey` nuevas y overrides.
- `API_CODES`:
  - Agregar `ADOPTION_OVERLAP: 4080`.
  - Desde `58d383a` (BO-23): `PUBLICATION_TRANSITION_INVALID: 4077` (409, workflow de fichas) y
    `CONCURRENT_MODIFICATION: 4091` (409, edición concurrente).
  - Generalizar `4072`/`4073` como `ENTITY_CONFLICT`/`ENTITY_NOT_FOUND`: ya no son solo de taxonomía.
- Permisos `*_ADOPTION` y `*_ATTENTION_POINT`.
- Traducción de errores (`4080`, `4072` de plantilla, `5000` en fichas) con `aplicarErrorDeGuardado`.
- Escrituras con `sinDialogoGlobal()`.

---

## 4. Pantallas y flujos

### 4.1 Rutas (`/dashboard/tramites/…`)
| Ruta | Componente | Access |
|---|---|---|
| `plantillas` | lista | `READ_PROCEDURE` |
| `plantillas/nueva` · `plantillas/editar/:id` | form | `CREATE_PROCEDURE` · `UPDATE_PROCEDURE` |
| `plantillas/detalle/:id` | detalle | `READ_PROCEDURE` |
| `adopciones` | "Trámites del organismo" | `READ_ADOPTION` |
| `adopciones/detalle/:id` | vigencia + fichas por localidad | `READ_ADOPTION` |
| `fichas` | todas las fichas del alcance, con tab "En revisión" | `READ_VARIANT` |
| `fichas/nueva?adopcion=` | form | `CREAR_FICHA_ACCESS` = `CREATE_VARIANT` + `READ_ADOPTION` |
| `fichas/editar/:id` · `fichas/detalle/:id` | form · detalle con puntos de atención | `UPDATE_VARIANT` · `READ_VARIANT` |

- `ADOPTAR_ACCESS` = `CREATE_ADOPTION` + `READ_PROCEDURE` (el diálogo lista plantillas). Elegir organismo exige además `READ_ORGANISM`.
- **Nav:** "Plantillas provinciales" (`READ_PROCEDURE`), "Trámites del organismo" (`READ_ADOPTION`) y "Fichas por localidad" (`READ_VARIANT`). El badge "En revisión" solo se muestra con `PUBLISH_VARIANT`.
- **Comandos:** actualizar `comandos.constants.ts`.
- Las rutas viejas redirigen y se borran en la fase 5.

### 4.2 Flujos
- **SA / AB:**
  - Plantillas: lista, form (el slug se autogenera desde el título) y detalle con la pestaña "Organismos que la adoptaron".
  - "Desactivar" solo con `DELETE_PROCEDURE`.
  - **Se quita el panel "Contenido por localidad" del form de plantilla.**
- **AO:**
  - "Trámites del organismo": diálogo "Adoptar" (plantilla y vigencia), editar vigencia y deshabilitar.
  - En el detalle: grilla de fichas, "Agregar localidad", editor de ficha (localidad, slug sugerido `slugBase-localidad`, URL, requisitos, costos, activa) y el panel de puntos de atención debajo.
- **AGENT:** entra por "Fichas por localidad". Edita, gestiona puntos de atención y envía a revisión.
- **Quien publica (`PUBLISH_VARIANT`):** usa la bandeja "En revisión" para Publicar y Despublicar. "Devolver a borrador" no existe hasta que haya endpoint (G-4).
- **MANAGER:** solo lectura, por permisos.

**Botones por estado** (helper puro con test):

| Estado | Acciones |
|---|---|
| `BORRADOR` | Enviar a revisión |
| `EN_REVISION` | Publicar |
| `PUBLICADO` | Despublicar |
| `DESPUBLICADO` | Republicar |

**Avisos y validaciones:**
- Editar una ficha `PUBLICADO` cambia lo público en el momento (P-6), y hay que avisarlo.
- "Desactivar" una publicada la despublica, y hay que avisarlo.
- Validar duplicados de localidad y slug en el cliente.
- "Vista previa pública" solo para fichas `PUBLICADO`.

### 4.3 D-3 configurable
En `policy-overrides.constants.ts`:
```ts
export const PUBLICACION_POLICY = {
  aprobador: 'organismo' as 'organismo' | 'provincial', // solo textos
  permitirEnviarYPublicar: true,                         // atajo submit-review + publish
} as const;
```
- La habilitación siempre se decide por `PUBLISH_VARIANT`. Prohibido usar `requireRoles` en el workflow.
- Si producto cambia D-3, el seed reasigna el permiso y solo cambian los textos.

### 4.4 Puntos de atención
- Componente hijo dentro del detalle y la edición de la ficha.
- **Lista:** cards con toggle "Mostrar inactivos".
- **Alta y edición:** nombre, dirección, contacto, horarios, latitud y longitud, validadas en el cliente con hasta 6 decimales.
- **Desactivar:** con confirmación.
- **Gating:** por `*_ATTENTION_POINT`.
- Sin mapa: opcionalmente un link "Ver en mapa" a OpenStreetMap.

---

## 5. Fases
Cada fase cierra con `ng build`, `lint`, `check:circular`, tests de mappers y prueba manual con SA, AB, AO y AGENT. Todos los features llevan su mock en memoria con la forma real.

| Fase | Contenido | Real o mock | Depende de |
|---|---|---|---|
| **0 · Preparación** | Verificar R-3; abrir G-1 a G-6 al backend; `FeatureKey`, permisos, `API_CODES`, exports de repositorios | — | — |
| **1 · Plantillas** | Feature `plantillas` + lista, form y detalle; nav, rutas y comandos | **real** | R-3 no afecta (`*_PROCEDURE` ya existían) |
| **2 · Adopciones** | Feature `adopciones` + lista, detalle y diálogo "Adoptar" (datepicker es-AR) | **real para SA** | R-3 (`*_ADOPTION`), G-2/G-3 para AO |
| **3 · Fichas + workflow** | Feature `fichas-locales` + lista, form, detalle, bandeja, badge de cuatro estados | **mock**, también en prod; el HTTP se escribe pero no se activa | **G-1** y G-4 |
| **4 · Puntos de atención** | Feature `puntos-atencion` + panel hijo | mock mientras las fichas sean mock (no mezclar ids) | R-3, fase 3 |
| **5 · Limpieza** | Borrar `tramites`, `tramite.service`, `tramite.model`, rutas mock, config `TRAMITE`, servicios legacy huérfanos; docs (`BACKEND_API_SPEC` §5.5, `migracion_arquitectura` §12, `CLAUDE.md` "Workflow de Trámites") | — | fases 1 a 4 |

---

## 6. Riesgos
- **R-1:** ~~el `PUT` de la ficha acepta `publicationStatus`~~ ✅ resuelto (`58d383a`, en staging): el `PUT` ya no aplica el estado. El front sigue mandando el estado actual (inofensivo). El `PUT` sin `active` → 500 se cerró en `586b670` (400 `4012`; en staging desde el 2026-11-19).
- **R-2:** ~~casi todos los errores de las fichas llegan como 500 `5000`~~ mitigado en `dev`: "no existe" → 404 `4073`, transición inválida → 409 `4077`. Quedan en 500 los casos de §1.1.
- **R-3:** ✅ resuelto (`V2.28` + `V2.30`, ver §0), en staging desde el 2026-11-16.
- **R-4:** ~~sin UNIQUE de `(adopción, localidad)` ni de slug~~ hay constraints desde `V2.27`, pero sin validación previa (500) y el slug no es único global (G-9).
- **R-5:** no hay cascada de vigencia hacia las fichas publicadas. Desde `586b670` el portal las filtra por vigencia, pero en el backoffice siguen `PUBLICADO` y su `PUT` responde 404 `4073` (G-27).
- **R-8 (nuevo, 2026-11-19):** el front de `feat/alinear-backend-586b670` asume el response completo de la ficha. Desplegado contra un backend anterior a `3797fe7`, el form de edición recibiría la ficha sin contenido y lo borraría al guardar; por eso el front detecta ese caso (`sinContenido`), avisa y no deja editar. El front requiere backend >= `586b670`: **mitigado el 2026-11-19**, staging ya lo tiene (`origin/staging` @ `0a555df`).
- **R-6:** listados completos en el cliente. Con mucho volumen va a hacer falta paginación.
- **R-7:** hay mucho trabajo sin commitear en `feat/abm-secciones`. Conviene commitearlo antes de la fase 1.

---

## 7. Preguntas abiertas

**Al backend:**
- **G-1 ✅ (`586b670`; faltan los nombres):** el response de la ficha tiene que traer `organismProcedureId`, `locationId`, `url`, `requirements` y `costs`, idealmente también los nombres de plantilla, organismo y localidad. Y un filtro `?organismProcedureId=`.
- **G-2 ✅ (`586b670`):** el organismo del usuario llega en `/api/auth/me` (`scope`, `organismId`, `organismName`, `organismAcronym`). Destraba que AO adopte y BO-20 (etiquetas locales).
- **G-3 🟠:** ~~AO no tiene `READ_PROCEDURE`~~ (✅ `V2.31`); AGENT tiene `READ_ADOPTION` (`V2.28`) pero sigue sin `READ_PROCEDURE`, y AB sin `READ_ORGANISM`.
- **G-4:**
  - ~~Las transiciones inválidas tendrían que responder 4xx con código propio, no 500.~~ ✅ 409 `4077` en `dev`.
  - Faltan endpoints para `EN_REVISION → BORRADOR` (rechazar, con motivo) y para `DESPUBLICADO → BORRADOR`.
  - ~~El PUT no debería aceptar `publicationStatus`.~~ ✅ en `dev` (R-1).
- **G-5 (D-3):** ¿está resuelta o abierta? ¿Qué es una "ficha provincial"? AB no tiene `PUBLISH_VARIANT` ni `READ_VARIANT`.
- **G-6 ✅:** ~~el `4080` no tiene mensaje~~ y ~~el `4072` responde 400 y no 409~~ (409 desde `586b670`).
- **G-7 🟠:** paginación y filtros de listados (D-6). En `586b670` salieron los filtros de fichas por adopción y de puntos por ficha.
- **G-8:** endpoint de versiones (`otl_versions`, FR-BACKOFFICE-07) y `lockVersion` en el contrato (hoy el `4091` no se puede disparar entre dos ediciones sucesivas).
- **G-9:** ~~unicidad de `(adopción, localidad)` y slug de ficha~~ (constraints en `V2.27`); falta la validación previa (409 en vez de 500), el slug único global y la cascada de vigencia (el filtro de vigencia en el portal salió en `586b670`).
- **R-3:** ~~migración correctiva de los grants de `V2.20`, `V2.23` y `V2.24`~~ ✅ `V2.28` + `V2.30` en `dev`.
- **G-24 (nuevo, 2026-11-16):** AGENT puede deshabilitar adopciones por `PUT` y despublicar fichas por `DELETE`; ¿es intencional?
- **G-27 (nuevo, 2026-11-19):** una adopción no vigente responde 404 `4073` al crear **o editar** sus fichas. ¿Código propio? ¿Se pueden preparar fichas en `BORRADOR` antes del inicio de vigencia?
- **G-29 (nuevo, 2026-11-19):** el filtro de puntos de atención por ficha devuelve solo activos; ¿cómo se listan los inactivos de una ficha?
- **G-28 (nuevo, a confirmar):** `slugBase` que se canonicaliza a vacío y plantillas previas sin recanonicalizar.

**A producto o al usuario:**
- **P-1:** nombres en la UI ("Plantilla provincial", "Trámite del organismo", "Ficha por localidad").
- **P-2:** mientras G-2 esté abierto, ¿se oculta "Adoptar" a AO?
- **P-3:** ¿"Enviar y publicar" para quien tiene los dos permisos?
- **P-4:** ¿hay que ver o reactivar plantillas y adopciones inactivas? Requiere `?includeInactive` en el backend.
- **P-5:** el slug de la ficha, ¿sugerido y editable, o fijo?
- **P-6:** editar una ficha publicada cambia lo público en el momento. ¿Se acepta?
- **P-7:** el feedback por ficha, mientras siga en mock, ¿se muestra con aviso de "datos de ejemplo" o se oculta?
- **P-8:** puntos de atención, ¿lat/long manuales o selector en mapa?

---

## 8. Decisiones tomadas (2026-10-13)

Las tomé siguiendo los criterios del proyecto: alinear la UI al contrato real, no mostrar datos falsos, autorizar por
permiso y no por rol, y no ofrecer acciones que el backend va a rechazar. Las que dependen del backend están en
`PEDIDOS_BACKEND.md`.

| # | Decisión | Por qué |
|---|---|---|
| P-1 | Nombres en la UI: **"Plantillas provinciales"**, **"Trámites del organismo"** (la adopción) y **"Fichas por localidad"**. En el nav quedan bajo una sección "Trámites" | Son términos del dominio y no términos técnicos ("adopción", "OTL"). El título de cada pantalla empieza con verbo en infinitivo cuando es una acción ("Adoptar trámite", "Agregar localidad") |
| P-2 | **"Adoptar" se oculta** a quien no puede elegir organismo (sin `READ_ORGANISM`) hasta que el backend resuelva G-2 | No se ofrece una acción que el backend va a rechazar. SA adopta para cualquier organismo |
| P-3 | **Sin atajo "Enviar y publicar"** (`PUBLICACION_POLICY.permitirEnviarYPublicar = false`, `aprobador = 'organismo'`) | El workflow queda explícito mientras D-3 está abierta. Habilitarlo es un cambio de config |
| P-4 | **No se muestran plantillas ni adopciones inactivas** | El backend no las lista. Se pide `?includeInactive` (G-7); mientras tanto la UI no promete reactivar |
| P-5 | Slug de la ficha **sugerido** (`slugBase-slugLocalidad`, con `canonicalizarSlug`) y **editable** | Es el patrón de etiquetas y plantillas. Se valida en el cliente que no esté repetido en la lista visible (mitiga G-9) |
| P-6 | **Se acepta** que editar una ficha `PUBLICADO` cambie lo público al guardar, con un aviso visible en el form ("Los cambios se verán en el portal al guardar") | Es el comportamiento real del backend. Devolver a revisión requiere backend (G-4) |
| P-7 | **El resumen de feedback por ficha se oculta** hasta que exista la API (PPDT-5.15) | No mostrar datos de ejemplo como si fueran reales |
| P-8 | Puntos de atención con **lat/long manuales** (validación de rango y hasta 6 decimales) y un link **"Ver en mapa"** (OpenStreetMap) | Está en el alcance de PPDT-5.7 y no suma dependencias |

**Decisiones técnicas que acompañan el plan:**
- Fichas y puntos de atención se implementan completos (mock y HTTP), pero corren en **mock** (`featureOverrides`)
  hasta que se cierre G-1. Se activan juntos, para no mezclar ids reales con ids mock. *(2026-11-19: G-1 cerró en
  `586b670`; se activaron en staging y prod, ver §9.)*
- El PUT de la ficha manda siempre el `publicationStatus` **actual**. El estado solo cambia con los endpoints de
  workflow (mitiga R-1).
- Los errores `5000` de fichas se muestran con un texto prudente ("Puede que la ficha haya cambiado de estado;
  recargá e intentá de nuevo").

---

## 9. Estado de implementación (2026-10-13)

| Fase | Commit | Fuente | Qué quedó | Pendiente |
|---|---|---|---|---|
| **0 · Preparación** | `c194f43` | — | `FeatureKey`, permisos, `API_CODES`, pedidos G-1 a G-12 y R-3 en `PEDIDOS_BACKEND.md` | Respuestas del backend |
| **1 · Plantillas** | `c194f43` | **real** | Feature `plantillas` (`/api/procedure-template`): lista, form, detalle, nav, rutas y comando "Crear plantilla" | ~~G-10, G-6~~ ✅ en `586b670`; P-4 (`?includeInactive`), G-28 |
| **2 · Adopciones** | `4d8f34c` | **real** en staging y prod (desde OPS-1, 2026-11-16) | Feature `adopciones` (`/api/organism-procedure`): lista, detalle con vigencia, diálogo "Adoptar" (es-AR); "Adoptar" con `READ_ORGANISM` o con organismo en la sesión (P-2, G-2) | ~~Deploy de `586b670` para que AO adopte (G-2 + `V2.31`)~~ ✅ 2026-11-19; G-3 (AB sin `READ_ORGANISM`), G-11 |
| **3 · Fichas + workflow** | `bbb3b52` | **real** en staging y prod (rama `feat/alinear-backend-586b670`) | Feature `fichas-locales` (`/api/organism-procedure-location`): lista con tab "En revisión", form, detalle, badge de cuatro estados, workflow por `PUBLISH_VARIANT`; PUT con el estado actual (R-1); filtro `?organismProcedureId=` | ~~Deploy de `586b670` en staging~~ ✅ 2026-11-19 (OPS-1 cumplido de nuevo); G-4 (rechazar / volver a borrador), G-5 (D-3), G-9, G-12, G-27 |
| **4 · Puntos de atención** | `bbb3b52` | **real** en staging y prod, junto con fichas | Feature `puntos-atencion` (`/api/attention-point`): panel en el detalle de la ficha, diálogo con lat/long y "Ver en mapa" (P-8); filtro `?organismProcedureLocationId=` | ~~Deploy de `586b670`~~ ✅ 2026-11-19; G-29 (el filtro no trae los inactivos) |
| **5 · Limpieza** | sin commitear | — | Retirados `core/features/tramites`, pantallas `pages/tramites/{list,create,detail}`, `tramite.service`/`tramite.model`/`dashboard.model`, servicios legacy huérfanos (`categoria`, `destinatario`, `evento-de-vida`, `organismo`, `localidad`, `feedback`), rutas del `mockApiInterceptor` salvo `/api/usuarios`, config `TRAMITE` + campo `icon-picker`, ítem de nav y comando viejos, `FeatureKey 'tramites'`. Rutas viejas → redirect a `tramites/plantillas`. Etiquetas mock con semilla propia. Docs actualizados (`BACKEND_API_SPEC` §5.5, `migracion_arquitectura` §12, `CLAUDE.md`, backlog, QA §14). Bundle inicial 897 → **837 kB** (sin warnings; providers importados directo en `app.config.ts`, ver comentario) | — |

**Estado de las fuentes al 2026-11-19** (`backoffice/src/environments/*.ts`, rama `feat/alinear-backend-586b670`): la
cadena plantilla → adopción → ficha → punto se referencia por ids y va toda con la misma fuente.

| Entorno | Cadena de trámites | Etiquetas | Dashboard, auditoría, feedback |
|---|---|---|---|
| `ng serve` (`environment.ts`) | mock | real | mock |
| `npm run start:local` (`environment.local.ts`, backend `dev` en Docker) | real | real | mock |
| staging (`environment.staging.ts`) y prod (`environment.prod.ts`) | real (plantillas y adopciones desde el 2026-11-16; fichas y puntos desde esta rama) | real | mock |

**Condición del pase de fichas y puntos a real:** requiere backend >= `586b670`, **en staging desde el
2026-11-19** (`origin/staging` @ `0a555df`; OPS-1 cumplido de nuevo en `PEDIDOS_BACKEND.md`; verificado el esquema de
`/api-docs`, flujos sin ejecutar). Contra un backend anterior el response de la ficha llega incompleto (R-8). Dashboard,
auditoría y feedback siguen en mock porque no tienen endpoint (PPDT-5.13, 5.21 y 5.15).
