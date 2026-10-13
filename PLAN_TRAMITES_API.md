# Plan — Trámites contra la API real (BO-15 + BO-19)

Fecha: 2026-10-13 · Backend leído desde `origin/dev` @ `23fd8f9` · Front: working tree de `feat/abm-secciones`.
Estado: **propuesta para revisar**. No hay código escrito.

---

## 0. Resumen

1. **El backend no tiene una entidad "trámite".** Tiene cuatro recursos encadenados:
   - **Plantilla provincial** (`/api/procedure-template`).
   - **Adopción por organismo, con vigencia** (`/api/organism-procedure`).
   - **Ficha por localidad** (`/api/organism-procedure-location`, "OTL"). Tiene el estado de publicación, los requisitos, los costos y la URL.
   - **Puntos de atención** (`/api/attention-point`), que cuelgan de la ficha.

   El mock actual (`TramiteVM` con organismo, estado y "contenido por localidad" que hereda lo provincial) no tiene esta forma, así que es una **reestructura**.
2. **Plantillas y puntos de atención se pueden integrar ya.** Adopciones se puede integrar para SA; para AO hay un bloqueo (G-2).
3. **Las fichas por localidad están bloqueadas por el contrato (G-1).** El response devuelve solo `id, slug, publicationStatus, active, currentVersionNumber`. Como el `PUT` reemplaza todo, editar una ficha borraría requisitos, costos y URL.
4. **D-3 (quién aprueba la publicación):** en el código depende solo del permiso `PUBLISH_VARIANT`. Si el front decide todo por permiso y nunca por rol, D-3 se puede cambiar desde el seed. Solo hay que dejar configurables los textos.

> ⚠️ **R-3 confirmado en el código (bloquea Etiquetas reales hoy):**
> - `V0.0` sembró los roles como `ROLE_SUPERADMIN`, … y `V0.4__normalize_role_codes.sql` les quitó el prefijo. Los códigos actuales son `SUPERADMIN`, `ADMIN_BACKOFFICE`, …
> - `V2.16` y `V2.17` filtran por las dos formas, pero `V2.20` (`*_ADOPTION`), `V2.23` (`*_ATTENTION_POINT`) y `V2.24` (`*_TAG`) filtran solo por `'ROLE_…'`.
> - Lo más probable es que **ningún rol haya recibido esos permisos**. Consecuencias:
>   - Etiquetas (BO-16, ya conectada a `/api/tag` y gateada por `READ_TAG`) **desaparece del menú incluso para SUPERADMIN**.
>   - Adopciones y Puntos de atención responden 403.
> - Verificar en la base: `SELECT r.code, p.code FROM role_permissions rp JOIN roles r ON r.id = rp.role_id JOIN permissions p ON p.id = rp.permission_id WHERE p.code LIKE '%\_TAG' ESCAPE '\';`
> - Fix del backend: una migración nueva que asigne por `UPPER(code) IN ('SUPERADMIN','ROLE_SUPERADMIN', …)`, igual que `V2.16` y `V2.17`.

---

## 1. Contrato real

### 1.1 Convenciones comunes
- **Éxito:** `ResponseDTO<T> = { code, details, data }`. Códigos 2001 (creado), 2002 (actualizado), 2003 (borrado lógico) y 2013 (consulta).
- **Error:** `MessageDTO { code, message, details }`.
  - Validación → 400, código `4012`. En `details` viene `"campo: mensaje; ..."`.
  - Sin permiso → 403. Sin token → 401, código `4025`.
  - Usuario sin asignación vigente o rol de organismo sin organismo → 403, código `4029`.
  - **`IllegalArgumentException` o error de base de datos → 500, código `5000`.** Esto le pasa a casi todos los errores de las fichas.
- **Listados:** ningún endpoint de estos cuatro controllers pagina, ordena ni filtra. Devuelven `List<T>` completa dentro del alcance; todo eso se hace en el cliente.
- **Alcance (`OrganismScope`, `545fffa`):**
  - Rol de la asignación vigente con `scope_type=global` (SA, AB, MANAGER) → global.
  - Con `organismo` (AO, AGENT) → el organismo de la asignación.
  - **El organismo del usuario no viaja en el JWT ni en `/api/auth/me`**. `auth.service.ts` lee `payload.organismoId`, que el backend no emite, así que `getUserOrganismoId()` siempre devuelve `null` contra el backend real.

