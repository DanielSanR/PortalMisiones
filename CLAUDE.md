# Portal Provincial de Trámites - Misiones

Monorepo de la Subsecretaría de Gobierno Inteligente (Vicegobernación de Misiones). Dos frontends sobre la misma API REST:
- **`backoffice/`** — Angular 17 standalone, sin SSR — panel de administración. **Todo lo de abajo aplica acá.**
- **`public/`** — Next.js (App Router) — portal ciudadano, de otro desarrollador. Tiene su propio `public/CLAUDE.md`.
- `e2e/` — e2e del backoffice contra staging (Playwright para Python).

## Reglas duras del backoffice (el detalle está en `.claude/rules/`, que se carga solo según el archivo)
- **RxJS, nunca signals.** Estado con Observables + `async` pipe; comandos con `takeUntilDestroyed` o `unaVez`.
- **Capas**: `Componente → Facade → Repository → DataSource → {Http | Mock}`. La UI solo ve el Facade, por el barrel `@features/<f>`.
- **Componentes**: standalone, OnPush, `templateUrl` + `styleUrl`, `inject()`, control flow `@if` / `@for`, alias `@core` `@features` `@shared` `@pages` `@env` (relativo solo `./` o `../`).
- **Estilos**: BEM `bloque__elemento--modificador` (`&__`, `&--`, nunca `&-`), un prefijo por pantalla, solo tokens `var(--theme-*)`.
- **Formularios**: siempre el dynamic form (`app-dynamic-form` o `abrirFormDialog` + `<x>-dialogo.ts`); `readonly` + `hint`, no `disabled`.
- **Errores**: nunca el `message` del backend; se decide por `API_CODES` (`aplicarErrorDeGuardado`, `textoDeErrorHttp`, `errorDeAccion`).
- **RBAC por permiso** (no por rol): `accessGuard` + `data.access`, `*appHasPermission`, `RowAction.permission`.
- **WCAG 2.2 AA gana sobre el diseño.** Funciones sin backend: visibles con `appUnavailable`, nunca `disabled` + `title`.
- **Reusar antes de crear**: `shared/components`, `shared/utils`, `core/utils`, clases globales de `shared-styles/_components.scss`.
- UI en español con voseo, es-AR, fechas DD/MM/YYYY. Títulos de trámite con verbo en infinitivo (Obtener, Inscribirse).

| Tema | Regla | Tema | Regla |
|---|---|---|---|
| Capas y alta de un feature | `arquitectura-capas.md` | Textos y errores | `textos-y-errores.md` |
| Componentes y RxJS | `componentes-angular.md` | Accesibilidad | `accesibilidad.md` |
| SCSS, BEM, tokens | `scss-bem.md` | Permisos | `rbac-permisos.md` |
| Árbol de `pages/`, listas, diálogos | `pantallas-lista-dialogo.md` | Specs | `tests.md` |
| Formularios | `formularios-dynamic-form.md` | E2E en staging | `e2e-staging.md` |

Molde a copiar: `core/features/etiquetas/**` + `pages/etiquetas/**`. Diseño: `DESIGN.md`. Contrato: `BACKEND_API_SPEC.md`.

