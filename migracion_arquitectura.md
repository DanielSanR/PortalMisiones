# Migración del Backoffice a una Arquitectura de Capas

> **Objetivo.** Reorganizar el backoffice (Angular 17) en capas explícitas con un **adaptador de fuente
> de datos (DataSource)** que permite elegir entre **mock / local / producción**, para:
> 1. Aislar a los componentes del contrato real del backend (envelopes `ResponseDTO`, typo `lockeTime`, DTOs anidados, nullables).
> 2. Ocultar el split **mock vs. backend real** detrás de un único punto de decisión configurable.
> 3. Centralizar orquestación (multi-llamada) y estado/caché de datos de referencia.
>
> **No es** una reescritura: es una refactorización incremental, pantalla por pantalla, sin romper lo que funciona.
> Referencias: `BACKEND_API_SPEC.md` (contrato), memoria `jwt-roles-claim-mixto`.

---

## 1. Reglas de arquitectura (innegociables)

1. **Cero dependencias circulares.**
2. **Cero dependencias entre módulos de la misma capa.** Prohibido `facade→facade`, `repository→repository`, `datasource→datasource`.
3. **Flujo unidireccional descendente.** Cada capa solo conoce la inmediatamente inferior (vía *interface*). Nada apunta hacia arriba.
4. **RxJS** como base. **Observables en todo el contrato público** (facades exponen `Observable`; los componentes consumen con `async` pipe, **sin `subscribe` manual**).
   - Las llamadas **one-shot imperativas** (guards, resolvers, lógica secuencial interna de repos/facades) usan **`firstValueFrom()`** → trabajan con Promesas.
   - `subscribe` manual **solo cuando sea estrictamente necesario** (y con `takeUntilDestroyed`).
5. **Vistas separadas.** Todos los componentes usan `templateUrl` + `styleUrl` (sin `template`/`styles` inline).

---

## 2. Estado actual (diagnóstico)

```
Componente  ──►  Service (HTTP + desenvuelve ResponseDTO)  ──►  API (real o mock)
```

- **Componentes** consumen servicios directamente; orquestan multi-call en `ngOnInit` (p. ej. `usuario-form` con `forkJoin`).
- **Servicios reales** (contra `:8080`): `UserAdminService`, `RoleService`, `PermissionService`, `MunicipalityService`, `AccountService`, `StorageService`.
- **Servicios mock** (vía `mockApiInterceptor`): `UsuarioService`, `OrganismoService`, `TramiteService`, `CategoriaService`, `EtiquetaService`, `ModalidadService`, `EventoDeVidaService`, `LocalidadService`, `DashboardService`, `AuditoriaService`, `FeedbackService`, `DestinatarioService`.
- **Modelos**: mezcla de ViewModels de UI y DTOs del backend. **No hay mappers.**
- **Componentes con template/estilos inline**: login, table, confirm-dialog, error-dialog, page-header, loading, dynamic-form*, tramite-preview, etc.
- **Único facade existente**: `AuthTokenService` (sesión + permisos) — patrón de referencia.

---

## 3. Arquitectura objetivo

```
Componente  → consume SOLO Facade (async pipe). Sin HttpClient/Service/Repository/DataSource.
   │  Observable<ViewModel>
Facade      → estado (xxx$ : Observable) + orquestación + caché. Depende de Repository (interface).
   │  Observable<ViewModel>
Repository  → mapea DTO↔VM (vía Mappers). Source-agnostic. Depende de DataSource (interface).
   │  Observable<DTO>
DataSource  → interface con 2 implementaciones:
   │            • HttpDataSource  (HttpClient, desenvuelve ResponseDTO → DTO)
   │            • MockDataSource  (datos en memoria)
   │          La elección (mock|local|prod) la resuelve un InjectionToken por feature.
API         → backend real (:8080)  |  mock en memoria

HOJAS (no dependen de nadie del app): models/dto, models/view, mappers (solo dependen de models).
Coordinación entre features: un facade que necesita otro dominio depende de su **Repository**,
NUNCA del facade de ese dominio (evita facade→facade).
```