### 1.2 `/api/procedure-template` — plantilla provincial (alcance global)
| Método | Ruta | Permiso | Notas |
|---|---|---|---|
| GET | `/` | `READ_PROCEDURE` | **solo `active=true`** |
| GET | `/{id}` | `READ_PROCEDURE` | también inactivas |
| POST | `/` | `CREATE_PROCEDURE` | 201 |
| PUT | `/{id}` | `UPDATE_PROCEDURE` | reemplazo total, incluidos los puentes |
| DELETE | `/{id}` | `DELETE_PROCEDURE` | pone `active=false` |

- **Request:** `slugBase*` (único), `titleBase*` (máximo 255), `shortDescription?`, `longDescription?`, `modalityId?`, `mainCategoryId?`, `categoryIds?`, `tagIds?`, `lifeEventIds?`, `recipientIds?`, `active*`.
- **Response:** los mismos campos más `id`. **Solo ids, sin nombres ni fechas.**
- **Errores:** `4072` (400, slug en uso), `4073` (404, plantilla o algún id inexistente), `4012`.
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
  - No puede haber dos adopciones habilitadas de la misma plantilla en el mismo organismo con vigencias solapadas → **409 `4080`**. El código no tiene mensaje en `messages.properties`, así que llega `"response.code.4080"` y el front tiene que traducirlo.
- **Pendiente en el backend:** deshabilitar o vencer una adopción **no despublica sus fichas**, y la búsqueda pública no filtra por vigencia.

### 1.4 `/api/organism-procedure-location` — ficha por localidad (OTL)
| Método | Ruta | Permiso | Acción |
|---|---|---|---|
| GET | `/` | `READ_VARIANT` | global: todas; organismo: las suyas |
| GET | `/{id}` | `READ_VARIANT` | |
| POST | `/` | `CREATE_VARIANT` | siempre en `BORRADOR` (ignora el estado enviado); versión 1 |
| PUT | `/{id}` | `UPDATE_VARIANT` | reemplazo total, **incluido `publicationStatus`** (R-1); versión N+1 |
| POST | `/{id}/submit-review` | `UPDATE_VARIANT` | → `EN_REVISION` |
| POST | `/{id}/publish` | `PUBLISH_VARIANT` | → `PUBLICADO` |
| POST | `/{id}/unpublish` | `PUBLISH_VARIANT` | → `DESPUBLICADO` |
| DELETE | `/{id}` | **`UPDATE_VARIANT`** | pone `active=false`; si estaba publicada → `DESPUBLICADO` |

- **Request** (sin validaciones en el DTO): `organismProcedureId, locationId, slug, url, requirements, costs, publicationStatus, active`. Si falta algún campo NOT NULL, responde **500**.
- **Response:** `id, slug, publicationStatus, active, currentVersionNumber`. **Nada más** (G-1).
- **Transiciones permitidas.** Las inválidas responden **500 `5000`**:

| Estado | `submit-review` | `publish` | `unpublish` | Sin endpoint |
|---|---|---|---|---|
| `BORRADOR` | → `EN_REVISION` | ✗ | → `DESPUBLICADO` | — |
| `EN_REVISION` | ✗ | → `PUBLICADO` | ✗ | → `BORRADOR` (rechazar) |
| `PUBLICADO` | ✗ | ✗ | → `DESPUBLICADO` | — |
| `DESPUBLICADO` | ✗ | → `PUBLICADO` (sin revisión) | ✗ | → `BORRADOR` |

- **Versionado:** `otl_versions` sin endpoint de lectura. Sin control de concurrencia: la última escritura gana.
- **Sin unicidad:** no hay UNIQUE de `(adopción, localidad)` ni de slug. Puede haber fichas duplicadas, y dos fichas publicadas con el mismo slug rompen el detalle público.

### 1.5 `/api/attention-point` — puntos de atención
| Método | Ruta | Permiso | Notas |
|---|---|---|---|
| GET | `/` | `READ_ATTENTION_POINT` | todos los del alcance, activos e inactivos; **sin filtro por ficha** |
| GET | `/{id}` | `READ_ATTENTION_POINT` | |
| POST | `/` | `CREATE_ATTENTION_POINT` | |
| PUT | `/{id}` | `UPDATE_ATTENTION_POINT` | reemplazo total |
| DELETE | `/{id}` | `DELETE_ATTENTION_POINT` | pone `active=false` |

