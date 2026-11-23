# Backoffice — reglas para agentes y sesiones nuevas

Angular 17 standalone, sin SSR. Este archivo viaja con el subtree a GitLab; el detalle completo vive en el monorepo
(`CLAUDE.md` y `.claude/rules/*.md`). Molde a copiar: `src/app/core/features/etiquetas/` + `src/app/pages/etiquetas/`.

## Reglas duras
1. **RxJS, nunca signals.** Estado con Observables + `async` pipe; comandos con `takeUntilDestroyed` o `unaVez` (`@core/utils/one-shot.utils`).
2. **Capas**: `Componente → Facade → Repository → DataSource → {Http | Mock}`. La UI importa solo el Facade, del barrel
   `@features/<f>`. `HttpClient` solo en `core/features/<f>/datasources/*.http.datasource.ts`. Sin `facade→facade` ni ciclos.
3. **Árbol**: `core/features/<f>/{index.ts, <f>.providers.ts, models, mappers, domain, datasources, repositories, facades}` y
   `pages/<sección>/{list, form, detail, dialog, components/<pieza>}` (+ `dashboard/home/`) + helpers `-dialogo.ts`, `-save-error.ts`,
   `-accion-error.ts`, `-textos.ts`, `.rutas.ts`. Un componente sin estilos propios deja su `.scss` con solo un comentario que lo explica.
4. **Componentes**: standalone, OnPush, `templateUrl` + `styleUrl`, `inject()`, `@if` / `@for`, alias `@core` `@features` `@shared` `@pages` `@env` (relativo solo `./` o `../`).
5. **SCSS**: BEM `bloque__elemento--modificador` (`&__`, `&--`, nunca `&-`), un prefijo por pantalla (`etiqlist`, `fichadet`), solo
   tokens `var(--theme-*)`, `@include responsive()`. Sin `::ng-deep`, `!important` ni clases de Material fuera de `shared-styles/_material.scss`.
6. **Formularios**: dynamic form siempre (`app-dynamic-form`, o `abrirFormDialog` + `<x>-dialogo.ts`). `readonly` + `hint`, no `disabled`.
7. **Errores**: nunca el `message` del backend; decidir por `API_CODES` con `aplicarErrorDeGuardado`, `textoDeErrorHttp`, `errorDeAccion`.
8. **Permisos**, no roles: `accessGuard` + `data.access`, `*appHasPermission`, `RowAction.permission`.
9. **WCAG 2.2 AA** gana sobre el diseño. Función sin backend: visible con `appUnavailable`. Textos con voseo, es-AR.
10. **Reusar** `shared/components`, `shared/utils`, `core/utils` y las clases de `shared-styles/_components.scss` antes de crear.

## Terminado significa
- **`npm run check`** en verde (`check:fast` mientras trabajás; `check:static` corre en `prebuild`, también en el build de staging).
- Sin `eslint-disable`, sin entradas nuevas en `scripts/*.baseline.json`, sin subir `--max-warnings`, nunca `--no-verify`.
- `stylelint-disable-next-line <regla> -- <motivo>` se permite SOLO por línea y con motivo, para un valor de un único uso que no merece token; nunca un `stylelint-disable` de archivo ni sin motivo.
- Specs del comportamiento nuevo al lado del archivo. Commits `tipo(scope): descripción en español`; nunca sobre `main`.