### 3.1 Adaptador de fuente — modelo híbrido (decidido)

```ts
// environments/environment.ts
export const environment = {
  // ...
  apiBaseUrl: 'http://localhost:8080',
  dataSource: 'local' as DataSourceKind,        // 'mock' | 'local' | 'prod'  → default global
  featureOverrides: {                           // override por feature
    tramites: 'mock',                           // bloqueado por backend (BACKEND_API_SPEC §7)
    organismos: 'mock',
    // usuarios/roles/municipios: heredan el default (local)
  } as Partial<Record<FeatureKey, DataSourceKind>>,
};
```

- `mock` → `MockDataSource`; `local` / `prod` → `HttpDataSource` (difieren **solo** en `apiBaseUrl`).
- Un **factory provider por feature** resuelve `featureOverrides[feature] ?? dataSource` y provee la
  implementación correcta bajo un `InjectionToken` (`USUARIOS_DS`, `ROLES_DS`, …).
- El **Repository inyecta el token**, nunca una clase concreta → cumple la regla de dirección y permite
  swap mock↔real cambiando solo configuración.

---

## 4. Estructura de carpetas (`core/`) — **por feature (vertical slice)**

Agrupación **por feature**, no por capa. Todo lo de un dominio vive junto; el **sufijo del archivo**
marca la capa (`.datasource`, `.repository`, `.facade`, `.mapper`, `.vm`). Escala mejor con muchas
features y refuerza la regla de no-deps-entre-features.

```
core/
├── config/            data-source.config.ts  (DataSourceKind, FeatureKey, resolveKind, provideDataSource)
├── models/            DTOs del contrato backend (UserResponseDTO, RoleResponseDTO, ...)   [HOJA]
├── utils/             helpers genéricos transversales (role.utils, ...)                   [HOJA]
├── features/
│   ├── usuarios/
│   │   ├── usuario.vm.ts                 ViewModels                          [HOJA]
│   │   ├── usuarios.mapper.ts            DTO↔VM (puro)                       [→ models, vm]
│   │   ├── usuarios.datasource.ts        interface + InjectionToken
│   │   ├── usuarios.http.datasource.ts   impl real (reusa services/)
│   │   ├── usuarios.mock.datasource.ts   impl mock
│   │   ├── usuarios.repository.ts        [→ datasource]
│   │   └── usuarios.facade.ts            [→ repository(s)]
│   ├── organismos/  (organismo.vm · organismos.datasource · .mock · repository)
│   └── roles/ · permisos/ · municipios/ · ...
└── (services/ · auth/ · interceptors/ · guards/ · errors/  se mantienen)
```

> **`mappers` vs `utils`:** el mapper (DTO↔VM) vive en su feature; `utils/` queda sólo para helpers
> genéricos transversales. Así `utils` no se vuelve un cajón de sastre.
>
> Los **servicios reales ya escritos** (`UserAdminService`, `RoleService`, `PermissionService`,
> `MunicipalityService`, `AccountService`, `StorageService`) en `core/services/` se reaprovechan como
> base de los `HttpDataSource` (ya desenvuelven `ResponseDTO`).

---

## 5. Convenciones

- **DataSource**: `XxxDataSource` (interface) · `XxxHttpDataSource` · `XxxMockDataSource`. Devuelven **DTOs** como `Observable`.
- **Repository**: `XxxRepository`. Mapea DTO↔VM. Devuelve **ViewModels** como `Observable`.
- **Facade**: `XxxFacade`. Verbos de caso de uso (`loadList`, `getFormData`, `save`, `toggleStatus`). Expone estado `xxx$`.
- **Mapper**: funciones puras `toVM(dto)`, `toCreateRequest(form)`, `toUpdateRequest(form)`.
- **Modelos**: `XxxResponseDTO`/`XxxRequestDTO` (dto) · `XxxVM` o nombre de dominio (view).
- **Estado**: `BehaviorSubject` privado + `xxx$` público; datos de referencia con `shareReplay(1)`.

---

## 6. Plan por fases

