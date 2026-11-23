---
paths:
  - "backoffice/src/app/**/*.ts"
  - "backoffice/src/app/**/*.html"
---

# Componentes y asincronía (backoffice, Angular 17)

## Hacé
- **RxJS, nunca signals.** `@Input` / `@Output` / `@ViewChild` clásicos. De `rxjs-interop` solo `takeUntilDestroyed`.
- `standalone: true` + `ChangeDetectionStrategy.OnPush` + `templateUrl` + `styleUrl` (singular). Cada componente con su
  `.html` y su `.scss` al lado. Sin estilos propios: el `.scss` lleva solo un comentario que lo dice (ver `scss-bem.md`).
- Dependencias con `inject()` en inicializadores de campo (`private readonly facade = inject(XFacade)`).
- **Estado** (listas, vista, flags derivados): Observable del facade + `async` pipe. Armá un `vista$` con `combineLatest`
  y consumilo con `@if (vista$ | async; as vista)`.
- **Comandos** (cargar, guardar, eliminar):
  - `subscribe` con `takeUntilDestroyed(this.destroyRef)` y `cdr.markForCheck()` al cambiar flags (`loading`, `error`), o
  - `await unaVez(obs$, this.destroyRef)` (`@core/utils/one-shot.utils`) en métodos `async`; el rechazo se ignora solo si
    `esPantallaDestruida(err)`.
  - `firstValueFrom` pelado: solo fuera de componentes (guards) o sobre un stream que ya tiene valor (`BehaviorSubject`).
- Control flow nuevo: `@if`, `@for` (con `track`), `@switch`. Las directivas estructurales propias (`*appHasPermission`) siguen igual.
- Imports con alias `@core/*`, `@features/*`, `@shared/*`, `@pages/*`, `@env/*`. Relativo solo dentro de la misma carpeta o
  un nivel (`../`); nunca `../../`.
- Todo `<button>` con `type`. es-AR, fechas DD/MM/YYYY, textos con voseo (ver `textos-y-errores.md`).
- Antes de crear un componente, pipe o helper: buscá en `@shared/components`, `@shared/utils` y `@core/utils`.

## No hagas
- `signal`, `computed`, `effect`, `input()`, `output()`, `model()`, `viewChild()`, `toSignal`, `toObservable`.
- `template:` / `styles:` inline, `styleUrls` (plural), NgModules nuevos (el único es `pages/pages.module.ts`, solo rutas).
- `subscribe` sin `takeUntilDestroyed`; `subscribe` para llenar una propiedad que el template podría leer con `async`.
- `*ngIf` / `*ngFor` / `*ngSwitch` en código nuevo. `style="…"` inline en templates.
- `HttpClient`, servicios de `core/services`, Repositories o DataSources en un componente; `AuthTokenService` en `pages/`
  (la sesión la expone el facade). `console.log`.
- Orquestar varias llamadas en el componente (`forkJoin` de catálogos): eso es un `getFormData()` del facade.
- `any`, `eslint-disable`, archivos de más de 400 líneas (partí en `components/<pieza>/` o helpers de sección).

Ejemplo canónico: `pages/etiquetas/list/etiquetas-list.component.ts` (+ `.html`).
Lo verifica: `npm run lint` — `no-restricted-imports` (signals, `HttpClient`, relativos `../../`, sesión en `pages/`),
`@angular-eslint/prefer-standalone`,
`component-max-inline-declarations`, `prefer-on-push-component-change-detection`, `no-restricted-syntax` (`styleUrls`),
`template/prefer-control-flow`,
`template/button-has-type`, `template/no-inline-styles`, `max-lines`; y `npm run typecheck`.
