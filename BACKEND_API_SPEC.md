# Especificación de Integración — Backend Portal Trámite Misiones

> **Propósito de este documento.** Es la especificación completa del contrato REST del backend
> (`PortalMisiones-backend`, Spring Boot + Java 17) para que un agente/desarrollador frontend pueda
> **implementar el consumo de cada endpoint** desde las apps **backoffice (Angular 17)** y **portal (Next.js/React)**.
> Cada endpoint incluye método, ruta, autenticación, request/response y errores. Los schemas de entidad
> sirven para derivar las interfaces TypeScript (`core/models` en Angular, `models/` en cada proyecto).
>
> **Fuente:** generado leyendo el código del backend (controllers, DTOs, entities, `SecurityConfig`,
> `GlobalExceptionHandler`, migraciones SQL). Última actualización: 2026-06-16.

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
- [5. Localidades y Dominio de Trámites](#5-localidades-y-dominio-de-trámites)
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
- **Emisión** (en `POST /api/auth/login` y `POST /api/auth/activate-account`):
  - **Access token**: JWT firmado **HS512**. Claims: `sub`=email, `roles`=authorities separadas por coma
    (clave `roles`), `userId`=UUID, `iat`, `exp`.
  - **Refresh token**: JWT HS512 con `jti` (UUID aleatorio), `sub`, `roles`, `userId`, `iat`, `exp`.
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

**PÚBLICOS (`permitAll`)**:
```
/api-docs.yml  /api-docs/**  /actuator  /actuator/**
/configuration/ui  /configuration/**  /swagger-resources/**  /swagger-ui/**  /webjars/**
/api/auth/**  /api/auth/register
/api/email/activate-account/{token}  /api/email/**
/api/recaptcha/**
/projects/**  /drafts/**
/api/municipality/**  /api/organization-type/**
/api/storage/**  /api/document/**
```

**RESTRICCIONES POR ROL (en orden del filter chain)**:
```
POST /api/user                -> hasAnyRole(SUPERADMIN, ADMIN_BACKOFFICE, ADMIN_ORGANIZATION)
     /api/user/update-profile -> authenticated()
ADMIN_URLS                    -> hasAnyRole(SUPERADMIN, ADMIN_BACKOFFICE)
USER_URLS                     -> hasRole(USER)
anyRequest()                  -> authenticated()
```
- `ADMIN_URLS` = `/admin/**`, `/roles/**`, `/api/user/**`, `/api/role/**`, `/api/users/**`, `/api/roles/**`
- `USER_URLS` = `/user/**`, `/profile/**`
- Hay `@EnableMethodSecurity(prePostEnabled=true)`: además de los matchers, cada endpoint puede llevar
  `@PreAuthorize` propio (documentado por endpoint en cada sección).
- `hasRole('X')` ⇒ la autoridad en el JWT debe venir como `ROLE_X`.
- **Stateless** (sin sesión HTTP), **CSRF deshabilitado**.

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
4064 = El refresh token es inválido o expiró.
5000 = Ocurrió un error inesperado. Contacte al administrador.
5001 = Error al buscar en la base de datos.
```

### 1.7 reCAPTCHA
- **No es un interceptor global.** Solo lo usa el endpoint dedicado `POST /api/recaptcha/verify-recaptcha`
  (público). Login/register **no** invocan reCAPTCHA en el backend. (Detalle en §6.)
- reCAPTCHA v3: aprueba si `success==true` Y `score >= google.recaptcha.score-threshold` (env `RECAP_SCORE`).

---

## 2. Autenticación

Controller `AuthController` — prefijo `/api/auth`. **Todas las rutas son públicas** (sin Bearer token).
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

| # | Método + Ruta | Auth (`@PreAuthorize`) | Propósito |
|---|---|---|---|
| 1 | `POST /api/user` | `hasAnyRole(SUPERADMIN, ADMIN_BACKOFFICE, ADMIN_ORGANIZATION)` | Crear usuario administrativo |
| 2 | `GET /api/user/{id}` | `hasAnyRole(SUPERADMIN, ADMIN_BACKOFFICE)` | Obtener usuario por ID |
| 3 | `PUT /api/user/{id}` | `hasAnyRole(SUPERADMIN, ADMIN_BACKOFFICE)` | Borrado **lógico** (desactivar) |
| 4 | `DELETE /api/user/{id}/admin` | `hasAnyRole(SUPERADMIN, ADMIN_BACKOFFICE)` | Borrado **definitivo** |
| 5 | `PUT /api/user/{id}/change-password` | `hasAnyRole(SUPERADMIN, ADMIN_BACKOFFICE)` | Cambiar contraseña de un usuario |
| 6 | `PATCH /api/user/{id}/change-email` | `hasAnyRole(SUPERADMIN, ADMIN_BACKOFFICE)` | Actualizar email |
| 7 | `PUT /api/user/{id}/status-account` | `hasAnyRole(SUPERADMIN, ADMIN_BACKOFFICE)` | Activar/desactivar cuenta |
| 8 | `PUT /api/user/update-profile` | `isAuthenticated()` | Completar/actualizar perfil propio |

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
  "role": { "id":"uuid","codigo":"string","description":"string","scopeTipo":"string",
            "asignablePorOrgAdmin":true, "permissions":[ /* PermissionResponseDTO */ ] },
  "activeAssignments": [ /* RoleResponseDTO, puede venir null */ ],
  "profileComplete": false
}
```
> ⚠️ El campo timestamp se serializa literal como **`lockeTime`** (typo del backend). `cuit`/`cuil`/
> `activeAssignments` pueden venir `null` (no siempre se pueblan).
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
- Un `Role` agrupa `Permission` vía `role_permissions`. La autorización en endpoints se hace por
  **código de rol** (`@PreAuthorize`), no por permiso individual.
- Scope: solo por **Organización** (no por Municipio). `Role.scopeTipo` declara `global` u `organismo`.

**Enum `RoleScopeType`** (columna `roles.scope_tipo`, CHECK `IN ('global','organismo')`):
`GLOBAL` → `"global"` · `ORGANISMO` → `"organismo"`.

**Role** (tabla `roles`): `id` UUID PK · `codigo` String UNIQUE · `description` · `scopeTipo`
RoleScopeType · `asignablePorOrgAdmin` Boolean · `permissions` Set\<Permission\> (ManyToMany EAGER) · `active` Boolean (col `activo`).

**Permission** (tabla `permissions`): `id` UUID PK · `codigo` String NOT NULL UNIQUE (formato `ACCION_RECURSO`) ·
`descripcion` · `active` Boolean (col `activo`).

**UserRoleAssignment** (tabla `user_role_assignments`): `id` UUID PK · `user` (FK `user_id`, NOT NULL) ·
`role` (FK `role_id`, NOT NULL) · `organization` (FK `organization_id`, **nullable**) ·
`effectiveFrom` LocalDate · `effectiveTo` LocalDate (`NULL`=activa). Constraints: no solapamiento temporal
por `(user, role, organization)`; solo una asignación activa por combinación.

### 4.2 Catálogo (strings exactos para RBAC del frontend)

**Roles** (`codigo` final, SIN prefijo `ROLE_`; Spring `hasRole('X')` ⇒ autoridad `ROLE_X`):

| `codigo` | Descripción |
|---|---|
| `SUPERADMIN` | Superusuario (todos los permisos) |
| `ADMIN_BACKOFFICE` | Admin de backoffice (catálogo + taxonomía global) |
| `ADMIN_ORGANIZATION` | Admin de organización local (variantes, contactos, usuarios locales) |
| `AGENT` | Operador de trámites (lectura + carga parcial) |
| `MANAGER` | Visualizador de estadísticas |
| `USER` | Usuario final |

**Permisos** (`codigo`, formato `ACCION_RECURSO`):
- ORGANISMO: `CREATE_ORGANISMO` `READ_ORGANISMO` `UPDATE_ORGANISMO` `DELETE_ORGANISMO`
- USUARIO: `CREATE_USUARIO` `READ_USUARIO` `UPDATE_USUARIO` `DELETE_USUARIO`
- ROL: `CREATE_ROL` `READ_ROL` `UPDATE_ROL` `DELETE_ROL`
- TRAMITE: `CREATE_TRAMITE` `READ_TRAMITE` `UPDATE_TRAMITE` `DELETE_TRAMITE`
- VARIANTE: `CREATE_VARIANTE` `READ_VARIANTE` `UPDATE_VARIANTE` `DELETE_VARIANTE` `PUBLISH_VARIANTE`
- TAXONOMIA: `CREATE_TAXONOMIA` `READ_TAXONOMIA` `UPDATE_TAXONOMIA` `DELETE_TAXONOMIA`
- CONTACTO: `CREATE_CONTACTO` `READ_CONTACTO` `UPDATE_CONTACTO` `DELETE_CONTACTO`
- INTELIGENCIA: `VIEW_ANALYTICS_INTELIGENCIA`

**Mapeo rol → permisos (seed):** `SUPERADMIN`=todos · `ADMIN_BACKOFFICE`=CREATE/READ/UPDATE_TRAMITE,
CREATE/READ/UPDATE_TAXONOMIA, VIEW_ANALYTICS_INTELIGENCIA · `ADMIN_ORGANIZATION`=CREATE/READ/UPDATE/PUBLISH_VARIANTE,
CREATE/READ/UPDATE_CONTACTO, CREATE/READ_USUARIO, VIEW_ANALYTICS_INTELIGENCIA · `AGENT`=READ/UPDATE_VARIANTE,
CREATE/READ/UPDATE_CONTACTO · `MANAGER`=READ_TRAMITE, READ_VARIANTE, VIEW_ANALYTICS_INTELIGENCIA · `USER`=ninguno.

### 4.3 DTOs
`RoleRequestDTO`: `codigo` (@NotBlank) · `description` · `scopeTipo` (@NotBlank, `"global"`|`"organismo"`) ·
`asignablePorOrgAdmin` bool · `active` bool · `permissionsIds` Set\<UUID\>.
`RoleResponseDTO`: `{ id, codigo, description, scopeTipo, asignablePorOrgAdmin, permissions: PermissionResponseDTO[] }`.
`PermissionRequestDTO`: `codigo` (@NotBlank) · `descripcion` (@NotBlank).
`PermissionResponseDTO`: `{ id, codigo, descripcion }`.

### 4.4 Endpoints — `RoleController` (`/api/role`)

| Método + Ruta | Auth | Respuesta |
|---|---|---|
| `GET /api/role` | `hasRole(SUPERADMIN)` | 200 `ResponseDTO<RoleResponseDTO[]>` (2013) |
| `GET /api/role/{id}` | `hasRole(SUPERADMIN)` | 200 `ResponseDTO<RoleResponseDTO>` (2013) · 404 si no existe |
| `POST /api/role` | `hasRole(SUPERADMIN)` | 201 `ResponseDTO<RoleResponseDTO>` (2001) · body `RoleRequestDTO` |
| `PUT /api/role/{id}` | `hasRole(SUPERADMIN)` | 200 (2002) · body `RoleRequestDTO` |
| `DELETE /api/role/{id}` | `hasRole(SUPERADMIN)` | 200 `ResponseDTO<Void>` (2003, baja lógica) |
| `GET /api/role/allowed` | `hasRole(SUPERADMIN) or ADMIN_BACKOFFICE or ADMIN_ORGANIZATION` | 200 lista de roles asignables (excluye SUPERADMIN y ADMIN_BACKOFFICE) |

### 4.5 Endpoints — `PermissionController` (`/api/permission`)

| Método + Ruta | Auth | Respuesta |
|---|---|---|
| `GET /api/permission` | `hasRole(SUPERADMIN)` | 200 `ResponseDTO<PermissionResponseDTO[]>` (2013) |
| `GET /api/permission/{id}` | `hasRole(SUPERADMIN)` | 200 `ResponseDTO<PermissionResponseDTO>` (2013) · 404 |
| `POST /api/permission` | `hasRole(SUPERADMIN)` | 201 (2001) · body `PermissionRequestDTO` |
| `PUT /api/permission/{id}` | `hasRole(SUPERADMIN)` | 200 (2002) |
| `DELETE /api/permission/{id}` | `hasRole(SUPERADMIN)` | 200 `ResponseDTO<Void>` (2003) |

> Salvo `GET /api/role/allowed`, **todo requiere `SUPERADMIN`**. Sin token → 401; con token sin rol → 403.

---

## 5. Localidades y Dominio de Trámites

> ⚠️ **Estado actual: casi todo el dominio de trámites NO tiene API.** El único endpoint expuesto es
> `GET /api/municipality`. Las entidades existen en la BD pero **sin controllers** (ver §5.3 y §7).

### 5.1 Endpoint disponible

**`GET /api/municipality`** — Obtener todos los municipios. **Público** (en `PUBLIC_URLS`). Sin params/body.
→ **200** `ResponseDTO<MunicipalityResponseDTO[]>` (2013):
```json
{ "details":"...", "code":2013, "data":[ { "id":0, "name":"string", "postalCode":"string" } ] }
```
`MunicipalityResponseDTO` = `{ id: Long, name: String, postalCode: String }` (**no** incluye `active`).
No hay GET por id, POST, PUT ni DELETE de municipios.

### 5.2 Entidades del dominio (schemas para derivar modelos)

**Municipality** (`municipalities`, extiende `Auditable`): `id` Long PK (IDENTITY) · `name` String ·
`active` Boolean (no expuesto) · `postalCode` String (`postal_code`) · `createdAt`/`updatedAt` Instant.

**Procedure** (`procedures`): `id` UUID PK · `name` String UNIQUE NOT NULL · `description` String (TEXT) ·
`tagIds` UUID[] (`tag_ids`, array sin FK real → `Tag`) · `lifeEventIds` UUID[] (`life_event_ids`, array sin FK → `LifeEvent`).
**No tiene estado de workflow propio** — el estado vive en `ProcedureVariant.status`.

**ProcedureVariant** (`procedure_variants`): `id` UUID PK · `procedure` (FK `procedure_id`, NOT NULL) ·
`organization` (FK `organization_id`, NOT NULL) · `municipality` (FK `municipality_id`, **nullable** = fallback provincial) ·
`modality` (FK `modality_id`, nullable) · `requirements` TEXT · `paymentMethod` TEXT (`payment_method`) ·
`steps` TEXT · `procedureUrl` String (`procedure_url`) · `active` boolean (`is_active`) ·
`status` String(50) — **workflow**: valores `BORRADOR`, `PUBLICADO` (string libre, no enum; conceptualmente también "revisión").

**ProcedureVisitLog** (`procedure_visit_logs`): `id` UUID PK · `procedureId` UUID (sin FK) · `timestamp` LocalDateTime ·
`userId` UUID (sin FK) · `ipAddress` String · `userAgent` String(512).

**Modality** (`modalities`): `id` UUID PK · `name` String UNIQUE · `active` boolean (`is_active`).

**LifeEvent** (`life_events`): `id` UUID PK · `name` String UNIQUE · `description` String · `active` boolean (`is_active`).

**Tag** (`tags`): `id` UUID PK · `name` String UNIQUE · `description` String · `active` boolean (`is_active`).

**SearchLog** (`search_logs`): `id` UUID PK · `searchTerm` String NOT NULL · `timestamp` LocalDateTime ·
`userId` UUID (sin FK) · `ipAddress` String · `userAgent` String(512).

> Nota de tipos: todo el dominio de trámites usa PK **UUID**; solo `Municipality` usa PK **Long**.

### 5.3 Pendiente de exponer (sin controller/endpoint REST)
`Procedure`, `ProcedureVariant`, `ProcedureVisitLog`, `Modality`, `LifeEvent`, `Tag`, `SearchLog`.
**Todo el CRUD de trámites, variantes, modalidades, eventos de vida, tags y la lectura de logs requiere
trabajo de API en el backend antes de que el frontend pueda integrarlos.**

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

Diferencias entre lo que asume el frontend (`CLAUDE.md`, servicios con mocks) y lo que el backend expone hoy:

1. **Códigos de rol distintos.** El `CLAUDE.md` del backoffice lista `SUPERADMIN`, `ADMIN_ORGANISMO`, `EDITOR`.
   El backend real usa: `SUPERADMIN`, `ADMIN_BACKOFFICE`, `ADMIN_ORGANIZATION`, `AGENT`, `MANAGER`, `USER`.
   → **Actualizar el enum `UserRole` y los `roleGuard`/constants del frontend** a los códigos reales (§4.2).
   Recordar: `@PreAuthorize("hasRole('X')")` ⇒ autoridad `ROLE_X` en el JWT (claim `roles`).

2. **Todo el CRUD de trámites no existe en el backend.** Los servicios `tramite.service`, `modalidad.service`,
   `etiqueta.service`, `evento-de-vida.service`, `categoria.service`, `organismo.service` no tienen endpoints
   reales detrás (solo `GET /api/municipality`). → Estos quedan **bloqueados por backend**; mantener mocks o
   coordinar la creación de los controllers. Schemas de entidad en §5.2 para ir armando los modelos.

3. **No hay listado/paginado de usuarios** (`GET /api/user`). El backoffice (`usuarios/list`) no puede listar
   usuarios desde la API todavía. Solo hay GET por id. → Falta endpoint en backend.

4. **No hay endpoint de subida de archivos** (`/api/storage/upload` comentado) ni presigned URLs.
   Archivos solo por clave + `GET /download/{fileName}` (binario). → Si el backoffice sube imágenes/PDFs,
   falta reactivar/implementar el upload.

5. **Dos formatos de respuesta** (`ResponseDTO` con `details` vs `MessageDTO` con `message`) y **dos formatos de
   error** (`MessageDTO` de negocio vs `ErrorDTO` de seguridad). El `http-error.service`/interceptor del frontend
   debe normalizar ambos. `code` es de negocio, NO el HTTP status.

6. **`refresh` devuelve objeto plano** (sin `ResponseDTO`), a diferencia de `login`/`activate-account`. Parsear distinto.

7. **`clientApp` obligatorio** en `register` y `email/recovery`. El backoffice debe enviar `BACKOFFICE`; el portal, `PORTAL`.

8. **Detalles a consumir tal cual:** la clave `lockeTime` (typo) en `UserResponseDTO`; rutas de storage con
   posible doble barra; `cuit`/`cuil`/`activeAssignments` pueden venir `null`.

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
- [X] **Municipios** (§5.1): `GET /api/municipality` (público) para selects de localidad.
- [X] **Recuperación de contraseña** (§6.1): `email/recovery` + `email/change-pass` (con `clientApp`).
- [ ] **Storage** (§6.2): descarga por clave; (upload bloqueado por backend).
- [ ] **reCAPTCHA** (§6.3): integrar `verify-recaptcha` donde se requiera (necesita claves reales).
- [ ] **Bloqueado por backend** (§7): trámites/variantes/modalidades/etiquetas/eventos/organismos CRUD, listado de usuarios, upload. Coordinar con backend o mantener mocks.

---

*Generado a partir del código de `D:/proyectos/PortalMisiones-backend/backend`. Ante dudas, contrastar con
Swagger en vivo (`/swagger-ui.html`) y la colección Postman del backend (`docs/Portal_Tramite_Misiones.postman_collection.json`).*