### Fase 0 — Andamiaje (sin cambiar lógica de negocio)  ✅ HECHO
- [x] **0.a Estructura + reglas**: carpetas `config`, `models/view`, `mappers`, `datasources`, `repositories`, `facades` creadas. (Los DTO reales existentes quedan en `models/` — reubicación a `models/dto` diferida para no romper imports; incremental.)
- [x] **0.b Barrido de vistas**: extraído `login` y `auditoria-detail-dialog` a `.html`/`.scss` (eran los únicos 2 con inline). Resto ya usaba `templateUrl`/`styleUrl`. Build limpio.
- [x] **0.c Config de adaptador**: `core/config/data-source.config.ts` (`DataSourceKind`, `FeatureKey`, `resolveKind`, `isMock`, `provideDataSource`) + `environment.dataSource`/`featureOverrides`.
- [x] **0.d Guardarraíles**: script `check:circular` (`madge --circular`) en package.json. **Verificado: 0 ciclos / 101 archivos.**

### Fase 1 — Piloto: Usuarios (deja el molde)  ✅ HECHO
- [x] `models/view/usuario.vm.ts` (UsuarioVM, OrganismoOption, UsuarioFormValue, UsuarioFormData); `mappers/user.mapper.ts` (`toUsuarioVM` absorbe `role` anidado/nullables, `mockUsuarioToVM`, `toCreateUserRequest`).
- [x] `datasources/usuarios.datasource.ts` (interface + token) + `.http` (reusa `UserAdminService`) + `.mock` (reusa `UsuarioService`). Idem `organismos.datasource` + `.mock`.
- [x] `repositories/usuarios.repository.ts` + `organismos.repository.ts` (inyectan token vía `@Inject`).
- [x] `facades/usuarios.facade.ts`: `usuarios$`, `loadUsuarios`, `getFormData(id?)` (organismos + user), `create/update/toggleActive`.
- [x] Refactor `usuarios-list` (async pipe + `firstValueFrom`) y `usuario-form` (orquestación vía facade) → consumen **solo** `UsuariosFacade`. Build + madge OK.
- Nota: `usuarios` corre en **`mock`** (featureOverride) porque el backend no expone listado/update genérico y `create` exige rol→UUID; el `HttpDataSource` queda listo para activarse al cerrar esos gaps.

### Fase 2 — Roles y Permisos  ✅ HECHO
- [x] DataSources/Repos/Facades para roles y permisos. `RolesFacade` combina ambos para el editor de roles.
- [x] Pantallas: lista de roles, form de rol (selector de permisos), lista de permisos.

### Fase 3 — Datos de referencia (caché)  ✅ HECHO (por entidad)
- [x] Caché por entidad en vez de un `CatalogosFacade`: `localidades` (Department→Location) con `shareReplay`;
  las opciones de organismos/tipos/roles se resuelven en el `getFormData()` de cada facade.

### Fase 4 — Recuperación de contraseña  ✅ HECHO
- [x] DataSource/Repo/Facade sobre email (`recovery`, `change-pass`) + pantallas "olvidé"/"restablecer" (feature `cuenta`).

### Fase 5 — Features bloqueadas por backend (trámites, organismos, etc.)  ✅ HECHO (lado front)
- [x] DataSource **mock** + repository + facade por feature (mapean a VM). `featureOverrides` las mantiene en `mock`:
  `tramites`, `etiquetas`, `dashboard`, `auditoria`, `feedback`.
- [ ] Cuando el backend exponga el endpoint: agregar `HttpDataSource` y cambiar el override. Sin tocar facade/componente.

### Fase 6 — Cierre y guardarraíles  ✅ HECHO
- [x] Ningún componente inyecta `HttpClient`/Service/Repository/DataSource (solo facades). Excepción documentada:
  sesión (`AuthService`/`AuthTokenService`) y `LayoutChromeService` (estado de UI del shell).
- [x] `madge --circular` = 0 hallazgos. Reglas de límites activas.
- [x] Borrar servicios/modelos muertos (`dashboard/auditoria/modalidad.service`, `tramite-preview`). `CLAUDE.md` actualizado.
  Los mock services que quedan (`categoria`, `destinatario`, `evento-de-vida`, `organismo`, `tramite`, `localidad`,
  `feedback`, `usuario`) solo los consumen datasources mock (`tramites`, `feedback`, `usuarios`).

