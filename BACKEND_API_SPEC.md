# Especificación de Integración — Backend Portal Trámite Misiones

> **Propósito de este documento.** Es la especificación completa del contrato REST del backend
> (`PortalMisiones-backend`, Spring Boot + Java 17) para que un agente/desarrollador frontend pueda
> **implementar el consumo de cada endpoint** desde las apps **backoffice (Angular 17)** y **portal (Next.js/React)**.
> Cada endpoint incluye método, ruta, autenticación, request/response y errores. Los schemas de entidad
> sirven para derivar las interfaces TypeScript (`core/models` en Angular, `models/` en cada proyecto).
>
> **Fuente:** generado leyendo el código del backend (controllers, DTOs, entities, `SecurityConfig`,
> `GlobalExceptionHandler`, migraciones SQL). **Sincronizado con el commit `d800be0` (dev, 2026-07-29).**
> Última actualización: 2026-07-29.
>
> **🔥 Novedades de esta revisión (`0ecd14e` → `d800be0`) — CAMBIO ESTRUCTURAL DE AUTORIZACIÓN:**
> 1. **💥 Migración de RBAC por ROL a RBAC por PERMISO.** La mayoría de los `@PreAuthorize` pasaron de
>    `hasAnyRole('SUPERADMIN','ADMIN_BACKOFFICE')` a `hasAuthority('<PERMISO>')` (§4.2, §5, §6.2).
> 2. **💥 Catálogo de permisos normalizado a inglés y ampliado** (migración `V2.9`): `CREATE_ORGANISMO`→`CREATE_ORGANISM`,
>    `CREATE_USUARIO`→`CREATE_USER`, `CREATE_ROL`→`CREATE_ROLE`, `CREATE_TRAMITE`→`CREATE_PROCEDURE`, etc.
>    **Si el front tenía hardcodeados los códigos viejos en español, dejan de existir** (§4.2).
> 3. **💥 El JWT ahora emite `roles` y `permissions` como dos claims separados (arrays)** en lugar de un único string
>    de authorities separado por comas. El refresh token **ya no lleva claim de authorities** (§1.2).
> 4. **🆕 `GET /api/auth/me`** — devuelve `{ userId, email, roles[], permissions[] }` del usuario autenticado (§2).
>    Es la fuente recomendada para armar el RBAC del front (no decodificar el JWT a mano).
> 5. **🆕 `ADMIN_BACKOFFICE` puede gestionar roles y permisos** (`/api/role`, `/api/permission`), salvo tocar el rol
>    `SUPERADMIN` (403 `4029`). `RoleResponseDTO` ahora expone `active`, y `active` es **obligatorio en el PUT** (§4).
> 6. **Organismo:** el acrónimo ahora es único **globalmente** (antes solo entre activos) → 409 `4069` (§5.2).
> 7. **Tag rediseñada** (`V2.8`): `{ id, organism, slug, local }` — *(controller expuesto luego en `84fde37`, §5.5/§7.0.2)*.
>
> **Novedades de la revisión previa (`ea65b92` → `0ecd14e`):** nuevo catálogo **Recipients** (`/api/recipient`, §5.4);
> **LifeEvent pasó a soft-delete** (§5.3); el **bug 403→500 fue corregido** (§7); los usuarios creados por admin
> quedan **activos al instante** (§3); nuevo código de error `4076`.

---

## 0. Cómo usar este documento

1. Leé primero **§1 Convenciones y Seguridad** — define los envelopes de respuesta (`ResponseDTO`/`MessageDTO`),
   el formato de errores, el header de auth y qué endpoints son públicos. Todo lo demás depende de eso.
2. Por cada endpoint que implementes, mapeá: ruta + método → servicio Angular; request DTO → interface;
   response (resolviendo el wrapper) → interface; errores → manejo en `http-error.service` / interceptor.
3. Revisá **§7 Discrepancias y pendientes** ANTES de codear: hay diferencias entre lo que asume el
   `CLAUDE.md` del frontend y lo que el backend realmente expone (roles, endpoints de trámites inexistentes, etc.).
4. **§8 Checklist** resume el orden de implementación recomendado.

### Entorno (dev)
- **Backend base URL (dev):** `http://localhost:8080` (puerto = env `PORT_SERVICE`, default usado 8080).
- **Sin context-path**: las rutas son las de cada controller (`/api/auth/...`, `/api/user/...`, etc.).
- **Swagger UI:** `http://localhost:8080/swagger-ui.html` · **OpenAPI JSON:** `/api-docs` · **Health:** `/actuator/health`
- **CORS dev:** orígenes permitidos `http://localhost:4200` (backoffice) y `http://localhost:3000` (portal).
- **MailHog (mails de dev):** `http://localhost:8025`.