## Mapa del backoffice (`backoffice/src/`)
```
app/auth/             login, recuperar, restablecer, activar (auth.routes.ts, sin NgModule)
app/core/features/<f>/  index.ts · <f>.providers.ts · models · mappers · domain · datasources · repositories · facades
app/core/             config · constants · enums · errors · guards · interceptors · mocks · models · services · utils
app/pages/<sección>/  list | form | detail | dialog | components/<pieza>  (+ helpers -dialogo / -save-error / -accion-error /
                      -textos / .rutas; `dashboard/home/` es la única pantalla sin lista)
                      secciones: dashboard, tramites/{plantillas,adopciones,fichas}, organismos, tipos-organismo, usuarios, roles,
                      permisos, categorias, etiquetas, modalidades, destinatarios, eventos-de-vida, auditoria, feedback,
                      perfil (Mi perfil, de la sesión), preferencias (locales: `core/services/preferencias.service.ts`)
app/pages/pages.module.ts   único NgModule: rutas lazy (`loadComponent`) bajo AdminLayout
app/shared/           adapters · components · directives · guards · layouts · pipes · utils   (todo standalone)
shared-styles/        _themes (tokens) · _mixins · _components (clases globales) · _material (overrides) · _material-theme
environments/         environment{,.local,.staging,.prod}.ts → dataSource + featureOverrides ('mock' | 'local' | 'prod')
```
- Sesión: `AuthTokenService` (`BehaviorSubject`); el claim `roles` del JWT mezcla roles `ROLE_*` y permisos (`core/utils/role.utils.ts`).
- Error global: `httpErrorInterceptor` abre un diálogo; una escritura que muestra su propio error usa `sinDialogoGlobal()`.
- Roles del backend: SUPERADMIN, ADMIN_BACKOFFICE, ADMIN_ORGANIZATION, AGENT, MANAGER, USER.

## Trámites (modelo real — `PLAN_TRAMITES_API.md`)
Plantilla provincial (`/api/procedure-template`) → adopción = "Trámite del organismo" (`/api/organism-procedure`, con vigencia) →
ficha por localidad (`/api/organism-procedure-location`) → puntos de atención (`/api/attention-point`).
Features: `plantillas`, `adopciones`, `fichas-locales`, `puntos-atencion`.
- Ficha: `BORRADOR → EN_REVISION → PUBLICADO ↔ DESPUBLICADO`. Publica quien tiene `PUBLISH_VARIANT`; envía a revisión `UPDATE_VARIANT`.
- La cadena va toda con la misma fuente (se referencia por ids): mock en `ng serve`; real en `start:local`, staging y prod
  (backend >= `586b670`). Siguen en mock en todos los entornos: `dashboard`, `auditoria`, `feedback`.

## Comandos (`cd backoffice`, Node 20.11.0 — `nvm use`)
- `npx ng serve` (mock, :4200) · `npm run start:local` (backend local) · `npm run start:staging` (proxy a staging)
- **`npm run check`** — fuente única: typecheck + lint + estilos + estructura + madge + íconos + mocks de prod + tests + build.
  `npm run check:fast` (sin tests ni build) mientras trabajás; `npm run check:static` es lo que corre `prebuild`.
- `npm run icons` — regenerar el subset de Phosphor al usar un ícono nuevo.

## Terminado significa
- `npm run check` en verde. Sin `eslint-disable`, sin entradas nuevas en `scripts/*.baseline.json` ni subir
  `--max-warnings` (esos topes solo bajan), y nunca `--no-verify`.
- `stylelint-disable-next-line <regla> -- <motivo>` se permite SOLO por línea y con motivo, para un valor de un único uso que no merece token; nunca un `stylelint-disable` de archivo ni sin motivo (`.claude/rules/scss-bem.md`).
- Specs del comportamiento nuevo, y la UI alineada al contrato real (no mostrar campos que el backend no persiste).
- Commits `tipo(scope): descripción en español`. Rama nueva, nunca sobre `main`. Commit y push **solo si el usuario lo pide**.

## Subida
- GitHub `origin` = este monorepo. GitLab `gitlab-backoffice` recibe el `git subtree split --prefix=backoffice` (ramas `dev` y
  `staging`); `.claude/` no viaja: las reglas mínimas van en `backoffice/AGENTS.md`.
- Staging se construye con `npm run build -- --configuration=production` en `node:20-alpine`: `prebuild` (`check:static`) corre ahí.

## Tooling agéntico (`.claude/`)
- **agents** (backoffice): `angular-ssr-reviewer` (revisión de cada cambio), `arquitecto-capas` (capas y foldering), `front-design` (UI).
  `frontend-developer`, `senior-frontend-architect` y `ui-ux-designer` son solo para `public/`.
- **skills** (backoffice): `nueva-feature`, `nueva-pantalla-lista`, `nuevo-formulario`, `cablear-backend-real`, `checklist-design`.
  `senior-frontend` y `frontend-design` son solo para `public/`.