---

## 7. Esqueleto de referencia (Usuarios)

```ts
// core/config/data-source.config.ts
export type DataSourceKind = 'mock' | 'local' | 'prod';
export type FeatureKey = 'usuarios' | 'roles' | 'permisos' | 'municipios' | 'tramites' | 'organismos' /* ... */;

export function resolveKind(feature: FeatureKey): DataSourceKind {
  return environment.featureOverrides?.[feature] ?? environment.dataSource;
}
/** Provee Http o Mock según la config, bajo el token del feature. */
export function provideDataSource<T>(token: InjectionToken<T>, feature: FeatureKey, httpClass: Type<T>, mockClass: Type<T>) {
  return { provide: token, useClass: resolveKind(feature) === 'mock' ? mockClass : httpClass };
}
```

```ts
// core/datasources/usuarios.datasource.ts
export abstract class UsuariosDataSource {
  abstract getById(id: string): Observable<UserResponseDTO>;
  abstract create(req: CreateUserRequest): Observable<UserResponseDTO>;
  // ...
}
export const USUARIOS_DS = new InjectionToken<UsuariosDataSource>('USUARIOS_DS');

// core/repositories/usuarios.repository.ts  (mapea, source-agnostic)
@Injectable()
export class UsuariosRepository {
  constructor(@Inject(USUARIOS_DS) private ds: UsuariosDataSource) {}
  getById(id: string): Observable<UsuarioVM> { return this.ds.getById(id).pipe(map(toUsuarioVM)); }
  create(form: UsuarioFormValue): Observable<UsuarioVM> { return this.ds.create(toCreateUserRequest(form)).pipe(map(toUsuarioVM)); }
}

// core/facades/usuarios.facade.ts  (estado + orquestación, Observables)
@Injectable({ providedIn: 'root' })
export class UsuariosFacade {
  private _usuarios$ = new BehaviorSubject<UsuarioVM[]>([]);
  readonly usuarios$ = this._usuarios$.asObservable();
  constructor(private repo: UsuariosRepository, private rolesRepo: RolesRepository, private muniRepo: MunicipiosRepository) {}
  getFormData(id?: string): Observable<UsuarioFormData> {
    return forkJoin({
      rolesAllowed: this.rolesRepo.getAllowed(),
      municipios: this.muniRepo.getAll(),
      usuario: id ? this.repo.getById(id) : of(null),
    });
  }
  // one-shot imperativo (cuando aplique): await firstValueFrom(this.repo.create(form))
}
```

---

## 8. Verificación
- `cd backoffice && npx ng build` limpio tras cada fase/pantalla.
- `npx madge --circular src/app` → **0 ciclos** (regla 1).
- Tests unitarios de mappers (puros).
- Flujo manual: Usuarios crear/editar/desactivar (real `:8080`), listado (mock); selects de rol/municipio.

## 9. Definición de "hecho" (por pantalla migrada)
- El componente consume **solo** su facade (sin `HttpClient`/Service/Repository/DataSource directo).
- La vista está en `.html` + `.scss` (`templateUrl`/`styleUrl`).
- Existe mapper DTO↔VM con su test unitario.
- El `DataSource` es el único lugar que conoce mock vs. real.
- Build limpio + `madge --circular` sin hallazgos + flujo manual verificado.

## 10. Riesgos y mitigaciones
- **Más boilerplate (DTO+VM+DS+Repo+Facade).** Mitigar: mappers chicos; en passthrough plano el repo puede ser fino.
- **Migración a medias.** Mitigar: migrar pantalla **completa** por fase, no a medias.
- **Caché desactualizada** de referencia. Mitigar: `shareReplay(1)` con invalidación explícita tras ABM.
- **Barrido de vistas grande (0.b).** Mitigar: es mecánico; hacerlo aislado y verificar build antes de seguir.

