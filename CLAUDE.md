# Portal Provincial de Trámites - Misiones

## Project Overview
Portal de trámites provinciales para la Subsecretaría de Gobierno Inteligente - Vicegobernación de Misiones.
Dos aplicaciones frontend independientes consumiendo la misma API REST.

## Architecture
- **backoffice/** — Angular 17+ (standalone components) — Panel de administración
- **portal/** — Next.js 14 (App Router) — Portal público ciudadano (otro desarrollador)
- **models** —Cada proyecto tiene su propio model en /models

## Backoffice Architecture (Angular 17)
Follows same architecture as JNR project (C:\JNR\jnr-frontend):

```
backoffice/src/app/
├── auth/                    # Auth module (NgModule, lazy-loaded)
├── core/                    # Singleton services, guards, interceptors
│   ├── guards/              # Functional guards (authGuard, roleGuard)
│   ├── interceptors/        # Functional interceptors (auth, httpError)
│   ├── services/            # API services, auth-token facade
│   ├── models/              # TypeScript interfaces
│   ├── enums/               # UserRole enum
│   ├── constants/           # Nav items, routes, role mappings
│   ├── utils/               # Role normalization, route helpers
│   └── errors/              # Custom error classes
├── pages/                   # Feature pages (lazy-loaded via PagesModule)
│   ├── dashboard/
│   ├── tramites/            # plantillas/ (provinciales), adopciones/ (del organismo), fichas/ (por localidad + puntos de atención)
│   ├── organismos/          # ABM: list, create/edit
│   └── usuarios/            # list
├── shared/
│   ├── components/          # Standalone reusable components
│   ├── layouts/             # AdminLayout (Material sidenav)
│   ├── directives/          # appHasPermission, appPageActions, appUnavailable
│   ├── pipes/               # EstadoBadgePipe
│   └── shared.module.ts     # Re-exports Material modules
└── (../shared-styles/)      # Global SCSS en backoffice/src/shared-styles/ (fuera de app/):
                             #   _themes (tokens --theme-*), _mixins, _components (clases globales),
                             #   _material (overrides), _material-theme (tema de Material separado),
                             #   _base, _responsive, _main. `_variables.scss` ya no existe.
```

## Key Patterns
- **Hybrid standalone + NgModule**: New components are standalone, modules for lazy-loading
- **Functional guards & interceptors**: Modern Angular approach (CanActivateFn, HttpInterceptorFn)
- **AuthTokenService facade**: BehaviorSubject for auth state, sync + async accessors
- **SKIP_ERROR_INTERCEPTOR context**: Services opt-out of global error dialog
- **CSS Variables theming**: `shared-styles/_themes.scss` — azul institucional Misiones (#2F6EB1). Referencia de diseño: `DESIGN.md` (fuente visual: Claude Design). **WCAG 2.2 AA gana sobre el diseño** cuando chocan.
- **Features sin backend**: visibles con la directiva `appUnavailable` (`shared/directives/unavailable.directive.ts`: `aria-disabled` + tooltip con el motivo), nunca `disabled` nativo + `title`.
- **RBAC**: roleGuard with route data `{ allowedRoles: [...], redirectTo: '...' }`

## Arquitectura de capas (en migración — ver `migracion_arquitectura.md`)
Modelo objetivo, **por feature (vertical slice)** en `core/features/<feature>/` con subcarpetas por capa:
```
Componente → Facade → Repository → DataSource(interface) → {HttpDataSource | MockDataSource}
mappers + models/view = hojas · barrel index.ts = superficie pública · <feature>.providers.ts = wiring
```
- **Adaptador mock/real**: `environment.dataSource` ('mock'|'local'|'prod') + `featureOverrides`; `provideDataSource` + `InjectionToken` por feature. El DataSource es el único que conoce la fuente.
- **REGLA DURA — RxJS, NUNCA signals**: facades exponen Observables (`async` pipe); one-shot con `firstValueFrom`; `subscribe` manual solo con `takeUntilDestroyed`.
- **Vistas separadas**: `templateUrl` + `styleUrl` siempre (sin inline).
- **Dirección estricta**: 0 deps circulares, 0 deps misma-capa (prohibido `facade→facade`). Cross-feature solo vía barrel `@features/<x>`.
- **Path aliases**: `@core/*`, `@features/*`, `@shared/*`, `@env/*` (tsconfig).
- Detalle accionable en `.claude/rules/` (arquitectura-capas, componentes-angular, scss-bem) y skills `nueva-feature` / `migrar-pantalla`.

## Tooling agéntico del proyecto (`.claude/`)
- **rules/**: constraints path-scoped (arquitectura, componentes Angular, SCSS/BEM).
- **skills/**: `nueva-feature` (scaffolder), `migrar-pantalla`, `checklist-design` (corpus de checklists UI/UX, build o audit).
- **agents/**: `angular-ssr-reviewer`, `arquitecto-capas`, `front-design`. Derivar la revisión/diseño al agente correspondiente.

## Roles (códigos reales del backend — ver BACKEND_API_SPEC.md §4.2)
- SUPERADMIN, ADMIN_BACKOFFICE, ADMIN_ORGANIZATION, AGENT, MANAGER, USER
- El claim `roles` del JWT mezcla roles (`ROLE_*`) y permisos atómicos, coma-separados (ver `core/utils/role.utils.ts`).

## Workflow de Trámites (modelo real — ver `PLAN_TRAMITES_API.md`)
Plantilla provincial (`/api/procedure-template`) → adopción por organismo = "Trámite del organismo" (`/api/organism-procedure`, con vigencia) → ficha por localidad (`/api/organism-procedure-location`) → puntos de atención (`/api/attention-point`). Features: `plantillas`, `adopciones`, `fichas-locales`, `puntos-atencion`.
- Estados de la ficha: `BORRADOR → EN_REVISION → PUBLICADO ↔ DESPUBLICADO`. Quién publica lo decide el permiso `PUBLISH_VARIANT` (no el rol); enviar a revisión con `UPDATE_VARIANT`.
- Plantillas en real; adopciones en mock hasta R-3; fichas y puntos en mock hasta G-1 (`PEDIDOS_BACKEND.md`).

## Commands
- `cd backoffice && npx ng serve` — Dev server (port 4200)
- `cd backoffice && npm run build` — Production build (corre antes `icons:check` + `check:prod-mocks` vía `prebuild`; `npx ng build` directo los saltea)
- `cd backoffice && npm run icons` — Regenerar el subset de Phosphor al agregar íconos (`icons:check` lo valida)
- `cd backoffice && npm run check:circular` — madge: 0 dependencias circulares
- `cd backoffice && npm run lint` — ESLint + boundaries (dirección de capas) sobre `core/features`
- Node version: 20.11.0 (use `nvm use 20.11.0`)

## Conventions
- Spanish for UI labels and model names
- Locale: es-AR
- Date format: DD/MM/YYYY
- Font: Oak Sans declarada (no self-hosted aún) → se renderiza Figtree
- Titles must start with infinitive verbs (Obtener, Inscribirse)