### Índice
- [1. Convenciones y Seguridad](#1-convenciones-y-seguridad)
- [2. Autenticación](#2-autenticación)
- [3. Usuarios](#3-usuarios)
- [4. Roles y Permisos](#4-roles-y-permisos)
- [5. Dominio de Negocio (Geografía · Organismos · Taxonomía · Trámites)](#5-dominio-de-negocio-geografía--organismos--taxonomía--trámites)
  - 5.1 Departamentos y Localidades (reemplaza Municipios)
  - 5.2 Organismos y Tipos de Organismo
  - 5.3 Taxonomía: Categorías, Modalidades y Eventos de Vida
  - 5.4 Destinatarios (Recipients)
  - 5.5 Trámites y Etiquetas — API real
- [6. Email, Almacenamiento y reCAPTCHA](#6-email-almacenamiento-y-recaptcha)
- [7. Discrepancias y pendientes (LEER)](#7-discrepancias-y-pendientes-leer)
- [8. Checklist de integración frontend](#8-checklist-de-integración-frontend)

---

## 1. Convenciones y Seguridad

### 1.1 Rutas de infraestructura
- **Puerto**: `server.port=${PORT_SERVICE}` (dev = 8080). Sin `context-path`.
- **OpenAPI / Swagger**: spec en `GET /api-docs` (y `/api-docs.yml`); UI en `GET /swagger-ui.html`.
- **Actuator health**: `GET /actuator/health` (con detalles; incluye `db`, `mail`, `ssl`, `diskSpace`).

### 1.2 Modelo de autenticación (JWT)

> 💥 **CAMBIO `d800be0`:** el claim único de authorities (string separado por comas, configurado por
> `jwt.authorities.key`) **fue eliminado**. Ahora hay **dos claims, ambos arrays de strings**: `roles` y `permissions`.
> La property `jwt.authorities.key` ya no existe en `application-*.properties`.

- **Emisión** (en `POST /api/auth/login` y `POST /api/auth/activate-account`):
  - **Access token**: JWT firmado **HS512**. Claims:
    - `sub` = email
    - **`roles`**: `string[]` con las autoridades que empiezan con `ROLE_` — ej. `["ROLE_SUPERADMIN"]`
    - **`permissions`**: `string[]` con el resto de autoridades (los códigos de permiso) — ej. `["CREATE_USER","READ_USER"]`
    - `userId` = UUID · `iat` · `exp`
  - **Refresh token**: JWT HS512 con `jti` (UUID aleatorio), `sub`, `userId`, `iat`, `exp`.
    **Ya NO lleva claims de roles/permisos.**

```json
// payload del access token (decodificado)
{
  "sub": "admin@mail.com",
  "roles": ["ROLE_SUPERADMIN"],
  "permissions": ["CREATE_USER", "READ_USER", "UPDATE_USER", "DELETE_USER", "READ_ORGANISM", "..."],
  "userId": "3f2a...-uuid",
  "iat": 1753800000,
  "exp": 1753803600
}
```

> ⚠️ **El backend NO autoriza usando los claims del token.** En cada request el `JWTAuthenticationFilter` valida
> la firma y **recarga las authorities desde la base** (`CustomeUserDetails.buildAuthorities`), filtrando
> asignaciones de rol vigentes (`effectiveFrom`/`effectiveTo`), roles activos y permisos activos.
> Consecuencia para el front: **cambiar los permisos de un rol impacta de inmediato**, sin re-login, aunque el JWT
> viejo siga mostrando la lista anterior. Por eso conviene leer el estado real desde **`GET /api/auth/me`** (§2)
> en vez de decodificar el token.

**Cómo se arman las authorities** (referencia): por cada asignación de rol vigente y con `role.active=true` se agrega
`ROLE_<code>` (el code se normaliza a mayúsculas y se le quita el prefijo `ROLE_` si ya lo trae), y además **el `code`
de cada permiso activo de ese rol, tal cual** (sin prefijo). De ahí que `hasRole('X')` mire `ROLE_X` y
`hasAuthority('CREATE_USER')` mire el permiso literal.

- **Header de autorización**: `Authorization: Bearer <accessToken>`. (`Authorization` está expuesto en CORS.)
- **Expiraciones**:
  - Access: env `JWT_EXPIRATION` (ms).
  - Refresh: default **604800000 ms = 7 días** (`app.jwt-refresh-expiration-milliseconds`).
  - Token de activación de cuenta: env `ACCOUNT_TOKEN_EXPIRATION`.
- **Mecanismo de refresh** (`POST /api/auth/refresh`): los refresh tokens se persisten en tabla
  `refresh_token_sessions` (`jti` único, `tokenHash`=SHA-256 hex del token, `expiresAt`, `revoked`,
  `replacedByToken`, `ipAddress`, `userAgent`). **Rotación**: al refrescar se valida la sesión por `jti`
  (firma OK, no revocada, no expirada, hash coincide), se emite un nuevo par access+refresh, se crea
  nueva sesión y la anterior queda `revoked=true`. El refresh anterior **deja de ser válido**.
  Refresh inválido/expirado → 401 code `4064`.

> **Implicación para el frontend:** guardar ambos tokens. En 401 por access expirado, llamar a
> `/api/auth/refresh` con el refresh actual y **reemplazar AMBOS** tokens con la respuesta (rotación).
> Si el refresh falla → logout. El interceptor de auth de Angular debe contemplar esta rotación.

### 1.3 Endpoints públicos vs autenticados (matchers exactos de `SecurityConfig`)
`OPTIONS *` → `permitAll` (preflight CORS).

**PÚBLICOS (`permitAll`)** — sin cambios en `d800be0`:
```
/api-docs.yml  /api-docs/**  /actuator/health
/configuration/ui  /configuration/**  /swagger-resources/**  /swagger-ui/**  /webjars/**
/api/auth/**  /api/auth/register
/api/email/activate-account/{token}  /api/email/**
/api/recaptcha/**
/projects/**  /drafts/**
/api/location/**        /api/department/**
/api/category/**        /api/modality/**     /api/life-event/**
/api/recipient/**       (NUEVO en 0ecd14e)
/api/organization-type/**  /api/document/**
```
> **Cambios de visibilidad vs versión anterior:**
> - ❌ `/api/municipality/**` — eliminado (Municipality ya no existe; ahora Location).
> - ❌ `/api/storage/**` — **ya NO es público**: ahora requiere autenticación (cae en `anyRequest().authenticated()`).
> - ❌ `/actuator/**` → restringido a **solo** `/actuator/health`.
> - `/api/organism/**` y `/api/organism-type/**` **NO** son públicos: requieren auth (además llevan `@PreAuthorize`,
>   ahora **por permiso**: `READ_ORGANISM`, `CREATE_ORGANISM`, …).
> - `/api/auth/**` es `permitAll` a nivel matcher, **pero `GET /api/auth/me` lleva `@PreAuthorize("isAuthenticated()")`**:
>   sin token responde **401** (`JwtEntryPoint`, code `4025`).

**RESTRICCIONES POR ROL (en orden del filter chain)** — 💥 **simplificadas en `d800be0`**:
```
     /api/user/update-profile -> authenticated()
ADMIN_URLS                    -> hasAnyRole(SUPERADMIN, ADMIN_BACKOFFICE)
USER_URLS                     -> hasRole(USER)
anyRequest()                  -> authenticated()
```
- `ADMIN_URLS` = `/admin/**`, `/roles/**`, `/api/role/**`, `/api/roles/**`
  > ❌ **Se quitaron `/api/user/**` y `/api/users/**`** del matcher, y **se eliminó el matcher
  > `POST /api/user -> hasAnyRole(...)`**. Todo `/api/user/**` cae ahora en `anyRequest().authenticated()`
  > y **la autorización real la deciden los `@PreAuthorize` por permiso** de `UserController` (§3.2).
  > `/api/permission/**` **nunca estuvo** en `ADMIN_URLS`: también se resuelve solo por `@PreAuthorize`.
- `USER_URLS` = `/user/**`, `/profile/**`
- Hay `@EnableMethodSecurity(prePostEnabled=true)`: además de los matchers, cada endpoint lleva su
  `@PreAuthorize` propio (documentado por endpoint en cada sección).
- `hasRole('X')` ⇒ la autoridad debe ser `ROLE_X` · `hasAuthority('Y')` ⇒ la autoridad debe ser **exactamente** `Y`
  (así se chequean los permisos).
- **Stateless** (sin sesión HTTP), **CSRF deshabilitado**.

> 🧠 **Regla mental para el front:** un endpoint es accesible si el usuario **(a)** pasa el matcher de `SecurityConfig`
> **y (b)** cumple el `@PreAuthorize` del método. Como casi todos los `@PreAuthorize` pasaron a permisos, el guard del
> backoffice debe **chequear permisos, no roles** (salvo `/api/role/**` y `/api/permission/**`, que siguen por rol).

### 1.4 CORS
- Origins: `cors.allowed-origins` = `front.url.backoffice, front.url.portal` (default `http://localhost:4200`).
- Métodos: `GET, POST, PUT, DELETE, OPTIONS, PATCH` · `allowCredentials: true` · `allowedHeaders: *` ·
  `exposedHeaders: Authorization` · aplica a `/**`.

### 1.5 Envelopes de respuesta
**`ResponseDTO<T>`** — envelope de ÉXITO usado por la mayoría de endpoints:
```json
{ "details": "string (mensaje i18n o null)", "code": 200, "data": { } }
```
> No tiene `success` ni `message`. El texto va en `details`, el payload en `data`. `code` es un
> **código de negocio interno** (NO el HTTP status).

**`MessageDTO`** — usado por operaciones tipo comando (sin payload) y por el handler de errores:
```json
{ "code": 200, "message": "string", "details": "string" }
```

> ⚠️ **Inconsistencia a tener en cuenta:** `ResponseDTO` usa la clave `details` para el texto;
> `MessageDTO` usa `message` (+`details`). No asumir una sola forma — depende del endpoint.

### 1.6 Manejo de errores (DOS formatos según la capa)

**A) `GlobalExceptionHandler` (`@RestControllerAdvice`) — cuerpo = `MessageDTO`** `{ code, message, details }`:

| Excepción | HTTP status | code | Notas |
|---|---|---|---|
| `MethodArgumentNotValidException` (validación `@Valid`) | `400` | `4012` | `details` = `"campo: msg; campo2: msg2"` |
| `GlobalAppException` (negocio) | variable `e.getStatus()` | `e.getCode()` | status y code los fija el servicio |
| `GlobalMessageException` (negocio) | variable | `e.getCode()` | |
| `Exception` (genérica / 500) | `500` | `5000` | "Ocurrió un error inesperado." |

**B) Errores de la capa de seguridad (filtros, NO pasan por el advice) — cuerpo = `ErrorDTO`**:
```json
{ "date": "string", "code": 0, "message": "string", "details": "string", "path": "string", "listDetails": {} }
```

| Origen | HTTP status | code | message |
|---|---|---|---|
| `JwtEntryPoint` (no autenticado / token ausente o inválido en recurso protegido) | `401` | `4025` | "Acceso denegado. Intente volver a iniciar sesión." |
| `CustomAccessDeniedHandler` (autenticado, sin rol) | `403` | `403` | "Acceso denegado." |
| `JWTAuthenticationFilter` ante JWT inválido | `401` | `4005`–`4009` | según código (ver abajo) |

**Códigos JWT (todos 401):** `4005` firma inválida · `4006` token malformado · `4007` sesión caducada
(expirado) · `4008` token no soportado · `4009` claims vacíos.

**Catálogo de códigos de negocio (`messages.properties`, verbatim):**
```
403  = Acceso denegado.
2001 = Creado con éxito!
2002 = Los datos se han actualizado con éxito!
2003 = Eliminado con éxito!
2004 = Registrado con éxito.
2005 = Contraseña cambiada con éxito.
2007 = (email de recuperación enviado)
2013 = Consulta realizada con éxito.
4001 = (cuenta inactiva / token de activación pendiente)
4002 = El usuario ya está registrado. Por favor, intente con otro email/cuit.
4003 = (fallo al enviar email)
4004 = (token expirado/ inválido)
4012 = Verifique los campos de los elementos enviados.
4016 = La contraseña ingresada es incorrecta.
4018 = (password != confirmPassword / rol no encontrado, según contexto)
4019 = El usuario no está registrado. Por favor regístrese.
4025 = Acceso denegado. Intente volver a iniciar sesión.
4029 = El usuario no tiene permisos para realizar esta acción.
4030 = Cuenta eliminada.
4034 = La contraseña no cumple con los requisitos mínimos de seguridad.
4050 = Usuario no encontrado.
4059 = Rol no encontrado.
4060 = Permiso no encontrado.
4061 = El rol ya existe.
4062 = El permiso ya existe.
4063 = El tipo de organización ya existe.
4064 = El refresh token es inválido o expiró.
4065 = No se puede eliminar la categoría porque tiene subcategorías asociadas.
4066 = No se puede desactivar el tipo de organismo porque tiene organismos activos asociados.
4067 = No se puede eliminar el organismo porque tiene organismos hijos asociados.
4068 = No se puede asignar un descendiente como padre del organismo.
4069 = El acrónimo del organismo ya está en uso.
4070 = Un organismo no puede ser su propio padre.
4071 = La entidad relacionada no se encuentra activa.
4072 = El objeto %s con el identificador %s existe.  (conflicto unicidad: slug/name duplicado)
4073 = El objeto %s con el identificador %s no existe.  (not found → HTTP 404)
4074 = Una categoría no puede ser su propia categoría padre.
4075 = No se puede asignar una subcategoría descendiente como padre de la categoría.
4076 = No se puede renombrar el evento de vida porque está asignado.
5000 = Ocurrió un error inesperado. Contacte al administrador.
```
> Nota: `4053` = Tipo de organización no encontrada · `4055` = "Uno o más municipios no existen." (texto legacy sin
> actualizar a "localidades"; usado internamente al validar variantes) · `4058` = Organización no encontrada. El código
> `5001` ya **no existe** en `messages.properties`.
> Los códigos genéricos `4072` (existe) y `4073` (no existe) llevan el **nombre de la entidad** interpolado en el
> mensaje (`El objeto <Entidad> con el identificador <id> ...`), p.ej. `Categoría`, `Destinatario`, `Ubicación`,
> `Evento de Vida`, `Etiqueta`.
> 🆕 **`d800be0` no agrega códigos nuevos**, pero reutiliza `4029` ("El usuario no tiene permisos para realizar esta
> acción") con **HTTP 403** cuando un `ADMIN_BACKOFFICE` intenta **actualizar o eliminar el rol `SUPERADMIN`** (§4.4).
> Ojo: ese 403 viene del *service* → cuerpo **`MessageDTO`**, mientras que el 403 del `CustomAccessDeniedHandler`
> (falta de rol/permiso) viene como **`ErrorDTO`**. Contemplar ambas formas en el `http-error.service`.

### 1.7 reCAPTCHA
- **No es un interceptor global.** Solo lo usa el endpoint dedicado `POST /api/recaptcha/verify-recaptcha`
  (público). Login/register **no** invocan reCAPTCHA en el backend. (Detalle en §6.)
- reCAPTCHA v3: aprueba si `success==true` Y `score >= google.recaptcha.score-threshold` (env `RECAP_SCORE`).

---

## 2. Autenticación

Controller `AuthController` — prefijo `/api/auth`. Las rutas de `login`/`register`/`activate-account`/`refresh` son
**públicas** (sin Bearer token); **`GET /api/auth/me` requiere token** (§2.5).
Validación de body (`@Valid`) fallida → `400` (handler global, code `4012`).

### POST `/api/auth/login`
Autentica y devuelve tokens. **Request `LoginDTO`**:

| Campo | Tipo | Requerido | Validación |
|---|---|---|---|
| `email` | string | Sí | `@NotBlank` |
| `password` | string | Sí | `@NotBlank`, `@Size(min=8)` |

```json
{ "email": "user@mail.com", "password": "secret123" }
```
**200 OK** — `ResponseDTO<JwtDTO>`:
```json
{ "details": null, "code": 200, "data": { "accessToken": "<jwt>", "refreshToken": "<jwt>" } }
```
**Errores:** `404` (4023) email inexistente · `400` credenciales inválidas · `401` cuenta no activada
(4001 con token pendiente / 4030 sin token) · `500` (5000).
**Side effects:** resetea intentos fallidos, crea `RefreshTokenSession`, actualiza `lastLogin`.

### POST `/api/auth/register`
Registra usuario (inactivo), genera token de activación y **envía email**. **Request `UserRequestDTO`**:

| Campo | Tipo | Requerido | Validación |
|---|---|---|---|
| `email` | string | Sí | `@NotEmpty`, `@Email`, `@Size(min=5,max=50)` |
| `password` | string | Sí | `@NotEmpty`, `@Size(min=8,max=20)` |
| `cuit` | string | No | `@Size(min=11,max=15)` |
| `avatar` | string | No | — |
| `role` | objeto Role | No | backend asigna rol por defecto |
| `clientApp` | enum | **Sí** | `@NotNull` — `BACKOFFICE` \| `PORTAL` |

```json
{ "email": "user@mail.com", "password": "secret123", "cuit": "20123456789", "clientApp": "PORTAL" }
```
**201 Created** — `ResponseDTO<String>` (`data` = mensaje, code `2001`).
**Errores:** `409` (4002) email ya registrado · `406` (4034) password débil · `400` (4003) fallo envío email · `400` validación.
**`clientApp`** determina la URL base del enlace de activación del email
(`BACKOFFICE`→Angular, `PORTAL`→React). Enviar siempre el de tu app.

### POST `/api/auth/activate-account`
Activa la cuenta vía token del email y hace login automático. **Request `ActivateAccountRequestDTO`**:

| Campo | Tipo | Requerido | Validación |
|---|---|---|---|
| `token` | string | Sí | `@NotBlank` |

**200 OK** — `ResponseDTO<JwtDTO>` (`{ accessToken, refreshToken }`).
**Errores:** `401` (4004) token expirado · `400` token inválido/consumido.
**Side effects:** `accountActive=true`, limpia `tokenPassword`, crea sesión refresh, actualiza `lastLogin`.

### POST `/api/auth/refresh`
Rota el refresh token. **Request `RefreshTokenRequestDTO`** `{ "refreshToken": "<jwt>" }` (`@NotBlank`).
**200 OK** — `RefreshTokenResponseDTO` **(objeto plano, SIN wrapper `ResponseDTO`)**:
```json
{ "accessToken": "<jwt>", "refreshToken": "<jwt>" }
```
**Errores:** `401` (4064) refresh nulo/inválido/expirado/revocado, o usuario inexistente/inactivo · `400` parseo.
**Side effects:** invalida la sesión anterior y crea una nueva (rotación). El refresh previo deja de servir.

### 🆕 GET `/api/auth/me`  *(nuevo en `d800be0`)*

Devuelve el **contexto de autorización efectivo** del usuario del token. `@PreAuthorize("isAuthenticated()")` —
requiere `Authorization: Bearer <accessToken>`. Sin body.

**200 OK** — `ResponseDTO<AuthMeResponseDTO>` (code `2013`):
```json
{
  "details": "Consulta realizada con éxito.",
  "code": 2013,
  "data": {
    "userId": "3f2a1b8c-...-uuid",
    "email": "admin@mail.com",
    "roles": ["ROLE_SUPERADMIN"],
    "permissions": ["CREATE_USER", "READ_USER", "UPDATE_USER", "DELETE_USER", "READ_ORGANISM", "..."]
  }
}
```

| Campo | Tipo | Notas |
|---|---|---|
| `userId` | UUID | id del `User` autenticado |
| `email` | string | = `sub` del token |
| `roles` | `string[]` | autoridades **con** prefijo `ROLE_` (ej. `ROLE_ADMIN_BACKOFFICE`). Puede venir `[]`. |
| `permissions` | `string[]` | códigos de permiso **sin** prefijo (ej. `CREATE_CATEGORY`). Puede venir `[]`. |

**Errores:** `401` (4025) sin token / token inválido · `401` (4019) si el principal no es un `CustomeUserDetails`.

> **Por qué usarlo (en vez de decodificar el JWT):** las authorities se recalculan desde la base en cada request
> (§1.2). Si un admin cambia los permisos de tu rol, el JWT en el `localStorage` queda desactualizado pero el backend
> ya aplica lo nuevo. **Recomendación:** llamar a `/api/auth/me` justo después del login y del refresh, y guardar
> `roles`/`permissions` de ahí para alimentar guards, directivas `*hasPermission` y armado de menú.
> ⚠️ Los `roles` vienen **con** `ROLE_`: si el front compara contra `'SUPERADMIN'`, hay que normalizar
> (`r.replace(/^ROLE_/, '')`). Los `permissions` vienen sin prefijo.

---

## 3. Usuarios

Controller `UserController` — prefijo `/api/user`.

### 3.1 Entidades

**User** (tabla `users`):

| Campo | Tipo | Nullable | Notas |
|---|---|---|---|
| `id` | UUID | no (PK) | |
| `email` | String | **no** | |
| `password` | String | sí | hash; nunca se devuelve |
| `authProvider` | String | sí | `"LOCAL"` para usuarios locales (string libre, no enum) |
| `creationDate` / `modificationDate` / `lastLogin` | LocalDate | sí | |
| `avatar` | String | sí | |
| `accountActive` | boolean | **no** | borrado lógico = `false` |
| `tokenPassword` | String | sí | token de recuperación |
| `accountNonLocked` | boolean | sí | `false` = bloqueado |
| `failedAttempts` | int | sí | |
| `lockTime` | LocalDateTime | sí | |
| `roleAssignments` | Set\<UserRoleAssignment\> | — | `@OneToMany`, no es columna |

**Profile** (tabla `profiles`) — PK compartida con `User.id` (1:1 por id):

| Campo | Tipo | Nullable | Notas |
|---|---|---|---|
| `profileId` | UUID | no (PK) | = `User.id` |
| `firstName` / `lastName` | String | sí | |
| `cuil` | String | sí | **unique** |
| `active` | boolean | sí | |

> `dni` y `phone` se aceptan en el DTO de entrada `ProfileDto` pero **NO se persisten**.
> `profileComplete` = `true` cuando `firstName`, `lastName` y `cuil` están presentes.

**Organization** (tabla `organizations`):

| Campo | Tipo | Nullable | Notas |
|---|---|---|---|
| `id` | UUID | no (PK) | |
| `name` | String | **no** | |
| `active` | boolean | sí | |
| `createdAt` | LocalDateTime | sí | seteado en `@PrePersist` |

### 3.2 Endpoints

> 💥 **CAMBIO `d800be0`:** todos los `@PreAuthorize` de `UserController` pasaron **de rol a permiso**, y se quitó
> `/api/user/**` de `ADMIN_URLS` en `SecurityConfig` (§1.3). La columna "Auth" de abajo es ahora **la única** regla.

| # | Método + Ruta | Auth (`@PreAuthorize`) | Roles que lo cumplen hoy (seed) | Propósito |
|---|---|---|---|---|
| 1 | `POST /api/user` | `hasAuthority('CREATE_USER')` | SUPERADMIN · ADMIN_BACKOFFICE · ADMIN_ORGANIZATION | Crear usuario administrativo |
| 2 | `GET /api/user/{id}` | `hasAuthority('READ_USER')` | SUPERADMIN · ADMIN_BACKOFFICE · **ADMIN_ORGANIZATION** 🆕 | Obtener usuario por ID |
| 3 | `PUT /api/user/{id}` | `hasAuthority('DELETE_USER')` ⚠️ | SUPERADMIN · ADMIN_BACKOFFICE | Borrado **lógico** (desactivar) |
| 4 | `DELETE /api/user/{id}/admin` | `hasAuthority('DELETE_USER')` | SUPERADMIN · ADMIN_BACKOFFICE | Borrado **definitivo** |
| 5 | `PUT /api/user/{id}/change-password` | `hasAuthority('UPDATE_USER')` | SUPERADMIN · ADMIN_BACKOFFICE | Cambiar contraseña de un usuario |
| 6 | `PATCH /api/user/{id}/change-email` | `hasAuthority('UPDATE_USER')` | SUPERADMIN · ADMIN_BACKOFFICE | Actualizar email |
| 7 | `PUT /api/user/{id}/status-account` | `hasAuthority('UPDATE_USER')` | SUPERADMIN · ADMIN_BACKOFFICE | Activar/desactivar cuenta |
| 8 | `PUT /api/user/update-profile` | `isAuthenticated()` | cualquiera logueado | Completar/actualizar perfil propio |

> ⚠️ **Ojo con el #3:** el borrado lógico es un `PUT` pero exige **`DELETE_USER`**, no `UPDATE_USER`. No es un typo del
> spec — está así en el código. Si el botón "desactivar" del backoffice se habilita con `UPDATE_USER`, el usuario verá
> el botón y comerá un 403.
>
> 🆕 **`ADMIN_ORGANIZATION` ahora puede leer usuarios** (`GET /api/user/{id}`): tiene `READ_USER` en el seed y ya no lo
> frena el matcher `ADMIN_URLS`. Antes recibía 403. **No** puede editar, desactivar ni borrar (le falta
> `UPDATE_USER`/`DELETE_USER`).

**1. `POST /api/user`** — body `CreateUserRequest`:
```json
{
  "email": "string",        // @NotBlank @Email @Size(max~50)
  "password": "string",     // @NotBlank @Size(min=8,max=30)
  "role": "uuid",           // @NotNull (UUID del rol)
  "organizationId": "uuid", // opcional; para ADMIN_ORGANIZATION se sobrescribe con su org
  "profileDto": { "firstName":"", "lastName":"", "cuil":"", "dni":"", "phone":"" }  // opcional; dni/phone no persisten
}
```
→ **201** `ResponseDTO<UserResponseDTO>` (code 2001). `UserResponseDTO`:
```json
{
  "id":"uuid", "email":"string", "cuit":"string|null", "cuil":"string|null",
  "accountActive":true, "accountNonLocked":true, "failedAttempts":0,
  "lockeTime":"2026-06-16T10:00:00|null",
  "role": { "id":"uuid","code":"string","description":"string","scopeType":"string",
            "assignableByOrgAdmin":true, "permissions":[ /* PermissionResponseDTO */ ] },
  "activeAssignments": [ /* RoleResponseDTO, puede venir null */ ],
  "profileComplete": false
}
```
> ⚠️ El campo timestamp se serializa literal como **`lockeTime`** (typo del backend). `cuit`/`cuil`/
> `activeAssignments` pueden venir `null` (no siempre se pueblan).
> 🆕 Desde `0ecd14e` el usuario creado por admin queda **`accountActive=true`** de una (sin email de activación):
> puede loguearse inmediatamente con el password provisto.
> **Errores:** `409` (4002) email duplicado · `404` (4018) rol inexistente / (4058) org inexistente ·
> `403` (4029) el rol autenticado no puede crear ese rol · `400` validación.

**2. `GET /api/user/{id}`** → **200** `ResponseDTO<UserResponseDTO>` (2013). Err: `404`, `403`.

**3. `PUT /api/user/{id}`** (borrado lógico) → **200** `MessageDTO` (2003). Err: `404`, `403`.

**4. `DELETE /api/user/{id}/admin`** (borrado físico) → **200** `MessageDTO` (2003). Err: `404`, `403`.

**5. `PUT /api/user/{id}/change-password`** — body `{ "newPassword": "string" }` (`@NotBlank`)
→ **200** `MessageDTO` (2005). Err: `403` (4029) no se permite sobre usuarios SUPERADMIN/ADMIN_BACKOFFICE · `404` · `400`.

**6. `PATCH /api/user/{id}/change-email`** — body `{ "newEmail": "string" }` (`@NotBlank @Email`, se guarda en minúsculas)
→ **200** `MessageDTO` (2002). Err: `404`, `400`, `403`.

**7. `PUT /api/user/{id}/status-account`** — body `{ "accountActive": true }` (`@NotNull`)
→ **200** `MessageDTO` (2012). Err: `404`, `400`, `403`.

**8. `PUT /api/user/update-profile`** (sobre el usuario autenticado, sin id) — body `ProfileUpdateRequestDTO`:
```json
{ "firstName":"string", "lastName":"string", "cuil":"string" }   // todos @NotBlank
```
→ **200** `ResponseDTO<UserResponseDTO>` (2002; `profileComplete` pasa a `true`). Err: `400`, `401`.

> **No hay endpoint de listado/paginado de usuarios** (`GET /api/user` con `Page<T>`) en el controller actual.
> Si el backoffice necesita una tabla de usuarios, ese endpoint **falta en el backend** (ver §7).

---

## 4. Roles y Permisos

RBAC con permisos atómicos, roles agrupadores y asignaciones (`UserRoleAssignment`) opcionalmente
acotadas a una `Organization`. Wrapper de respuesta: `ResponseDTO<T>` (`{ code, details, data }`).
**Sin paginación** — las listas vienen como arrays en `data`.

### 4.1 Modelo
- Un `User` recibe roles vía filas en `UserRoleAssignment`. Cada asignación puede acotarse a una
  `Organization` (`organization_id` nullable) y a una ventana temporal (`effectiveFrom`/`effectiveTo`).
- Un `Role` agrupa `Permission` vía `role_permissions`. 💥 **Desde `d800be0` la autorización en endpoints se hace
  mayoritariamente por PERMISO** (`@PreAuthorize("hasAuthority('CODIGO')")`), no por código de rol.
  Siguen siendo por rol: `/api/role/**`, `/api/permission/**` y `GET /api/role/allowed`.
- Scope: solo por **Organización** (no por Municipio). `Role.scopeType` declara `global` u `organismo`.

> 💥 **BREAKING CHANGE (desde `ea65b92`):** los campos de los DTOs de Role/Permission se **renombraron a inglés**.
> Si ya implementaste el RBAC con la versión anterior, actualizá las interfaces:
> `codigo`→**`code`**, `scopeTipo`→**`scopeType`**, `asignablePorOrgAdmin`→**`assignableByOrgAdmin`**,
> `descripcion`→**`description`**. Los **valores** de rol (`SUPERADMIN`, etc.) NO cambiaron.

**Enum `RoleScopeType`** (columna `roles.scope_tipo`, CHECK `IN ('global','organismo')`):
`GLOBAL` → `"global"` · `ORGANISMO` → `"organismo"`.

**Role** (tabla `roles`): `id` UUID PK · `code` String UNIQUE · `description` · `scopeType`
RoleScopeType · `assignableByOrgAdmin` Boolean · `permissions` Set\<Permission\> (ManyToMany EAGER) · `active` Boolean (col `activo`).

**Permission** (tabla `permissions`): `id` UUID PK · `code` String NOT NULL UNIQUE (formato `ACCION_RECURSO`) ·
`description` · `active` Boolean (col `activo`).

**UserRoleAssignment** (tabla `user_role_assignments`): `id` UUID PK · `user` (FK `user_id`, NOT NULL) ·
`role` (FK `role_id`, NOT NULL) · `organization` (FK `organization_id`, **nullable**) ·
`effectiveFrom` LocalDate · `effectiveTo` LocalDate (`NULL`=activa). Constraints: no solapamiento temporal
por `(user, role, organization)`; solo una asignación activa por combinación.

### 4.2 Catálogo (strings exactos para RBAC del frontend)

**Roles** (valor de `code`, SIN prefijo `ROLE_`; Spring `hasRole('X')` ⇒ autoridad `ROLE_X`):

| `code` | Descripción |
|---|---|
| `SUPERADMIN` | Superusuario (todos los permisos) |
| `ADMIN_BACKOFFICE` | Admin de backoffice (catálogo + taxonomía global) |
| `ADMIN_ORGANIZATION` | Admin de organización local (variantes, contactos, usuarios locales) |
| `AGENT` | Operador de trámites (lectura + carga parcial) |
| `MANAGER` | Visualizador de estadísticas |
| `USER` | Usuario final |

**Permisos** (valor de `code`, formato `ACCION_RECURSO`) — 💥 **catálogo reescrito por la migración `V2.9`**:

> **Todos los códigos en español fueron RENOMBRADOS a inglés** (`UPDATE permissions SET code = ...`): el `id` del
> permiso **no cambió**, pero el `code` sí. Cualquier constante hardcodeada del front con el nombre viejo
> (`CREATE_ORGANISMO`, `READ_USUARIO`, `VIEW_ANALYTICS_INTELIGENCIA`, …) **ya no matchea nada**.

| Recurso | Códigos vigentes | Antes (español, ya no existe) |
|---|---|---|
| Organismo | `CREATE_ORGANISM` `READ_ORGANISM` `UPDATE_ORGANISM` `DELETE_ORGANISM` | `*_ORGANISMO` |
| Tipo de organismo 🆕 | `CREATE_ORGANISM_TYPE` `READ_ORGANISM_TYPE` `UPDATE_ORGANISM_TYPE` `DELETE_ORGANISM_TYPE` | — (nuevos) |
| Usuario | `CREATE_USER` `READ_USER` `UPDATE_USER` `DELETE_USER` | `*_USUARIO` |
| Rol | `CREATE_ROLE` `READ_ROLE` `UPDATE_ROLE` `DELETE_ROLE` | `*_ROL` |
| Trámite | `CREATE_PROCEDURE` `READ_PROCEDURE` `UPDATE_PROCEDURE` `DELETE_PROCEDURE` | `*_TRAMITE` |
| Variante | `CREATE_VARIANT` `READ_VARIANT` `UPDATE_VARIANT` `DELETE_VARIANT` `PUBLISH_VARIANT` | `*_VARIANTE` |
| Taxonomía | `CREATE_TAXONOMY` `READ_TAXONOMY` `UPDATE_TAXONOMY` `DELETE_TAXONOMY` | `*_TAXONOMIA` |
| Contacto | `CREATE_CONTACT` `READ_CONTACT` `UPDATE_CONTACT` `DELETE_CONTACT` | `*_CONTACTO` |
| Categoría 🆕 | `CREATE_CATEGORY` `UPDATE_CATEGORY` `DELETE_CATEGORY` | — (nuevos; **no hay `READ_CATEGORY`**, los GET son públicos) |
| Modalidad 🆕 | `CREATE_MODALITY` `UPDATE_MODALITY` `DELETE_MODALITY` | — (nuevos; sin `READ_*`) |
| Evento de vida 🆕 | `CREATE_LIFE_EVENT` `UPDATE_LIFE_EVENT` `DELETE_LIFE_EVENT` | — (nuevos; sin `READ_*`) |
| Destinatario 🆕 | `CREATE_RECIPIENT` `UPDATE_RECIPIENT` `DELETE_RECIPIENT` | — (nuevos; sin `READ_*`) |
| Almacenamiento 🆕 | `READ_STORAGE` | — (nuevo) |
| Analítica | `VIEW_ANALYTICS` | `VIEW_ANALYTICS_INTELIGENCIA` |

**Mapeo rol → permisos (seed `V0.1` + `V2.9`)** — esto es lo que determina qué ve cada usuario:

| Rol | Permisos efectivos |
|---|---|
| `SUPERADMIN` | **TODOS** (el seed hace `INSERT ... SELECT id FROM permissions`, se re-ejecuta en `V2.9`) |
| `ADMIN_BACKOFFICE` | `CREATE/READ/UPDATE_PROCEDURE` · `CREATE/READ/UPDATE_TAXONOMY` · `VIEW_ANALYTICS` · 🆕 `CREATE/READ/UPDATE/DELETE_USER` · 🆕 `CREATE/UPDATE/DELETE_CATEGORY` · 🆕 `CREATE/UPDATE/DELETE_MODALITY` · 🆕 `CREATE/UPDATE/DELETE_LIFE_EVENT` · 🆕 `CREATE/UPDATE/DELETE_RECIPIENT` · 🆕 `READ_STORAGE` |
| `ADMIN_ORGANIZATION` | `CREATE/READ/UPDATE/PUBLISH_VARIANT` · `CREATE/READ/UPDATE_CONTACT` · `CREATE/READ_USER` · `VIEW_ANALYTICS` |
| `AGENT` | `READ/UPDATE_VARIANT` · `CREATE/READ/UPDATE_CONTACT` |
| `MANAGER` | `READ_PROCEDURE` · `READ_VARIANT` · `VIEW_ANALYTICS` |
| `USER` | ninguno |

> 🚨 **Gap importante para el backoffice:** **`ADMIN_BACKOFFICE` NO recibe ningún permiso de Organismo ni de Tipo de
> Organismo** en el seed. Como esos endpoints ahora exigen `READ_ORGANISM` / `CREATE_ORGANISM` / `READ_ORGANISM_TYPE` /
> etc., el módulo **Organismos y Tipos de Organismo sigue siendo de facto SOLO `SUPERADMIN`** (§5.2).
> Funcionalmente equivale al comportamiento anterior (`hasRole('SUPERADMIN')`), así que **no es una regresión**, pero
> ahora se puede arreglar sin tocar código: basta asignarle esos permisos al rol desde `PUT /api/role/{id}`.
>
> 🚨 **Segundo gap:** roles como `AGENT`, `MANAGER` y `USER` no tienen **ningún** permiso de los que usan los endpoints
> del backoffice → todo ABM les devuelve **403**. El menú debe construirse desde `permissions` (`/api/auth/me`), no
> desde el rol, o van a ver ítems que no pueden usar.

### 4.3 DTOs (campos en inglés desde `ea65b92`)

**`RoleRequestDTO`** — 💥 **`active` cambió de semántica en `d800be0`**:

| Campo | Tipo | POST (crear) | PUT (actualizar) |
|---|---|---|---|
| `code` | string | **@NotBlank** | **@NotBlank** |
| `description` | string | opcional | opcional |
| `scopeType` | string | **@NotBlank** (`"global"`\|`"organismo"`) | **@NotBlank** |
| `assignableByOrgAdmin` | boolean | opcional (default `false`) | opcional |
| `active` | **`Boolean`** (nullable, ya no `boolean`) | **se IGNORA** — el rol siempre se crea `active=true` | **@NotNull → OBLIGATORIO**; si falta → 400 `4012` |
| `permissionsIds` | `UUID[]` | opcional | opcional (**reemplaza** el set completo) |

> ⚠️ **El PUT es un reemplazo total, no un patch.** `permissionsIds` pisa la lista entera de permisos del rol
> (`role.setPermissions(...)`), y `active` es obligatorio. El form de edición debe **precargar el rol completo**
> (`GET /api/role/{id}`) y reenviar todo, incluido `active` y todos los `permissionsIds` que se quieran conservar.
> Mandar `permissionsIds: []` o `null` **deja el rol sin permisos**.
> Técnicamente: el controller valida con los grupos `{Default, RoleRequestDTO.OnUpdate}` y `@NotNull(groups=OnUpdate)`
> está solo sobre `active`.

**`RoleResponseDTO`**: `{ id, code, description, scopeType, assignableByOrgAdmin, active, permissions: PermissionResponseDTO[] }`
🆕 **ahora SÍ incluye `active`** (antes no se exponía y el front no podía saber si un rol estaba dado de baja).
Sigue exponiendo `permissions` completos anidados, **no** `permissionsIds`.

`PermissionRequestDTO`: `code` (@NotBlank) · `description` (@NotBlank).
`PermissionResponseDTO`: `{ id, code, description }`.

### 4.4 Endpoints — `RoleController` (`/api/role`)

💥 **`ADMIN_BACKOFFICE` ya puede gestionar roles** (antes todo era `hasRole(SUPERADMIN)`):

| Método + Ruta | Auth | Respuesta |
|---|---|---|
| `GET /api/role` | `hasAnyRole(SUPERADMIN, ADMIN_BACKOFFICE)` | 200 `ResponseDTO<RoleResponseDTO[]>` (2013) |
| `GET /api/role/{id}` | `hasAnyRole(SUPERADMIN, ADMIN_BACKOFFICE)` | 200 `ResponseDTO<RoleResponseDTO>` (2013) · 404 `4059` si no existe |
| `POST /api/role` | `hasAnyRole(SUPERADMIN, ADMIN_BACKOFFICE)` | 201 `ResponseDTO<RoleResponseDTO>` (2001) · body `RoleRequestDTO` · 409 `4061` code duplicado |
| `PUT /api/role/{id}` | `hasAnyRole(SUPERADMIN, ADMIN_BACKOFFICE)` | 200 (2002) · body `RoleRequestDTO` (`active` **obligatorio**) · 404 `4059` · 409 `4061` · **403 `4029`** ⬇ |
| `DELETE /api/role/{id}` | `hasAnyRole(SUPERADMIN, ADMIN_BACKOFFICE)` | 200 `ResponseDTO<Void>` (2003, baja lógica) · 404 `4059` · **403 `4029`** ⬇ |
| `GET /api/role/allowed` | `hasRole(SUPERADMIN) or ADMIN_BACKOFFICE or ADMIN_ORGANIZATION` | 200 lista de roles asignables (**context-aware**, ver nota) |

> 🔒 **Protección del rol `SUPERADMIN` (nuevo):** en `PUT` y `DELETE`, si el rol destino tiene `code` = `SUPERADMIN`
> (comparación case-insensitive) y el caller **no** tiene la autoridad `ROLE_SUPERADMIN`, el service corta con
> **403 code `4029`** ("El usuario no tiene permisos para realizar esta acción"), cuerpo `MessageDTO`.
> Es decir: `ADMIN_BACKOFFICE` puede tocar todos los roles **menos** `SUPERADMIN`.
> **En la UI:** deshabilitar editar/eliminar sobre la fila `SUPERADMIN` cuando el usuario logueado no sea SUPERADMIN.

> **`GET /api/role/allowed` — comportamiento actual (context-aware por rol del caller):** si el caller es
> `SUPERADMIN` devuelve **todos** los roles sin filtrar. Si es cualquier otro (ADMIN_BACKOFFICE / ADMIN_ORGANIZATION),
> **excluye** los roles con `code` `SUPERADMIN` y `ADMIN_BACKOFFICE` (deja ADMIN_ORGANIZATION, AGENT, MANAGER, USER).
> Útil para poblar el select de rol al crear usuarios.

### 4.5 Endpoints — `PermissionController` (`/api/permission`)

💥 **También abierto a `ADMIN_BACKOFFICE`** (antes todo `hasRole(SUPERADMIN)`):

| Método + Ruta | Auth | Respuesta |
|---|---|---|
| `GET /api/permission` | `hasAnyRole(SUPERADMIN, ADMIN_BACKOFFICE)` | 200 `ResponseDTO<PermissionResponseDTO[]>` (2013) |
| `GET /api/permission/{id}` | `hasAnyRole(SUPERADMIN, ADMIN_BACKOFFICE)` | 200 `ResponseDTO<PermissionResponseDTO>` (2013) · 404 `4060` |
| `POST /api/permission` | `hasAnyRole(SUPERADMIN, ADMIN_BACKOFFICE)` | 201 (2001) · body `PermissionRequestDTO` · 409 `4062` code duplicado |
| `PUT /api/permission/{id}` | `hasAnyRole(SUPERADMIN, ADMIN_BACKOFFICE)` | 200 (2002) · 404 `4060` |
| `DELETE /api/permission/{id}` | `hasAnyRole(SUPERADMIN, ADMIN_BACKOFFICE)` | 200 `ResponseDTO<Void>` (2003) · 404 `4060` |

> Estos dos controllers (`/api/role`, `/api/permission`) son **los únicos que siguen autorizando por ROL**; todo el
> resto del backoffice pasó a permisos. Sin token → 401 (`4025`); con token sin el rol → 403 (`ErrorDTO`).
> `GET /api/permission` es el endpoint que alimenta el **selector de permisos** al crear/editar un rol — ahora
> ADMIN_BACKOFFICE puede consumirlo sin ser SUPERADMIN.

---

## 5. Dominio de Negocio (Geografía · Organismos · Taxonomía · Trámites)

> **Novedad `ea65b92`:** gran parte de lo que antes figuraba como "pendiente de exponer" **ya tiene API**.
> Se pueden cablear los servicios `localidad`, `organismo`, `categoria`, `modalidad`, `evento-de-vida`.
> Trámites (plantilla → adopción → ficha por localidad → puntos de atención) y Tag ya tienen API (§5.5, §7.0.2).
>
> Todos los endpoints usan el envelope `ResponseDTO<T>` = `{ code, details, data }` (`code` de negocio 2001/2002/2003/2013,
> no el HTTP status). Los códigos de error de este dominio (4053, 4055, 4065–4075) están en §1.6 y en cada subsección.

### 5.1 Departamentos y Localidades (reemplaza Municipios)

> 💥 **BREAKING CHANGE:** `Municipality` y `MunicipalityController` **fueron eliminados**. `GET /api/municipality`
> **ya no existe (404)**. Migrá `localidad.service` al recurso **Location**. El modelo pasó de plano
> (`Municipality {id, name, postalCode}`) a jerárquico: **`Department` (1) → `Location` (N)**.
> `LocationResponseDTO` ya trae `departmentId` + `departmentName` desnormalizados (no hace falta 2º request).

**Entidades** (ambas PK **UUID**):
- **Department** (`departments`): `id` UUID PK · `name` String NOT NULL.
- **Location** (`locations`): `id` UUID PK · `department` (FK `department_id`, NOT NULL) · `name` String NOT NULL
  (único por `(department_id, name)`).

**Endpoints — públicos (sin token), 200 OK, code 2013:**

| Método + Ruta | Propósito | Response `data` |
|---|---|---|
| `GET /api/department` | Todos los departamentos (orden por `name`) | `DepartmentResponseDTO[]` = `{ id, name }[]` |
| `GET /api/location` | Todas las localidades (orden por `name`) | `LocationResponseDTO[]` |
| `GET /api/location/department/{departmentId}` | Localidades de un departamento (`departmentId`: UUID) | `LocationResponseDTO[]` |

`LocationResponseDTO` = `{ id: UUID, departmentId: UUID, departmentName: String, name: String }`.
`GET /location/department/{id}` con departamento inexistente devuelve **200 + `data: []`** (no 404); `departmentId` no-UUID → 400.

### 5.2 Organismos y Tipos de Organismo

Modelo jerárquico: un `Organism` tiene un `OrganismType` (obligatorio) y opcionalmente un `parent` (auto-referencia).
La jerarquía ancestro/descendiente se materializa en una **closure table** interna (`organisms_closure`), usada para
validar ciclos; **no se expone**. El campo antes `sigla` ahora es **`acronym`**.

**Entidades:**
- **OrganismType** (`organism_types`): `id` UUID PK · `code` String (autogenerado desde `name`, único; **no se envía**) ·
  `name` String NOT NULL · `description` String? · `active` Boolean (col `activo`).
- **Organism** (`organisms`): `id` UUID PK · `parent` (FK `parent_id`, nullable = raíz) · `type` (FK `type_id`, NOT NULL) ·
  `baseLocationId` UUID? · `name` String NOT NULL · `acronym` String? · `active` Boolean · `createdAt`/`updatedAt`.

💥 **Auth `d800be0`: pasó de `hasRole('SUPERADMIN')` a permisos.** Cada endpoint exige ahora su permiso:

| Operación | Organismo | Tipo de organismo |
|---|---|---|
| Listar / ver por id | `READ_ORGANISM` | `READ_ORGANISM_TYPE` |
| Crear | `CREATE_ORGANISM` | `CREATE_ORGANISM_TYPE` |
| Actualizar | `UPDATE_ORGANISM` | `UPDATE_ORGANISM_TYPE` |
| Eliminar (soft) | `DELETE_ORGANISM` | `DELETE_ORGANISM_TYPE` |

> 🚨 **En la práctica sigue siendo solo `SUPERADMIN`:** ningún otro rol del seed tiene permisos de organismo (§4.2).
> Sin token → 401 (`4025`); con token sin el permiso → 403 (`ErrorDTO`).
> **La diferencia es que ahora es configurable**: para habilitar el módulo a `ADMIN_BACKOFFICE` alcanza con agregarle
> esos 8 permisos al rol vía `PUT /api/role/{id}` — **sin deploy**. El front debería mostrar/ocultar el módulo
> mirando `permissions` de `/api/auth/me`, no el rol.

**Tipos de organismo — `/api/organism-type`**  · body `OrganismTypeRequestDTO` = `{ name (@NotBlank), description?, active? }` ·
response `OrganismTypeResponseDTO` = `{ id, code, name, description, active }`:

| Método + Ruta | Éxito | Errores |
|---|---|---|
| `GET /api/organism-type` | 200 lista (2013) | — |
| `GET /api/organism-type/{id}` | 200 (2013) | 404 `4053` no existe |
| `POST /api/organism-type` | 201 (2001) | 400 validación · 409 `4063` code duplicado |
| `PUT /api/organism-type/{id}` | 200 (2002) | 404 `4053` · 409 `4063` · 409 `4066` desactivar con organismos activos |
| `DELETE /api/organism-type/{id}` | 200 (2003, soft-delete) | 404 `4053` · 409 `4066` tiene organismos activos |

**Organismos — `/api/organism`**  · body `OrganismRequestDTO` = `{ typeId (@NotNull), parentId?, baseLocationId?, name (@NotBlank), acronym?, active? }` ·
response `OrganismResponseDTO` = `{ id, typeId, parentId, baseLocationId, name, acronym, active, createdAt, updatedAt }`:

| Método + Ruta | Éxito | Errores |
|---|---|---|
| `GET /api/organism` | 200 lista (2013) | — |
| `GET /api/organism/{id}` | 200 (2013) | 404 `4058` no existe |
| `POST /api/organism` | 201 (2001) | 400 validación · 404 `4053` type / `4058` parent / `4073` baseLocation inexistente · 409 `4071` type/parent inactivo · 409 `4069` acronym duplicado |
| `PUT /api/organism/{id}` | 200 (2002) | 404 `4058`/`4053`/`4073` baseLocation · 409 `4070` self-parent · 409 `4068` padre descendiente (ciclo) · 409 `4071` inactivo · 409 `4069` acronym dup |
| `DELETE /api/organism/{id}` | 200 (2003, soft-delete) | 404 `4058` · 409 `4067` tiene hijos activos |

> **`baseLocationId`** (opcional): sigue siendo un `UUID` plano en el DTO (no objeto anidado), pero desde `0ecd14e`
> se **valida su existencia** contra `locations` (si se envía y no existe → **404 `4073`** "…Ubicación…"). A nivel DB hay
> FK `fk_organisms_base_location` → `locations(id)` `ON DELETE SET NULL`.
>
> 💥 **`acronym`: la unicidad cambió en `d800be0`.** Antes se validaba **solo contra organismos activos**
> (`existsByAcronymAndActiveTrue`); ahora es **global, incluyendo los dados de baja** (`existsByAcronym`).
> Consecuencia práctica: **un acrónimo liberado por un soft-delete YA NO se puede reutilizar** → **409 `4069`**
> ("El acrónimo del organismo ya está en uso"). Además el `save` pasó a `saveAndFlush` dentro de un `try/catch` de
> `DataIntegrityViolationException`, así que un choque a nivel índice único también sale como **409 `4069`**
> (antes se escapaba como 500). El form debe mostrar el error sobre el campo `acronym`, no como error genérico.

### 5.3 Taxonomía: Categorías, Modalidades y Eventos de Vida

Convención: **reads (`GET`) públicos**; 💥 **escrituras ahora por PERMISO** (antes `hasAnyRole('SUPERADMIN','ADMIN_BACKOFFICE')`):

| Recurso | POST | PUT | DELETE |
|---|---|---|---|
| `/api/category` | `CREATE_CATEGORY` | `UPDATE_CATEGORY` | `DELETE_CATEGORY` |
| `/api/modality` | `CREATE_MODALITY` | `UPDATE_MODALITY` | `DELETE_MODALITY` |
| `/api/life-event` | `CREATE_LIFE_EVENT` | `UPDATE_LIFE_EVENT` | `DELETE_LIFE_EVENT` |

> ✅ **Sin cambio funcional:** `SUPERADMIN` y `ADMIN_BACKOFFICE` son los únicos roles del seed con estos permisos,
> así que quién puede escribir es exactamente el mismo conjunto que antes. Lo que cambia es **cómo** chequearlo en el front.
> No existen permisos `READ_*` para estos catálogos porque los GET son públicos.

Códigos: `4072` duplicado/conflicto, `4073` not found (404), `4074`/`4075` ciclo categoría, `4065` categoría con hijos.

**Categorías — `/api/category`** (jerárquica vía closure + `slug`). Entidad `Category`: `id` UUID · `parent` (FK `parent_id`, nullable=raíz) ·
`slug` String UNIQUE (len 100) · `name` String (len 100, no único). Closure interna `categories_closure` (no expuesta).
Body `CategoryRequestDTO` = `{ parentId?, slug (@NotBlank @Size 3-100), name (@NotBlank @Size 3-100) }` ·
response `CategoryResponseDTO` = `{ id, parentId|null, slug, name }`:

| Método + Ruta | Auth | Éxito | Errores |
|---|---|---|---|
| `GET /api/category` | público | 200 lista (2013) | — |
| `GET /api/category/{id}` | público | 200 (2013) | 404 `4073` |
| `GET /api/category/slug/{slug}` | público | 200 (2013) | 404 `4073` |
| `POST /api/category` | `CREATE_CATEGORY` | 201 (2001) | 400 `4072` slug dup · 404 `4073` parent inexistente · 400 validación |
| `PUT /api/category/{id}` | `UPDATE_CATEGORY` | 200 (2002) | 404 `4073` · 400 `4072` · 400 `4074` self-parent · 400 `4075` padre descendiente (ciclo) |
| `DELETE /api/category/{id}` | `DELETE_CATEGORY` | 200 (2003, **hard-delete**) | 404 `4073` · 400 `4065` tiene subcategorías |

**Modalidades — `/api/modality`**. Entidad `Modality`: `id` UUID · `name` String UNIQUE · `active` boolean (`is_active`, soft-delete).
Body `ModalityRequestDTO` = `{ name (@NotBlank @Size 3-100) }` · response `ModalityResponseDTO` = `{ id, name, active }`.
Los GET solo devuelven **activas**:

| Método + Ruta | Auth | Éxito | Errores |
|---|---|---|---|
| `GET /api/modality` · `GET /api/modality/{id}` | público | 200 (2013) | 404 `4073` (get by id inexistente/inactiva) |
| `POST /api/modality` | `CREATE_MODALITY` | 201 (2001) | 400 `4072` nombre dup (case-insensitive) · 400 validación |
| `PUT /api/modality/{id}` | `UPDATE_MODALITY` | 200 (2002) | 404 `4073` · 400 `4072` |
| `DELETE /api/modality/{id}` | `DELETE_MODALITY` | 200 (2003, **soft-delete**) | 404 `4073` |

**Eventos de Vida — `/api/life-event`**. Entidad `LifeEvent`: `id` UUID · `slug` String UNIQUE · `name` String ·
`active` boolean (`is_active`, **NUEVO en `0ecd14e`** — soft-delete). Body `LifeEventRequestDTO` = `{ slug (@NotBlank @Size 3-100), name (@NotBlank @Size 3-100) }` ·
response `LifeEventResponseDTO` = `{ id, slug, name }` (el `active` **no** se expone en el response). Los GET solo devuelven **activos**:

| Método + Ruta | Auth | Éxito | Errores |
|---|---|---|---|
| `GET /api/life-event` · `GET /api/life-event/{id}` | público | 200 (2013) | 404 `4073` (inexistente/inactivo) |
| `POST /api/life-event` | `CREATE_LIFE_EVENT` | 201 (2001) | 400 `4072` slug dup · 400 validación |
| `PUT /api/life-event/{id}` | `UPDATE_LIFE_EVENT` | 200 (2002) | 404 `4073` · 400 `4072` · **409 `4076`** si se renombra un evento **asignado a un trámite** |
| `DELETE /api/life-event/{id}` | `DELETE_LIFE_EVENT` | 200 (2003, **soft-delete** desde `0ecd14e`) | 404 `4073` |

### 5.4 Destinatarios (Recipients)

Catálogo simple que clasifica el **tipo de destinatario** de un trámite (quién puede solicitarlo). Controller `/api/recipient`.
**Entidad autónoma sin FK** a otras entidades. Seed inicial (`V2.7`): `persona_humana`, `empresa`, `extranjero`.

**Entidad** `Recipient` (`recipients`): `id` UUID PK · `name` String(100) NOT NULL **UNIQUE** (unicidad case-insensitive en el service). Sin `active` → **borrado físico (hard-delete)**.
Body `RecipientRequestDTO` = `{ name (@NotBlank @Size 3-100) }` · response `RecipientResponseDTO` = `{ id, name }`.
Convención: **reads públicos**; 💥 **escrituras por PERMISO** (antes `hasAnyRole('SUPERADMIN','ADMIN_BACKOFFICE')`).

| Método + Ruta | Auth | Éxito | Errores |
|---|---|---|---|
| `GET /api/recipient` | público | 200 lista (2013), orden por `name` | — |
| `GET /api/recipient/{id}` | público | 200 (2013) | 404 `4073` no existe |
| `POST /api/recipient` | `CREATE_RECIPIENT` | 201 (2001) | 400 `4072` nombre dup (case-insensitive) · 400 `4012` validación · 403 sin permiso |
| `PUT /api/recipient/{id}` | `UPDATE_RECIPIENT` | 200 (2002) | 404 `4073` · 400 `4072` nombre dup en otro · 400 `4012` |
| `DELETE /api/recipient/{id}` | `DELETE_RECIPIENT` | 200 (2003, **hard-delete**) | 404 `4073` |

> Igual que en taxonomía: los roles que cumplen esos permisos son `SUPERADMIN` y `ADMIN_BACKOFFICE`, así que el
> comportamiento observable no cambia.

### 5.5 Trámites y Etiquetas — API real (`23fd8f9` / `84fde37`)

> Reemplaza la sección vieja "Procedure / Variant — pendiente": esas tablas (`procedures`, `procedure_variants`) ya no
> son el modelo. El núcleo de trámites del DER se expuso en `origin/dev` @ `23fd8f9` y `Tag` en `84fde37`. Contratos,
> permisos y roles del seed en **§7.0.2**; gaps y bugs abiertos (R-3, G-1 … G-12) en **`PEDIDOS_BACKEND.md`**; plan y
> estado del front en **`PLAN_TRAMITES_API.md`** (§9).

El trámite son **4 recursos encadenados** (plantilla → adopción → ficha por localidad → puntos de atención):

| Recurso | Ruta | Permisos | Nombre en la UI | Feature del front | Fuente hoy |
|---|---|---|---|---|---|
| Plantilla provincial (`ProcedureTemplate`, alcance global) | `/api/procedure-template` | `READ/CREATE/UPDATE/DELETE_PROCEDURE` | Plantillas provinciales | `plantillas` | **real** |
| Adopción por organismo (`OrganismProcedure`, vigencia `effectiveFrom/To`) | `/api/organism-procedure` | `READ/CREATE/UPDATE/DELETE_ADOPTION` | Trámites del organismo | `adopciones` | mock hasta **R-3** (grants) |
| Ficha por localidad (`OrganismProcedureLocation`, OTL) + workflow | `/api/organism-procedure-location` · `POST /{id}/submit-review` · `/publish` · `/unpublish` | `READ/CREATE/UPDATE_VARIANT`, `PUBLISH_VARIANT` (`DELETE` con `UPDATE_VARIANT`) | Fichas por localidad | `fichas-locales` | mock hasta **G-1** (response incompleto) |
| Punto de atención (`AttentionPoint`, cuelga de la ficha) | `/api/attention-point` | `READ/CREATE/UPDATE/DELETE_ATTENTION_POINT` | Puntos de atención (panel del detalle de la ficha) | `puntos-atencion` | mock junto con fichas (G-1) y R-3 |

- Estados de la ficha (`PublicationStatus`, `V2.21`): `BORRADOR → EN_REVISION → PUBLICADO ↔ DESPUBLICADO`. Quién
  publica lo decide el permiso `PUBLISH_VARIANT`, no el rol. El `PUT` acepta `publicationStatus` (R-1): el front manda
  siempre el estado actual y solo cambia estado por los endpoints de workflow.
- **Tag** (`/api/tag`, PPDT-5.8): `{ id, slug, local, organismId }`, global ⇔ sin organismo. Integrado (BO-16); contrato
  en §7.0.2. Las reglas de integridad de la tabla (`uk_tags_slug_organism`, `chk_tags_scope_consistency`) no cambiaron.
- Logs internos (`ProcedureVisitLog`, `SearchLog`): sin endpoints de backoffice. Portal: `GET /api/procedure/{slug}`,
  `/api/procedure/search` y feedback ciudadano (§7.0.2).

---

## 6. Email, Almacenamiento y reCAPTCHA

> Las tres familias (`/api/email/**`, `/api/storage/**`, `/api/recaptcha/**`) son **públicas** (sin JWT ni rol).

### 6.1 Email — `EmailController` (`/api/email`)

**`POST /api/email/recovery`** — envía mail de recuperación al front según `clientApp`. Body `EmailValuesDTO`:

| Campo | Tipo | Validación |
|---|---|---|
| `mailTo` | string | `@NotEmpty`, `@Email` (usuario debe existir y estar activo) |
| `clientApp` | enum | `@NotNull` (`BACKOFFICE`\|`PORTAL`) |
| `mailFrom`/`subject`/`userName`/`email`/`token` | string | opcionales (backend los completa) |

```json
{ "mailTo": "user@dominio.com", "clientApp": "PORTAL" }
```
→ **200** `MessageDTO` (2007). Envío `@Async`. **Errores:** `400` (4001) usuario inexistente o inactivo · `400` validación.

**`POST /api/email/change-pass`** — cambia la contraseña vía token del enlace. Body `ChangePasswordDTO`:

| Campo | Tipo | Validación |
|---|---|---|
| `password` | string | `@NotBlank` |
| `confirmPassword` | string | `@NotBlank` |
| `token` | string | `@NotBlank` |

→ **200** `MessageDTO` (2005). **Side effect:** revoca todas las sesiones/refresh tokens del usuario.
**Errores:** `401` (4004) token expirado/inválido · `400` (4012) validación · `400` (4018) `password != confirmPassword` ·
`406` (4034) password no cumple longitud.

**Enum `ClientApp`** (`BACKOFFICE`=Angular, `PORTAL`=React): resuelve las URLs base del enlace del email
(recuperación: `front.url.{backoffice|portal}.recoverpass`; activación: `email.url.active.account.{backoffice|portal}`).
El enlace = `<url-base-según-clientApp>` + `<token>`. **Enviar siempre el `clientApp` de tu app.**

**Flujos de email:** (1) Activación de cuenta — disparada internamente por el registro (no es endpoint),
plantilla `email-activate-account-template`. (2) Recuperación — `POST /api/email/recovery`. Cada envío
persiste una `Notification` (`SENT`/`FAILED`).

**Entidad `Notification`** (`notifications`, interna, no expuesta): `id` Long PK · `subject` · `message` (TEXT) ·
`via` enum `NotificationChannel` (`EMAIL`) · `type` enum `NotificationType` (`WELCOME`, `ACTIVATE_ACCOUNT`, `RECOVERY_PASSWORD`) ·
`destination` · `status` enum (`SENT`, `FAILED`, `PENDING`) · `createdDate`/`updatedDate` · `active` · `user` (FK `user_id`).

### 6.2 Almacenamiento (MinIO) — `MinIOController` (`/api/storage/`)

> 💥 **CAMBIO `ea65b92`:** `/api/storage/**` **ya NO es público** — ahora requiere **autenticación**
> (`Authorization: Bearer <token>`). Sin token → 401.
> 💥 **CAMBIO `d800be0`:** además de autenticación, ambos endpoints exigen el permiso **`READ_STORAGE`**
> (`@PreAuthorize("hasAuthority('READ_STORAGE')")`, antes `hasAnyRole('SUPERADMIN','ADMIN_BACKOFFICE')`).
> Roles con ese permiso en el seed: `SUPERADMIN` y `ADMIN_BACKOFFICE` → **sin cambio funcional**. Sin el permiso → 403.
> ⚠️ El prefijo de clase termina en `/`. Spring normaliza la doble barra; usar `/api/storage/exist/...`
> y `/api/storage/download/...` y **verificar contra el backend en ejecución**.

**`GET /api/storage/exist/{fileName}`** — ¿existe el objeto? → **200** `ResponseDTO<Boolean>` (2013, `data: true|false`).
Cualquier excepción interna se traduce a `false`.

**`GET /api/storage/download/{fileName}`** — descarga binaria. **Produces** `application/octet-stream`.
Devuelve `ByteArrayResource` (cuerpo binario, **no JSON**), con `Content-Length`, `Content-Type: application/octet-stream`,
`Content-Disposition: form-data; name="attachment"; filename="<fileName>"`.
**Errores:** `400` (2011) no existe · `400` (4039) error MinIO · `400` (4041) I/O.

**Subida:** el endpoint `POST /api/storage/upload` está **comentado** (no disponible). Si se reactivara:
campo multipart `"file"`, `multipart/form-data`, devuelve **la clave/nombre del objeto** generado
(`yyyyMMdd-HHmmssSSS_<8charUUID>_<nombreOriginal>`), `MessageDTO` (2010). Límite `15MB`. Sin restricción de MIME en código.

**Convenciones:** bucket = env `DEFAULT_BUCKET`; carpeta base `/` (objetos en la raíz). **No hay presigned URLs.**
El frontend referencia archivos por su **clave/nombre de objeto** y obtiene el binario vía `GET /api/storage/download/{fileName}`.

### 6.3 reCAPTCHA — `RecaptchaController` (`/api/recaptcha`)

**`POST /api/recaptcha/verify-recaptcha`** — body `{ "token": "<recaptcha-token>" }`.
→ **200** `{ "success": true }` (objeto plano, sin wrapper). **Errores:** `400` texto `"Token de reCAPTCHA es requerido"`
si falta token · `400` `{ "success": false, "message": "Error al verificar el reCAPTCHA" }` si falla la verificación.
> reCAPTCHA v3: aprueba si `success` y `score >= RECAP_SCORE`. En dev las claves son dummy, así que este
> endpoint fallará la verificación hasta poner claves reales.

---

## 7. Discrepancias y pendientes (LEER)

### 7.0.2 `origin/dev` @ `23fd8f9` (2026-10-10) — API del núcleo de trámites, etiquetas y portal (PPDT-5.2, 5.4–5.8, 5.10–5.12)

**Resumen:** el backend expuso la API que el backoffice esperaba para Trámites y Etiquetas. `UserController` no
cambió: **`GET /api/user` sigue sin existir** (BO-17).

**Endpoints nuevos de backoffice**

| API | Rutas | Permisos | Roles con el permiso (seed) |
|---|---|---|---|
| Etiquetas `/api/tag` | `GET`, `GET /{id}`, `POST`, `PUT /{id}`, `DELETE /{id}` · `GET /public` (sin auth, solo globales) | `READ/CREATE/UPDATE/DELETE_TAG` (nuevos, `V2.24`) | SA, AB, AO, AGENT |
| Plantillas maestras `/api/procedure-template` | CRUD | `READ/CREATE/UPDATE/DELETE_PROCEDURE` | (existentes) |
| Adopción por organismo `/api/organism-procedure` | CRUD | `READ/CREATE/UPDATE/DELETE_ADOPTION` (nuevos, `V2.20`) | SA, AB, AO |
| Trámite por localidad `/api/organism-procedure-location` | CRUD (`DELETE` con `UPDATE_VARIANT`) · `POST /{id}/submit-review` · `POST /{id}/publish` · `POST /{id}/unpublish` | `READ/CREATE/UPDATE_VARIANT`, `PUBLISH_VARIANT` | (existentes) |
| Puntos de atención `/api/attention-point` | CRUD | `READ/CREATE/UPDATE/DELETE_ATTENTION_POINT` (nuevos, `V2.23`) | SA, AB, AO, AGENT |

**Contratos (campos)**
- **Tag** — response `{ id, slug, local, organismId }`; request `{ slug, organismId? }`. El backend canonicaliza el slug y
  deriva `local`. Errores: `4072` (400, slug en uso en ese alcance) y `4073` (404, etiqueta u organismo inexistente o
  **fuera de alcance**). Alcance: SA/AB ven y gestionan todas; AO/AGENT solo las locales de su organismo (crear con otro
  organismo, o global, → `4073`). El response **no** trae cuántos trámites la usan.
- **ProcedureTemplate** — `{ slugBase*, titleBase*, shortDescription, longDescription, modalityId, mainCategoryId,
  categoryIds[], tagIds[], lifeEventIds[], recipientIds[], active* }` (+ `id` en el response). `slug_base` único (`V2.18`).
- **OrganismProcedure** (adopción) — `{ procedureTemplateId*, organismId*, ownerOrganismId, enabled*, effectiveFrom*,
  effectiveTo }`. Constraint (`V2.19`): `effectiveTo > effectiveFrom` y no puede haber dos adopciones habilitadas con
  vigencias superpuestas para el mismo organismo + plantilla.
- **OrganismProcedureLocation** — request `{ organismProcedureId, locationId, slug, url, requirements, costs,
  publicationStatus, active }`; response `{ id, slug, publicationStatus, active, currentVersionNumber }`. Estados
  (`V2.21`): `BORRADOR → EN_REVISION → PUBLICADO ↔ DESPUBLICADO`.
- **AttentionPoint** — `{ organismProcedureLocationId*, name*, address*, contactInfo, openingHours, latitude*,
  longitude* (NUMERIC 9,6), active* }`.

**Alcance por organismo (PPDT-5.2)** — `OrganismScope` aplicado en los repositorios y servicios del flujo nuevo
(adopciones, trámites por localidad, versiones, puntos de atención) y en `UserService`. Los ABM que ya consumíamos
(organismos, taxonomía, roles) no cambiaron. `V2.17` normaliza `scope_type` de los roles: global = SA, AB, MANAGER, USER;
organismo = AO, AGENT.

**Portal (no backoffice)** — `GET /api/procedure/{slug}` (ficha pública), `POST /api/procedure/{slug}/feedback`
(feedback ciudadano) y filtros avanzados en `GET /api/procedure/search`.

⚠️ **Bug probable en los grants (R-3 / BO-21):** `V2.20`, `V2.23` y `V2.24` asignan permisos con
`WHERE roles.code IN ('ROLE_SUPERADMIN', …)`, pero `V0.4` normalizó los códigos de rol sin prefijo (`SUPERADMIN`, …).
Probablemente ningún rol recibió `*_TAG`, `*_ADOPTION` ni `*_ATTENTION_POINT`. Verificar en base y pedir migración correctiva.

**Front:** Etiquetas conectada a `/api/tag` (BO-16). Trámites y Puntos de atención: plan en `PLAN_TRAMITES_API.md` (BO-15, BO-19).

### 7.0.1 `origin/dev` @ `0ea13a0` (2026-10-08) — PPDT-5.1 "block privilege escalation" — ⚠️ ACCIÓN EN EL FRONT (hecha)

| Cambio | Detalle | Front |
|---|---|---|
| Escritura de roles y permisos → solo `SUPERADMIN` | `POST/PUT/DELETE` de `/api/role` y `/api/permission` pasan a `hasRole('SUPERADMIN')`. `GET` sigue abierto a `SUPERADMIN` y `ADMIN_BACKOFFICE` | **BO-13**: `LEER_ROLES_PERMISOS_ACCESS` (listas, nav) y `ESCRIBIR_ROLES_PERMISOS_ACCESS` (rutas nuevo/editar, "Nuevo", CTA del vacío, acciones de fila, buscador de comandos) en `policy-overrides.constants.ts` |
| Flag nuevo en `Role`: `assignableByBackoffice` (`V2.16`) | En `RoleRequestDTO` y `RoleResponseDTO`. Es un `boolean` primitivo: **un PUT sin el campo lo resetea a `false`**. La migración lo pone en `true` solo para `USER`, `AGENT` y `ADMIN_ORGANIZATION` | **BO-18**: modelo, mapper, mock, toggle "Asignable por Administrador de Backoffice" en el form de rol (se manda siempre) y meta en el detalle de la lista |
| `GET /api/role/allowed` por flags | SUPERADMIN recibe todos. ADMIN_BACKOFFICE recibe los roles con `assignableByBackoffice`, ADMIN_ORGANIZATION los de `assignableByOrgAdmin`. Ya no hay exclusión hardcodeada de SA/AB | Sin cambios: el form de usuario ya consume `/allowed` |
| Usuarios con alcance por organismo para `ADMIN_ORGANIZATION` | En `UserService`: AO solo lee y modifica usuarios de su organismo y **nunca borra** (403 `4029`). SA y AB sin restricción. Crear un usuario con un rol no asignable por el creador → 403 `4029` | Sin cambios hoy: AO no tiene `UPDATE_USER`/`DELETE_USER` en el seed. Relevante para BO-14 |
| `GET /api/user` | **Sigue sin endpoint.** `UserService.findAllUserDTO()` ya existe y filtra por organismo para AO: falta solo el controller | BO-17 abierto |

### 7.0 Relevamiento de `origin/dev` @ `2e41090` (2026-10-06) — 31 commits sobre `d800be0`

**Resumen para el backoffice:** sin endpoints nuevos de backoffice, sin permisos nuevos en el seed y sin cambios
en los controllers que ya consumimos (`AuthController`, incluido `/me`, no cambió). Nada de lo integrado se rompe.

**Nuevo en el backend**
- **Modelo de trámites, sin controllers.** Migraciones `V2.10`–`V2.12`: `procedure_templates`, `procedure_categories`,
  puentes `procedure_tags` / `procedure_life_events` / `procedure_recipients`, `organism_procedures`,
  `organism_procedure_locations`, `otl_versions` y `attention_points`. Existe `OrganismProcedureLocationService` con sus
  DTOs, pero sin controller.
- **Observabilidad y feedback, sin controllers.** `V2.13`–`V2.15`: `audit_events`, `metric_events` y
  `procedure_feedbacks`. `search_logs` quedó alineado al DER: `created_at` → `occurred_at`, `session_id` pasa a uuid,
  `ip_address` a inet, y se quitó `clicked_result_id`.
- **Único endpoint nuevo: `GET /api/procedure/search`.** Es público (`permitAll`) y lo usa el portal, no el backoffice.
  - Query params opcionales: `text`, `organismId`, `locationId`, `categoryId` (UUID; uno inválido → 400 `4026`), `page`,
    `size`, `sort`, `direction`.
  - Header opcional `X-Search-Session-Id` (UUID). Si falta o es inválido se genera uno, que vuelve en la respuesta. CORS
    ahora expone ese header.
  - Respuesta: `ResponseDTO<PaginationResponse<ProcedureSearchResponseDTO>>`.
  - Registra telemetría en `search_logs`: sesión, usuario si hay token, IP y user agent.
- **Docker local reorganizado (`2e41090`).**
  - `docker-compose.dev.yml` (raíz) → `docker/docker-compose.backend-dev.yml`.
  - `docker-compose.front.yml` → `docker/docker-compose.backend.yml`.
  - Infraestructura nueva en `docker/docker-compose.yml`, con pgAdmin en :5050 y MailHog en :8026.
  - Comando: primero `cp docker/.env.docker.example docker/.env.docker`, después
    `docker compose --env-file docker/.env.docker -f docker/docker-compose.yml -f docker/docker-compose.backend-dev.yml up --build`.
  - Postman pasó de `docs/postman/` a `postman/`.

**Errores en la documentación del backend** (`docs/frontend_integration_guide.md`, relevamiento del 2026-08-25)
- Dice "No existe endpoint `/me`": **falso**. `GET /api/auth/me` existe desde `d800be0` y sigue en `dev`.
- Lista `/api/role` como "solo SUPERADMIN", pero el código actual sigue con `hasAnyRole('SUPERADMIN','ADMIN_BACKOFFICE')`.
  Va a cambiar con PPDT-5.1 (ver abajo).

**Anunciado en el backlog del backend (`docs/tasks/backlog_taiga.md`) con impacto en el front**

| Tarjeta | Cambio | Impacto en el backoffice |
|---|---|---|
| PPDT-5.1 (orden 1) | `POST/PUT/DELETE` de `/api/role` y `/api/permission` → solo `SUPERADMIN` | ✅ **Salió en `0ea13a0`** (ver §7.0.1). BO-13 y BO-18 hechos |
| PPDT-5.2 (orden 2) | ✅ **Salió en `545fffa`** (§7.0.2). Aislamiento por organismo | ADMIN_ORGANIZATION y AGENT ven solo su organismo (BO-14) |
| PPDT-5.4 / 5.5 / 5.6 | ✅ **Salió en `23fd8f9`** (§7.0.2). API de plantillas, adopción por organismo, versiones (OTL) y publicación | Desbloquea Trámites. Permisos `CREATE/READ/DELETE_PROCEDURE`. La 5.6 está bloqueada por la decisión D-3: quién aprueba la publicación (BO-15) |
| PPDT-5.8 | ✅ **Salió en `84fde37`** (§7.0.2). API de `Tag` | Coincide con el modelo global/local ya implementado. Suma que un AGENT solo opera etiquetas locales de su organismo (BO-16) |
| PPDT-5.13 / 5.15 / 5.21 | Métricas (`MANAGER`), moderación de feedback, auditoría de cambios sensibles | Desbloquean Dashboard, Feedback y Auditoría |
| PPDT-5.17 | Desactivar los códigos de permiso duplicados en español | Sin impacto: el front ya usa los códigos en inglés |

⚠️ **`GET /api/user` (listado de usuarios) no tiene tarjeta en el backlog del backend.** Hay que pedirlo (BO-17).


Diferencias entre lo que asume el frontend (`CLAUDE.md`, servicios con mocks) y lo que el backend expone hoy:

### 🔥 Cambios introducidos en `d800be0` — ACCIÓN REQUERIDA EN EL FRONT

| # | Cambio | Impacto | Qué hacer |
|---|---|---|---|
| **A** | **RBAC pasó de rol a permiso** en User, Organism, OrganismType, Category, Modality, LifeEvent, Recipient y Storage | Guards y directivas que chequean `hasRole('ADMIN_BACKOFFICE')` **dejan de reflejar** lo que el backend permite | Migrar guards/directivas a **chequeo de permiso**. Mantener chequeo por rol solo en `/api/role` y `/api/permission` |
| **B** | **Códigos de permiso renombrados a inglés** (`V2.9`) | Constantes hardcodeadas en español (`CREATE_ORGANISMO`, `READ_USUARIO`, `VIEW_ANALYTICS_INTELIGENCIA`) **no matchean nada** | Actualizar el enum/constantes de permisos a la tabla de §4.2 |
| **C** | **JWT: claims `roles[]` + `permissions[]`** (arrays), ya no un string separado por comas | El parser del token que hacía `.split(',')` sobre un claim único **rompe** | Dejar de parsear el JWT a mano → usar **`GET /api/auth/me`** (§2). Si igual se decodifica, leer los dos arrays |
| **D** | **`GET /api/auth/me`** nuevo | — | Llamarlo post-login y post-refresh; alimentar el store de sesión con `roles`+`permissions` |
| **E** | **`ADMIN_BACKOFFICE` gestiona roles y permisos** | Se puede habilitar la pantalla de Roles/Permisos a ese rol | Ajustar guard de la ruta; **deshabilitar editar/eliminar el rol `SUPERADMIN`** si el usuario no es SUPERADMIN (403 `4029`) |
| **F** | **`RoleRequestDTO.active` obligatorio en el PUT** y **ignorado en el POST** | Un PUT sin `active` devuelve **400 `4012`**; un POST con `active:false` igual crea el rol **activo** | En el form de edición mandar siempre `active`; en el de creación, no ofrecer el toggle (o avisar que se crea activo) |
| **G** | **`RoleResponseDTO` ahora trae `active`** | — | Agregar el campo al modelo y mostrar el estado del rol en la grilla |
| **H** | **`PUT /api/role/{id}` reemplaza el set completo de permisos** | Mandar `permissionsIds` parcial **borra** el resto | Precargar con `GET /api/role/{id}` y reenviar la lista completa |
| **I** | **`acronym` de organismo: unicidad global** (incluye inactivos) | Reutilizar el acrónimo de un organismo dado de baja ahora falla con **409 `4069`** | Mapear 409 `4069` al campo `acronym` del form |
| **J** | **`PUT /api/user/{id}` (baja lógica) exige `DELETE_USER`**, no `UPDATE_USER` | Botón "desactivar" habilitado con el permiso equivocado → 403 | Condicionar ese botón a `DELETE_USER` |
| **K** | **`ADMIN_ORGANIZATION` ya puede leer usuarios** (`READ_USER`) | Antes 403, ahora 200 | Habilitar la vista de detalle de usuario para ese rol (solo lectura) |
| **L** | **Entidad `Tag` rediseñada** → `{ id, slug, organismId?, local }` | El mock viejo `{ name, description, active }` quedó obsoleto | Adaptar el modelo de `etiqueta.service` (sigue sin endpoint, §5.5) |

> ⚠️ **Nota sobre el orden de migración del front:** A y B van juntas. Si se migra el guard a permisos pero se dejan
> los códigos en español, **todo devuelve "sin permiso"** y el menú queda vacío.

### Cambios introducidos en `ea65b92` (revisar si venías de una versión anterior)

A. **💥 DTOs Role/Permission renombrados a inglés** (§4.3): `codigo`→`code`, `scopeTipo`→`scopeType`,
   `asignablePorOrgAdmin`→`assignableByOrgAdmin`, `descripcion`→`description`. Actualizar interfaces y `roleGuard`.
B. **💥 `Municipality` eliminado → `Location`** (§5.1): `GET /api/municipality` ya no existe (404). Migrar
   `localidad.service` a `GET /api/location` / `GET /api/location/department/{id}`. Modelo ahora jerárquico Department→Location.
C. **💥 `/api/storage/**` ya no es público** (§6.2): ahora requiere Bearer token. `/actuator/**` restringido a `/actuator/health`.
D. **🆕 Nuevos ABMs disponibles** (§5.2, §5.3): Organism/OrganismType (SUPERADMIN), Category/Modality/LifeEvent
   (reads públicos, escritura SUPERADMIN+ADMIN_BACKOFFICE). Cablear `organismo`, `categoria`, `modalidad`, `evento-de-vida`.
E. **🆕 Nuevos códigos de error** 4053, 4055, 4063, 4065–4075 (§1.6) — sobre todo los de jerarquía (ciclos, hijos activos)
   y `4072`/`4073` genéricos de conflicto/not-found en taxonomía.

### Discrepancias / pendientes vigentes

1. **Códigos de rol distintos del `CLAUDE.md`.** El `CLAUDE.md` lista `SUPERADMIN`, `ADMIN_ORGANISMO`, `EDITOR`.
   El backend usa: `SUPERADMIN`, `ADMIN_BACKOFFICE`, `ADMIN_ORGANIZATION`, `AGENT`, `MANAGER`, `USER` (§4.2).
   Recordar: `hasRole('X')` ⇒ autoridad `ROLE_X`; en el claim `roles` y en `/api/auth/me` vienen **con** el prefijo.

2. ~~Trámites/Variantes y Tag siguen sin API~~ — **superado en `23fd8f9`/`84fde37`**: los 4 recursos de trámites y
   `/api/tag` están expuestos (§5.5, §7.0.2). El front los integró (BO-15, BO-16, BO-19); lo que sigue en mock está
   bloqueado por R-3 / G-1 (`PEDIDOS_BACKEND.md`). `tramite.service`/`etiqueta.service` ya no existen.

2-bis. **🚨 El menú del backoffice debe construirse desde `permissions`, no desde el rol.** Con el modelo nuevo,
   `AGENT`, `MANAGER` y `USER` no tienen **ningún** permiso de los ABMs del backoffice: si el menú se arma por rol,
   ven ítems que devuelven 403 al entrar. Y al revés: `ADMIN_BACKOFFICE` **no** tiene permisos de Organismo/Tipo de
   Organismo en el seed (§4.2), así que ese módulo le va a dar 403 aunque el rol "suene" a que puede.

3. **No hay listado/paginado de usuarios** (`GET /api/user`). Solo GET por id. → Falta endpoint en backend.

4. **No hay endpoint de subida de archivos** (`/api/storage/upload` comentado) ni presigned URLs; además storage
   ahora exige auth. Archivos solo por clave + `GET /download/{fileName}` (binario, con token).

5. **Dos formatos de respuesta** (`ResponseDTO`.`details` vs `MessageDTO`.`message`) y **dos de error**
   (`MessageDTO` de negocio vs `ErrorDTO` de seguridad). Normalizar en `http-error.service`. `code` es de negocio, NO el HTTP status.

6. **`refresh` devuelve objeto plano** (sin `ResponseDTO`), distinto de `login`/`activate-account`.

7. **`clientApp` obligatorio** en `register` y `email/recovery` (`BACKOFFICE` para Angular).

8. **✅ Bug 403→500 CORREGIDO** (en `0ecd14e`): un usuario autenticado sin el rol requerido ahora recibe **403**
   correctamente (anónimo → **401** `4025`), vía `ErrorDTO` (`{code, message, date, path, details}`). Ya no hay 500 espurio.
   El `http-error.service` puede mapear 403 = "sin permiso" y 401 = "re-login" de forma confiable.

9. **Usuarios creados por admin quedan activos al instante** (§3): `POST /api/user` crea el usuario con
   `accountActive=true` y **sin** email de activación; puede loguearse de inmediato con el password provisto.
   (El auto-registro `POST /api/auth/register` sigue requiriendo activación por email.)

10. **Detalles a consumir tal cual:** clave `lockeTime` (typo) en `UserResponseDTO`; rutas de storage con posible
    doble barra; `cuit`/`cuil`/`activeAssignments` pueden venir `null`; el password de **register** exige complejidad
    (mayúscula+número+símbolo, ej. `Password123!`) o devuelve 406 (`4034`).

---

## 8. Checklist de integración frontend

Orden sugerido (lo desbloqueado por backend primero):

- [X] **Infra HTTP**: `environment` con `apiUrl=http://localhost:8080`; interceptor que agregue `Authorization: Bearer <access>`.
- [X] **Tipos base**: `ResponseDTO<T>`, `MessageDTO`, `ErrorDTO`, `JwtDTO`. Helper para desenvolver `data`/`details`.
- [X] **Auth** (§2): login → guardar `accessToken`+`refreshToken`; register (con `clientApp`); activate-account; refresh con **rotación** de ambos tokens; logout.
- [X] **Manejo de errores** (§1.6): normalizar `MessageDTO` y `ErrorDTO`; mapear códigos (4025/4064→re-login, 403→sin permiso, 4012→validación).
- [X] **RBAC** (§4.2): actualizar enum de roles y `roleGuard` a los códigos reales; recordar prefijo `ROLE_`.
- [X] **Usuarios** (§3): crear, get por id, cambiar password/email, status, borrado lógico/físico, update-profile propio. (Listado: bloqueado por backend.)
- [X] **Roles y Permisos** (§4): ABM completo (solo SUPERADMIN); `GET /api/role/allowed` para selects de creación de usuarios.
- [X] **⚠️ Migrar Municipios → Localidades** (§5.1): reemplazar `GET /api/municipality` por `GET /api/location` /
  `GET /api/location/department/{id}` en `localidad.service`; modelo Department→Location. *(Feature `localidades` con `/api/department` + `/api/location`; feature `municipios` eliminado. El usuario NO tiene localidad en el backend real → se quitó el select vestigial.)*
- [X] **Recuperación de contraseña** (§6.1): `email/recovery` + `email/change-pass` (con `clientApp`).
- [X] **⚠️ Actualizar RBAC a DTOs en inglés** (§4.3): `code`/`scopeType`/`assignableByOrgAdmin`/`description`. *(DTOs en inglés; VMs internos siguen en español.)*
- [X] **🆕 Departamentos y Localidades** (§5.1): feature `localidades` (facade `departamentos$`/`localidades$`/`localidadesPorDepartamento`). Consumidores UI reales llegan en Tramo 2 (organismos `baseLocation`, trámites).
- [X] **🆕 Taxonomía** (§5.3): features `categorias` (`/api/category`), `modalidades` (`/api/modality`), `eventos-de-vida` (`/api/life-event`) migrados a capas y cableados al backend real. *(UI alineada al contrato real: se removieron campos que el backend no persiste —ícono/color/descripción/orden/toggle-activo/trámites—; se agregó `slug` requerido en categoría/evento.)*
- [X] **🆕 Organismos** (§5.2): features `organismos` (`/api/organism`) + `tipos-organismo` (`/api/organism-type`), ABM completo SUPERADMIN, migrados a capas. *(Contrato real: se removieron sitioWeb/logoUrl; el form de organismo resuelve tipo/padre/localidad-base vía `facade.getFormData()`. Nuevo ítem de nav "Tipos de Organismo".)*
- [X] **🆕 Destinatarios** (§5.4): feature `destinatarios` → `/api/recipient` (reads públicos, escritura SUPERADMIN/ADMIN_BACKOFFICE), migrado a capas, ABM completo + ítem de nav. Catálogo simple `{ id, name }`, seed `persona_humana`/`empresa`/`extranjero`. *(Usuarios creados por admin quedan activos al instante §3 → el form desactiva en cadena si el toggle está en OFF.)*
- [X] **🔥 Migrar el RBAC de ROL a PERMISO** (§4.2, §7-A/B): reemplazar el enum de permisos por los códigos en inglés;
  pasar `roleGuard`/`hasPermission` a chequear `permissions`. Mantener chequeo por rol solo en `/api/role` y `/api/permission`.
- [X] **🆕 Cablear `GET /api/auth/me`** (§2): llamarlo después de `login`, `activate-account` y `refresh`; guardar
  `roles`+`permissions` en el store de sesión y usarlos como **única** fuente del RBAC (no decodificar el JWT).
  Normalizar `roles` quitando el prefijo `ROLE_` si el front compara contra `'SUPERADMIN'`.
  *(Hecho en BO-6: `AuthService.openSession`. `/me` va bajo `/api/auth/`, que el authInterceptor deja sin Bearer, así
  que el token se adjunta a mano. Si `/me` falla, cae al decode del JWT para no bloquear el login.)*
- [X] **🆕 Menú y guards por permiso** (§7-2bis): ocultar cada ítem del backoffice según su permiso concreto
  (`CREATE_CATEGORY`, `READ_ORGANISM`, …) en vez de por rol.
- [X] **🆕 Roles y Permisos — ajustes** (§4.3, §4.4): habilitar la pantalla a `ADMIN_BACKOFFICE`; bloquear editar/eliminar
  el rol `SUPERADMIN` para no-SUPERADMIN (403 `4029`); mandar `active` **obligatorio** en el PUT; agregar `active` al
  modelo de respuesta; recordar que el PUT **reemplaza** todo el set de `permissionsIds`.
- [X] **🆕 Usuarios — ajustes de permisos** (§3.2): botón "desactivar" (`PUT /api/user/{id}`) requiere **`DELETE_USER`**;
  habilitar lectura de usuario a `ADMIN_ORGANIZATION` (`READ_USER`).
  *(Hecho en BO-2/BO-3: la baja lógica `PUT /api/user/{id}` hace lo mismo que `status-account=false` —`editStatusUser(false)`—,
  así que el toggle usa `status-account` con `UPDATE_USER`; "Eliminar definitivamente" usa `DELETE /{id}/admin` con `DELETE_USER`.)*
- [X] **🆕 Organismos — acrónimo** (§5.2): mapear **409 `4069`** al campo `acronym` (unicidad ahora global, incluye bajas).
- [ ] **Storage** (§6.2): descarga por clave **con token + permiso `READ_STORAGE`**; upload bloqueado por backend.
- [ ] **reCAPTCHA** (§6.3): integrar `verify-recaptcha` donde se requiera (necesita claves reales).
- [x] **Trámites y Tag** (§5.5): plantillas y etiquetas en real; adopciones, fichas y puntos de atención con HTTP escrito
  y en mock hasta R-3 / G-1 (`PEDIDOS_BACKEND.md`).
- [ ] **Bloqueado por backend** (§7): listado de usuarios, upload. Coordinar con backend o mantener mocks.

---

*Generado a partir del código de `D:/proyectos/PortalMisiones-backend/backend` @ commit `d800be0` (dev, 2026-07-29);
actualizado con los relevamientos de `origin/dev` @ `2e41090` (§7.0), `0ea13a0` (§7.0.1) y `23fd8f9` (2026-10-10, §7.0.2).
Ante dudas, contrastar con Swagger en vivo (`/swagger-ui.html`) y la colección Postman del backend
(`docs/Portal_Tramite_Misiones.postman_collection.json`, actualizada en `PPDT-20` con los permisos por endpoint).*

*Nota de infraestructura: el backend **no usa Flyway/Liquibase** sino un runner propio (`MigrationQueryRunner`) que
ejecuta `src/main/resources/db/V*.sql` ordenados por versión y registra el **nombre de archivo** en `_migration_history`.
Por eso conviven dos archivos `V2.8__*` (`create_tags` y `soft_delete_life_events`): ambos se aplican.*