## 11. Decisiones tomadas
- Adaptador: **híbrido** (flag global `dataSource` + `featureOverrides` por feature; DI token resuelve impl).
- Exposición: **Observables en el contrato** (async pipe); `firstValueFrom` para one-shot imperativo.
- Vistas: **barrido completo ahora** a `templateUrl`/`styleUrl`.
- Capas: **Repository + DataSource**, dirección estricta; 0 circulares / 0 misma-capa.
- Foldering: **por feature (vertical slice)** en `core/features/<feature>/`; el sufijo marca la capa.
  El mapper vive en su feature; `utils/` sólo para genéricos. (Decidido tras el piloto.)

---

---

## 12. Estado de implementación (cierre)

### Features migrados al patrón de capas
| Feature | Fuente real | Estado |
|---|---|---|
| `usuarios` | parcial (backend sin listado/update genérico) | **híbrido** (`featureOverrides.usuarios = 'local'`): `create` y `setAccountStatus` van a HTTP real; `list`/`getById`/`update`/`toggleActive`/`changePassword`/`changeEmail`/`deleteDefinitive` delegan al mock dentro del `UsuariosHttpDataSource` (los ids de la lista son del mock). **Salida**: con `GET /api/user`, reemplazar cada delegación por HTTP real (DTOs ya en `usuario.dto.ts`) y quitar `UsuarioService`. |
| `organismos` | ✅ `/api/organism` | **real** (local, SUPERADMIN) + mock. ABM completo (typeId/parent/baseLocation/acronym/active). Facade resuelve `tipoNombre` y orquesta `getFormData()` cross-feature (tipos + localidades + padre). Sigue exponiendo `getOptions()` para usuarios. |
| `tipos-organismo` | ✅ `/api/organism-type` | **real** (local, SUPERADMIN) + mock. ABM completo (name/description/active). `getOptions()` consumido cross-feature por el form de organismos. |
| `roles` | ✅ `/api/role` | **real** (local) + mock dev |
| `permisos` | ✅ `/api/permission` | **real** (local) + mock dev |
| `localidades` | ✅ `/api/department` + `/api/location` | **real** (Department→Location, UUID) + mock; facade **cacheado** (shareReplay). Reemplaza a `municipios` (endpoint `/api/municipality` eliminado). |
| `cuenta` | ✅ `/api/email` | **real** (local) — recuperación de contraseña |
| `modalidades` | ✅ `/api/modality` | **real** (local) + mock. Alineado al contrato real (solo `name`+`active`). |
| `eventos-de-vida` | ✅ `/api/life-event` | **real** (local) + mock. Alineado al contrato real (`slug`+`name`). |
| `categorias` | ✅ `/api/category` | **real** (local) + mock. Jerárquico (`parentId`); árbol derivado en el facade. Alineado al contrato real (`slug`+`name`+`parent`). |
| `destinatarios` | ✅ `/api/recipient` | **real** (local) + mock. Catálogo `{id,name}`, hard-delete (Recipients, `0ecd14e`). ABM completo + nav. |
| `etiquetas` | ✅ `/api/tag` | **real** (BO-16) + mock (semilla propia `etiquetas.mock-data.ts`, forma `TagResponseDTO`; ya no depende de `core/mocks`) |
| `plantillas` | ✅ `/api/procedure-template` | **real** (fase 1, `c194f43`) + mock. Plantilla provincial, alcance global, `*_PROCEDURE` |
| `adopciones` | ✅ `/api/organism-procedure` | **mock hasta R-3** (`featureOverrides.adopciones = 'mock'`, HTTP escrito; fase 2, `4d8f34c`). Facade consulta sesión solo para no pedir organismos sin `READ_ORGANISM` (excepción documentada en `.claude/rules/arquitectura-capas.md`) |
| `fichas-locales` | ⚠️ `/api/organism-procedure-location` (response incompleto) | **mock hasta G-1** (HTTP + workflow escritos; fase 3, `bbb3b52`). Estados `BORRADOR → EN_REVISION → PUBLICADO ↔ DESPUBLICADO` por `PUBLISH_VARIANT` |
| `puntos-atencion` | ✅ `/api/attention-point` | **mock hasta G-1** (se activa junto con fichas para no mezclar ids; R-3 para los grants; fase 4, `bbb3b52`) |
| ~~`tramites`~~ | — | **retirado en la fase 5** de `PLAN_TRAMITES_API.md` (feature, pantallas `list/create/detail`, `tramite.service`, `tramite.model`, rutas del `mockApiInterceptor`). Reemplazado por los 4 features de arriba |
| `dashboard` | sin endpoint | mock (datos de ejemplo en el datasource; el componente solo consume el facade) |
| `auditoria` | sin endpoint | mock (paginado server-side simulado; estado de error en la tabla) |
| `feedback` | sin endpoint (PPDT-5.15) | mock en memoria propio (`feedback.mock-data.ts`); el `FeedbackService` legado se borró en la fase 5 |