- **Request:** `organismProcedureLocationId*`, `name*`, `address*`, `contactInfo?`, `openingHours?`, `latitude*`, `longitude*` (`NUMERIC(9,6)`), `active*`.
- **Errores:**
  - `4012`: latitud fuera de [-90, 90] o longitud fuera de [-180, 180].
  - `4073`: la ficha o el punto no existe o está fuera del alcance.

### 1.6 Permisos por rol según el seed (si R-3 se corrige)
| Permiso | SA | AB | AO | AGENT | MANAGER |
|---|---|---|---|---|---|
| `READ_PROCEDURE` | ✓ | ✓ | **✗** | ✗ | ✓ |
| `CREATE/UPDATE_PROCEDURE` | ✓ | ✓ | ✗ | ✗ | ✗ |
| `DELETE_PROCEDURE` | ✓ | **✗** | ✗ | ✗ | ✗ |
| `*_ADOPTION` | ✓ | ✓ | ✓ | **✗** | ✗ |
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
- **AO:**
  - Adopta y gestiona fichas, las publica y gestiona puntos de atención, todo dentro de su organismo.
  - **No puede listar plantillas** (G-3).
- **AGENT:**
  - Edita fichas existentes, las envía a revisión y gestiona puntos de atención.
  - No crea fichas.
  - No sabe de qué trámite es cada ficha (G-1/G-3).
- **MANAGER:** solo lectura.

### 1.7 Endpoints públicos útiles
`GET /api/procedure/{slug}` devuelve la ficha publicada completa, con los nombres de organismo, localidad, categoría y modalidad y los puntos de atención. Sirve para la "Vista previa pública" de fichas `PUBLICADO`.

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
- **R-1:** el `PUT` de la ficha acepta `publicationStatus`, así que un AGENT puede publicar sin pasar por el workflow. El front lo mitiga mandando el estado actual. **Hay que reportarlo como bug del backend.**
- **R-2:** casi todos los errores de las fichas llegan como 500 `5000`. Los textos del front tienen que ser prudentes.
- **R-3:** probable que no se hayan asignado `*_TAG`, `*_ADOPTION` ni `*_ATTENTION_POINT` (ver §0).
- **R-4:** sin UNIQUE de `(adopción, localidad)` ni de slug.
- **R-5:** no hay cascada de vigencia hacia las fichas publicadas.
- **R-6:** listados completos en el cliente. Con mucho volumen va a hacer falta paginación.
- **R-7:** hay mucho trabajo sin commitear en `feat/abm-secciones`. Conviene commitearlo antes de la fase 1.

---

## 7. Preguntas abiertas

**Al backend:**
- **G-1 (bloqueante, fase 3):** el response de la ficha tiene que traer `organismProcedureId`, `locationId`, `url`, `requirements` y `costs`, idealmente también los nombres de plantilla, organismo y localidad. Y un filtro `?organismProcedureId=`.
- **G-2:** el organismo del usuario. Agregarlo a `/api/auth/me`, o que el backend tome el del alcance e ignore el del request. Bloquea que AO adopte. También resuelve BO-20 (etiquetas locales).
- **G-3:** AO no tiene `READ_PROCEDURE`, y AGENT no tiene `READ_ADOPTION`/`READ_PROCEDURE`. ¿Se agregan en el seed?
- **G-4:**
  - Las transiciones inválidas tendrían que responder 4xx con código propio, no 500.
  - Faltan endpoints para `EN_REVISION → BORRADOR` (rechazar, con motivo) y para `DESPUBLICADO → BORRADOR`.
  - El PUT no debería aceptar `publicationStatus`.
- **G-5 (D-3):** ¿está resuelta o abierta? ¿Qué es una "ficha provincial"? AB no tiene `PUBLISH_VARIANT` ni `READ_VARIANT`.
- **G-6:** el `4080` no tiene mensaje, y el `4072` de plantilla responde 400 y no 409.
- **G-7:** paginación y filtros de listados (D-6).
- **G-8:** endpoint de versiones (`otl_versions`, FR-BACKOFFICE-07).
- **G-9:** unicidad de `(adopción, localidad)` y slug de ficha; cascada de vigencia.
- **R-3:** migración correctiva de los grants de `V2.20`, `V2.23` y `V2.24`.

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
  hasta que se cierre G-1. Se activan juntos, para no mezclar ids reales con ids mock.
- El PUT de la ficha manda siempre el `publicationStatus` **actual**. El estado solo cambia con los endpoints de
  workflow (mitiga R-1).
- Los errores `5000` de fichas se muestran con un texto prudente ("Puede que la ficha haya cambiado de estado;
  recargá e intentá de nuevo").