Servicios reales inlineados y eliminados: `UserAdminService`, `RoleService`, `PermissionService`,
`MunicipalityService`, `AccountService` (su HTTP vive en el `*.http.datasource` de cada feature).
Servicios mock legados eliminados en la fase 5 de trámites (sin consumidores tras borrar `tramites`): `TramiteService`,
`OrganismoService`, `CategoriaService`, `DestinatarioService`, `EventoDeVidaService`, `LocalidadService`, `FeedbackService`;
y los modelos `tramite.model.ts` / `dashboard.model.ts`. En `core/services` queda como legado solo `UsuarioService`
(+ `mockApiInterceptor` reducido a `/api/usuarios`; `PaginatedResponse` se movió a `usuario.model.ts`).

### Excepciones documentadas (no son violaciones)
- **`UsuariosHttpDataSource` híbrido**: contiene delegaciones al mock (`UsuarioService`) mientras el backend no
  exponga el listado. Es temporal y está acotado a ese archivo; ver la fila de `usuarios` arriba.
- **Auth** (`AuthService`/`AuthTokenService` en `login`, guards, interceptors): infra de sesión/token.
  Queda fuera del patrón de features por decisión del plan. `AuthTokenService` ya cumple rol de facade.
- **`storage.service`**: wrapper real de `/api/storage` sin consumidor aún (listo para features de archivos).

### Deuda pendiente (actualizada tras la fase 5 de trámites, 2026-10-13)
Ninguna pantalla consume mock services directo: todas pasan por su facade.
- **Activar en real (solo sacar el override de `environment*.ts`)**: `adopciones` cuando el backend corrija **R-3**;
  `fichas-locales` + `puntos-atencion` juntos cuando cierre **G-1** (y R-3 para puntos). El HTTP ya está escrito.
- **Sin `HttpDataSource` por falta de endpoint**: `dashboard` (PPDT-5.13), `auditoria` (PPDT-5.21), `feedback`
  (PPDT-5.15) y el **listado/edición de usuarios** (`GET /api/user`, BO-17). Con este último se borran `UsuarioService`,
  el `mockApiInterceptor` y `core/mocks/mock-data.ts`.
- **Composition root**: `app.config.ts` importa cada `<feature>.providers.ts` (no el barrel) por el budget del bundle
  inicial (837 kB / 900 kB); la medición y la decisión están en el comentario del archivo.

### Guardarraíles activos
- `npm run check:circular` (madge) → **0 ciclos**.
- `npm run lint` (ESLint + eslint-plugin-boundaries) sobre `core/features` → dirección de capas enforced.
- Hooks `.claude/settings.json`: PostToolUse `tsc`+`eslint`, Stop `madge`+`ng build`.
- Subagents `angular-ssr-reviewer` / `arquitecto-capas` / `front-design`; skills `nueva-feature` / `migrar-pantalla`.

### Decisiones tras auditoría de arquitectura (agente `arquitecto-capas`)
La auditoría (0 ciclos, 0 facade→facade/repo→repo, sin signals, barrels OK) marcó 3 puntos; resolución:

1. **DataSource devuelve VM (no DTO).** Ratificado como patrón intencional: con fuentes heterogéneas
   (HTTP real vs. mock con formas distintas) cada implementación adapta su origen al VM de dominio;
   el mapper vive en el `*.http`/`*.mock` datasource. El Repository es la costura de inyección/caché
   (thin), no el punto de mapeo. (Corrige la redacción aspiracional previa de §3/§5.)
2. **Composición cross-feature de TIPOS en VMs (hojas).** Permitido vía barrel `@features/<x>` y SOLO
   para tipos (sin runtime/ciclos): `UsuarioFormData` referencia `OrganismoOption`, `RolVM` referencia
   `PermisoVM`. Es composición de VM de orquestación, lint-permitida (feature-model→feature-public).
   La regla "hoja" se refina: una hoja no depende de capas SUPERIORES de su propio feature; puede
   componer TIPOS públicos de otro feature vía barrel.
3. **Features lean sin todas las subcarpetas (excepción documentada):**
   - `organismos`: solo provee `OrganismosRepository` (opciones para selects, consumido por usuarios).
     Sin facade ni mapper propios (mapeo inline en el mock).
   - `cuenta`: command-only (recuperación). Sin VM/DTO propios (usa `MessageDTO` envelope); sin estado.

---

## 13. Guards de auth y RBAC — **autorización POR PERMISO** (refactor)
El RBAC dejó de ser por rol canónico y pasó a ser **por permiso (acción)**. El rol es una autoridad
secundaria (display + un puñado de excepciones de política). Motivación: el backend permite roles custom
y decide por permisos; el modelo viejo (por rol) rechazaba en login a cualquier usuario sin rol canónico.

### Fuente única de verdad
- **`core/utils/authorization.utils.ts`**: `canPerform(ctx, permission)` = tiene el permiso Y —si hay
  excepción— alguno de los roles requeridos. `evaluateAccess(ctx, rule)` evalúa una `AccessRule`. Es la
  ÚNICA función de autorización; la consumen nav, guard y la directiva → consistencia por construcción.
- **`core/constants/policy-overrides.constants.ts`**: `PERMISSION_PREREQUISITES` = lo que la PANTALLA necesita
  leer además del permiso del backend (no endurece la política del backend). Hoy: `CREATE_USER` → `READ_ORGANISM`
  + rol SA/AB/AO (el form carga `/api/organism` y `/api/role/allowed`). `EDITAR_USUARIO_ACCESS` aplica lo mismo
  solo a la ruta de edición y a la acción "Editar" (el resto de acciones de `UPDATE_USER` no lo necesitan).
  Reemplaza a `PERMISSION_POLICY_ROLES` (que restringía todo a SUPERADMIN; el backend solo exige `hasAuthority`).
- **`core/models/access-rule.model.ts`**: `AccessRule = { permissions?, mode?, requireRoles? }`. Sin regla =
  visible/accesible para todo autenticado (Dashboard). `requireRoles` para secciones sin permiso atómico
  (Auditoría, Permisos).

### Sesión y login
- **`AuthUser.role` es nullable** (rol canónico de mayor privilegio o `null` si solo tiene rol custom);
  se agregó `roleCodes[]` (todos los códigos, para display vía `resolveRoleLabel`).
- **Login NO rechaza por rol custom** (se eliminó `InvalidRoleError`). `saveSession` solo propaga error si
  el token no decodifica.
- **Gate de acceso al backoffice**: entra cualquier rol EXCEPTO el visitante `USER` (rol por defecto del
  registro/portal). Regla: `roleCodes.some(c => c !== 'USER') || permissions.length > 0`. Un `USER` puro
  → `NoBackofficeAccessError` → el login muestra "Tu usuario no tiene acceso al panel de administración".

### Guard, nav y botones (mismo motor)
- **`accessGuard`** (`core/guards/access.guard.ts`): guard único (reemplaza `roleGuard`+`permissionGuard`,
  eliminados). Lee `data.access: AccessRule` y evalúa con `evaluateAccess`. `bypassAuthGuards` (dev) lo
  cortocircuita. Todas las rutas de `pages.module.ts` migradas a `{ access: {...}, redirectTo }`.
- **Nav** (`role-mapping.constants.ts`): `NavItem.rule: AccessRule`. `admin-layout` filtra con `evaluateAccess`
  **reactivo** a `getCurrentUser$` (takeUntilDestroyed). Usuarios se muestra con `READ/UPDATE_USUARIO`
  (crear/eliminar NO dan visibilidad).
- **Directiva `*appHasPermission`**: consume `AuthTokenService.can/canAny/canAll` (aplican las excepciones).
  El botón "Nuevo usuario" aplica los prerrequisitos de `CREATE_USER` sin hardcodear el rol.
- **`authGuard`** (sesión válida) sin cambios; sigue en la ruta `dashboard`.
- Eliminados por muertos: `role.guard`, `permission.guard`, `has-role.directive`, `invalid-role.error`,
  y los métodos `hasPermission*`/`getUserRoleSpanish/Display` de `AuthTokenService`.

> **Nota dev**: el gate de login y el filtrado del nav funcionan con `bypassAuthGuards=true` (no dependen
> del guard). Para probar el bloqueo de rutas por deep-link, poné `bypassAuthGuards=false`.

### Flip a PERMISO (listo para cuando el backend pase a `hasAuthority`)
Validado con `arquitecto-capas` + `angular-ssr-reviewer`: la infra ya es permission-first (`AccessRule`,
`canPerform`/`evaluateAccess`, `accessGuard`, `*appHasPermission`). El pase es **cambio de config**:
reemplazar `requireRoles` por `permissions` en `role-mapping.constants.ts` (nav) y `pages.module.ts` (rutas),
según este mapeo (= el estado previo al pivot por rol):

| Módulo | `requireRoles` (hoy) | `permissions` (flip) |
|---|---|---|
| Organismos / Tipos | `[SUPERADMIN]` | lista `['READ_ORGANISMO']` · nuevo `['CREATE_ORGANISMO']` · editar `['UPDATE_ORGANISMO']` |
| Taxonomía (cat/mod/evento/etiq/dest) | `[SUPERADMIN, ADMIN_BACKOFFICE]` | lista `['READ_TAXONOMIA']` · nuevo `['CREATE_TAXONOMIA']` · editar `['UPDATE_TAXONOMIA']` |
| Usuarios | lista `[SA,AB,AO]` · nuevo/editar `[SUPERADMIN]` | lista `['READ_USUARIO','UPDATE_USUARIO']` · nuevo `['CREATE_USUARIO']` · editar `['UPDATE_USUARIO']` |
| Roles | `[SUPERADMIN]` | lista `['READ_ROL']` · nuevo `['CREATE_ROL']` · editar `['UPDATE_ROL']` |
| Trámites | `[SA,AB,AO,AGENT]` | `['READ_TRAMITE']` / `['CREATE_TRAMITE']` / `['UPDATE_TRAMITE']` |
| Feedback / Reportes | `[SA,AB,AO]` | `['VIEW_ANALYTICS_INTELIGENCIA']` |
| Permisos / Auditoría | `[SUPERADMIN]` | **queda `requireRoles`** (no hay permiso atómico en el catálogo §4.2) |

~~Además: revisar si `PERMISSION_POLICY_ROLES` sigue haciendo falta~~ → resuelto en BO-7 (reemplazado por
`PERMISSION_PREREQUISITES`). **Cero cambios** en guard/directiva/store/`authorization.utils`.

**Decisiones de diseño (debate arquitecto + angular-ssr):** NO crear clases `AuthStore`/`PermissionService`
(la separación estado-vs-decisión ya existe: estado en `AuthTokenService`, decisión en funciones puras
`canPerform`/`evaluateAccess`). NO usar `Set<string>` (rompe `JSON.stringify` en localStorage; sin beneficio
a esta escala; se perdería la distinción tipada `roles`/`permissions` que la política necesita). `can*`
síncronos (no Observable): una sola fuente reactiva `getCurrentUser$` + recómputo síncrono. Split opcional a
futuro: extraer `TokenStorageService` (tokens/decode) — NO un servicio de permisos.

---

*Plan vivo: actualizar checkboxes y secciones a medida que se avanza.*