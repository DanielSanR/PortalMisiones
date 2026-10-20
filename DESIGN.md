# Design System — Backoffice Misiones

Referencia de diseño del **backoffice** (Angular 17 + Angular Material 17, SCSS BEM). El portal ciudadano
(`portal/`, Next.js) tiene su propio sistema y no se rige por este documento.

## 1. Propósito y fuente de verdad

- **Visual:** proyecto de Claude Design https://claude.ai/design/p/84343836-e4c6-4d6f-af3b-9c6a09fd8b64,
  archivos **"Kitchen Sink — Design System Misiones"** (`kitchen-sink.dc.html`: fundaciones, componentes y bloque
  Handoff de tokens) y **"Pantallas backoffice"** (`pantallas-backoffice.dc.html`: pantallas aplicadas).
- **Código (lo que manda en runtime):** `backoffice/src/shared-styles/`
  - `_themes.scss` — tokens `--theme-*` (CSS custom properties en `:root`).
  - `_mixins.scss` — mixins (no emite CSS). Importar con `@use 'shared-styles/mixins' as *;`.
  - `_components.scss` — clases globales compartidas (`.list-toolbar`, `.state-panel`, `.row-action`…).
  - `_material.scss` — overrides globales de Angular Material vía tokens.
  - `_material-theme.scss` — paletas/densidad de Material y un `mat.*-theme` por módulo usado.
  - `_base.scss`, `_responsive.scss`, `_main.scss` (orden de carga).
- **Precedencia:** **WCAG 2.2 AA gana sobre el diseño** cuando chocan. Los desvíos aplicados están marcados con
  "a11y" en `_themes.scss` y en las tablas de color de abajo.
- Si este documento y `_themes.scss` difieren, vale `_themes.scss`; corregí este archivo.

## 2. Principios

1. **Plano con borde fino.** Las superficies de contenido son planas (borde 1px `--theme-border-primary`); la sombra
   solo aparece cuando algo flota (menú, diálogo, snackbar).
2. **El azul institucional es presencia, no decoración.** `#2F6EB1` en acción principal, foco, barra de acento y
   nav activo. Sin gradientes.
3. **Densidad cómoda.** Controles de 34px, inputs de 40px, filas de tabla de 56px.
4. **Jerarquía tipográfica sobria**, por rol (no tamaños sueltos).
5. **Todo por token.** Nada de hex/px mágicos si existe un token o mixin.
6. **Honestidad de datos.** Lo que no tiene backend se ve, pero se marca: `appUnavailable` (controles),
   `<app-example-data-pill>` y `<app-gate-label>` (widgets con datos de ejemplo).

## 3. Color

Tema **solo claro**. Contrastes calculados sobre blanco salvo indicación.

### 3.1 Marca — escala azul (`--theme-primary-50…900`)
`50 #E8F1FA · 100 #C5DCF2 · 200 #9EC4E8 · 300 #77ABDE · 400 #5A98D6 · 500 #3B82C4 · 600 #2F6EB1 · 700 #245A95 · 800 #1A4779 · 900 #0F335D`

| Token | Hex | Uso | Contraste |
|---|---|---|---|
| `--theme-primary` | `#2F6EB1` (600) | Botón primario, links, foco, acento | 5.27:1 (blanco encima: 5.27:1) |
| `--theme-primary-dark` | `#245A95` (700) | Hover del primario; texto de botón secundario y de `.row-action` | 7.07:1 |
| `--theme-primary-darker` | `#1A4779` (800) | Active del primario; `--theme-nav-item-active-fg` | 9.45:1 |
| `--theme-primary-light` / `--theme-accent` | `#3B82C4` (500) | Íconos de formulario (`--theme-form-icon`) | — |
| `--theme-surface-inverse` | `#0F335D` (900) | Solo hero de Login y tints oscuros | — |

### 3.2 Superficies y bordes

| Token | Hex | Uso |
|---|---|---|
| `--theme-surface-app` / `--theme-surface-card` / `--theme-bg-card` | `#FFFFFF` | Contenido, cards |
| `--theme-bg-sidebar` | `#F7F9FB` | Sidebar claro |
| `--theme-surface-sunken` / `--theme-table-header-bg` | `#F7F9FB` | Header de tabla, wells |
| `--theme-bg-table-hover` / `--theme-table-hover-bg` | `#F7F9FB` | Hover de fila |
| `--theme-bg-sidebar-hover` | `#EDF1F5` | Hover de nav |
| `--theme-surface-canvas` | `#E8EBEF` | Marco exterior del shell |
| `--theme-border-primary` | `#E6E9ED` | Borde de card, divisor 1px (decorativo, 1.22:1) |
| `--theme-border-subtle` | `#F1F3F5` | Divisor de fila |
| `--theme-border-strong` | `#C9CFD6` | Hover de botón/iconbtn (decorativo, 1.57:1) |
| `--theme-border-input` | `#8A94A0` | **a11y:** contorno de inputs/selects (3.08:1, SC 1.4.11). El diseño usa `#C9CFD6` |
| `--theme-border-focus` | `#2F6EB1` | Borde en foco |

### 3.3 Texto

| Token | Hex | Uso | Contraste |
|---|---|---|---|
| `--theme-text-primary` | `#1A1A2E` | Texto principal | 17.06:1 |
| `--theme-text-secondary` | `#5F6368` | Texto secundario, íconos de toolbar | 6.05:1 |
| `--theme-text-tertiary` | `#6B7280` | **a11y:** meta, captions, header de tabla. El diseño usa `#9AA0A6` (2.64:1, falla) | 4.83:1 (4.58:1 sobre sunken) |
| `--theme-text-disabled` | `#BDBDBD` | Solo controles deshabilitados (exentos de contraste) | 1.88:1 |
| `--theme-text-link` | `#2F6EB1` | Links | 5.27:1 |
| `--theme-text-on-primary` | `#FFFFFF` | Texto sobre primary | 5.27:1 |

### 3.4 Semánticos

| Estado | Fondo | Borde | Texto | Ícono / punto |
|---|---|---|---|---|
| success | `--theme-success-bg` `#F0FDF4` | `--theme-success-border` `#86EFAC` | **a11y:** `--theme-success-text` `#166534` (6.81:1) | `--theme-success` `#16A34A` (3.30:1: **nunca como texto**) |
| error | `--theme-error-bg` `#FFEBEE` | `--theme-error-border` `#EF9A9A` | `--theme-error-icon` `#C62828` (5.62:1) / `--theme-error` `#D32F2F` (4.98:1) | `--theme-error-icon` |
| warning | `--theme-warning-bg` `#FFF3E0` | `--theme-warning-border` `#FFCC80` | `--theme-warning-text` `#BF360C` (5.11:1 sobre su bg) | `--theme-warning` `#E65100` (3.79:1: no como texto) |
| info | `--theme-info-bg` `#E8F1FA` | `--theme-info-border` `#9EC4E8` | `--theme-primary-darker` `#1A4779` (8.28:1 sobre su bg) | `--theme-info` `#2F6EB1` |

Destructivo (botones): `--theme-warn` `#D32F2F` / hover `--theme-warn-dark` `#B71C1C`.

### 3.5 Estados de publicación (fichas)
Tokens `--theme-estado-{borrador|revision|publicado|despublicado}-{bg|text|border|icon}`; todos los `-text` ≥ 4.5:1
sobre su `-bg`. Se pintan con `<app-estado-badge [estado]="…">` (recibe el `PublicationStatus` del backend; la
etiqueta sale de `EstadoBadgePipe`). No recrear el badge a mano.

| Estado | bg | text | icon |
|---|---|---|---|
| Borrador | `#FFF3E0` | `#BF360C` | `#E65100` |
| En revisión | `#E8F1FA` | `#1A4779` | `#2F6EB1` |
| Publicado | `#F0FDF4` | `#166534` | `#16A34A` |
| Despublicado | `#FFEBEE` | `#B71C1C` | `#C62828` |

### 3.6 Datos y otros
- Series: `--theme-chart-1…6` (`#1A4779 #2F6EB1 #77ABDE #C5DCF2 #0F8A8A #7C5CBF`); histórico
  `--theme-chart-historic` `#5A98D6` (tramo reciente en `--theme-chart-2`). Nunca donut con más de 4 categorías.
- Skeleton: `--theme-skeleton-base` / `--theme-skeleton-highlight`.
- Snackbar: `--theme-snackbar-{success|error}-{bg|icon|action}`; se aplica con
  `panelClass: 'snackbar-success' | 'snackbar-error' | 'snackbar-warning'`.

## 4. Tipografía

- **Familia:** `--theme-font-family: 'Oak Sans', 'Figtree', …`. **Oak Sans está declarada pero NO self-hosted**
  (no hay `@font-face`, ver `_base.scss`), así que **lo que se renderiza es Figtree** (Google Fonts en `index.html`).
  Cuando estén los archivos de Oak Sans, agregar el `@font-face` en `_base.scss`; no cambiar la familia.
- Mono: `--theme-font-mono` (JetBrains Mono).
- Números en tablas y métricas: `font-variant-numeric: tabular-nums`.

### Escala por rol (usar estos tokens)

| Rol | Tamaño / peso | Tokens | Uso |
|---|---|---|---|
| Page title | 16 / 600, −0.1px | `--theme-font-page-title-size/-weight/-tracking` | Título en el topbar |
| Display | 26 / 600, −0.3px | `--theme-font-display-size/-weight/-line-height/-tracking` | Título grande de página |
| Section | 17 / 600, −0.2px | `--theme-font-section-size/-weight/-line-height/-tracking` | Bandas del Home, H2 |
| Card title | 13.5 / 600 | `--theme-font-card-title-size/-weight` | Header de widget/card |
| Metric | 26 / 600 | `--theme-font-metric-size/-weight` | KPI |
| Subtitle | 15 / 400 | `--theme-font-subtitle-size/-weight/-line-height` | Subtítulo de page-header |
| Body | 13.5 / 400, lh 1.5 | `--theme-font-body-size/-weight/-line-height` | Texto general, celdas |
| Small | 12.5 / 400 | `--theme-font-small-size/-weight/-line-height` | Metadatos, ayudas |
| Caption | 11.5 | `--theme-font-caption-size` | Header de tabla, badges, meta |
| Overline | 11 / 600, +0.5px, MAYÚSCULA | `--theme-font-overline-size/-weight/-line-height/-track` | Label de campo (`@include field-label-overline`) |

La escala cruda (`--theme-font-size-2xs…3xl`, 11→30px) y los pesos (`--theme-font-weight-*`) quedan para casos sin
rol. Mixins de texto: `text-heading`, `text-body`, `text-caption`, `truncate`, `line-clamp($lines)`.

## 5. Espaciado y medidas

| Token | px | Uso |
|---|---|---|
| `--theme-space-2xs` / `-xs` / `-sm` | 2 / 4 / 8 | Gaps internos |
| `--theme-space-gap` | 12 | Gap de fila / entre controles |
| `--theme-space-md` | 16 | Padding estándar |
| `--theme-space-card` | 18 | Padding de card |
| `--theme-space-lg` / `-xl` | 24 / 32 | Secciones |
| `--theme-space-band` | 30 | Entre bandas del Home |
| `--theme-space-2xl` / `-3xl` | 48 / 64 | Separaciones grandes |

- Alturas: `--theme-control-height-md` 34 (botón, chip, iconbtn) · `--theme-control-height-sm` 30 (acción de fila) ·
  `--theme-input-height` 40 · `--theme-table-row-height` 56 · `--theme-header-height` 60 · `--theme-sidebar-width` 260.
- Ancho: `--theme-content-max-width` / `--theme-form-max-width` 1400.
- Responsive solo con `@include responsive(mobile | tablet | tablet-down | desktop | wide)`.
- Grids con `fr`: `minmax(0, Nfr)` para que los tracks puedan encogerse.

## 6. Radios

| Token | px | Uso |
|---|---|---|
| `--theme-radius-sm` | 4 | Detalles chicos |
| `--theme-radius-md` | 8 | Botones, inputs, iconbtn, row-action, snackbar |
| `--theme-radius-panel` | 10 | Cards (`@include theme-card`), contenedor de tabla |
| `--theme-radius-lg` | 12 | Diálogos |
| `--theme-radius-full` | pill | Badges, chips |

## 7. Elevación

| Token | Valor | Uso |
|---|---|---|
| `--theme-elevation-0` | `none` | Card plana (el borde lo pone el contenedor) |
| `--theme-elevation-1` | `0 1px 2px rgba(15,51,93,.06)` | Nav activo (`--theme-nav-item-active-shadow`) |
| `--theme-elevation-2` | = `--theme-shadow-md` | Menú, popover, panel de select |
| `--theme-elevation-3` | = `--theme-shadow-dialog` | Diálogo |

`--theme-shadow-snackbar` para el toast. No usar `--theme-shadow-card` en cards nuevas (el diseño es plano).

## 8. Iconografía

- **Phosphor Icons, peso regular**, único set. Markup: `<i class="ph ph-<nombre>" aria-hidden="true"></i>`.
  En `RowAction.icon` y en `emptyIcon` de `app-shared-table` va el nombre **sin** el prefijo `ph-`.
- Tamaños: `--theme-icon-size-sm` 16 (botones) · `--theme-icon-size-md` 17 (toolbar) · `--theme-icon-size-lg` 20 (nav).
  Spinner: `ph ph-spinner-gap spin`.
- **Subset:** se está reemplazando la hoja completa de `@phosphor-icons/web` por un subset generado con
  `npm run icons` (en `backoffice/`). **Al agregar un ícono nuevo hay que volver a correr `npm run icons`**, o el
  glifo no aparece.
- Catálogo de nombres por uso: Kitchen Sink §09 (ej. `pencil-simple` editar, `trash` eliminar, `download-simple`
  exportar, `arrow-square-out` ver en el portal, `warning-circle` error, `arrow-clockwise` reintentar,
  `cloud-slash` sin conexión).
- Nunca emojis. No usar Material Icons/Symbols en pantallas nuevas.

## 9. Componentes (qué usar)

### Botones (Material + overrides de `_material.scss`)

| Variante | Markup | Notas |
|---|---|---|
| Primario | `mat-flat-button color="primary"` | 34px, 13/600, ícono 16 gap 7. Hover 700, active 800 |
| Secundario | `mat-stroked-button color="primary"` | Fondo blanco, borde `--theme-border-primary`, texto 700; hover `--theme-btn-secondary-hover-bg` |
| Ghost | `mat-button color="primary"` | Sin borde ni fondo |
| Peligro | `mat-flat-button color="warn"` | Solo acciones destructivas confirmadas |
| Ícono de toolbar | `<button class="list-iconbtn" aria-label="…">` | 34×34 |
| Ícono + texto en toolbar | `<button class="list-ghost-button">` | Ej. "Más filtros" |

Loading: el ícono pasa a `ph-spinner-gap spin` y el texto a gerundio ("Guardando…", "Eliminando…").

### Inputs y formularios
- `mat-form-field appearance="outline"` **sin `<mat-label>`**: el label va afuera, como overline.
  ```html
  <div class="form-field">
    <label class="form-field__label" for="nombre">Nombre <span class="form-field__required">*</span></label>
    <mat-form-field appearance="outline">…</mat-form-field>
  </div>
  ```
  Opcional: `.form-field__optional`; inválido: `.form-field.is-invalid`; error inline con la directiva
  `appFormErrorMessage` (ícono `ph-warning-circle` + texto es-AR) o `.form-error` / `.form-field__error`, en
  `--theme-error-icon`.
- Layout: `.form-card`, `.section-header` (con barra de acento, `@include accent-bar`), `.form-grid` (`--full`),
  `.form-actions` (`__help`, `__buttons`), resumen de errores `<app-form-error-banner>`.
- Formularios dinámicos: `<app-dynamic-form>` / `<app-dynamic-form-field>`.
- Diálogo con formulario: `@include form-dialog($width)`.

### Lista: encabezado, toolbar y tabla
- Encabezado: `<app-page-header>` (+ directiva `appPageActions` para las acciones de página).
- Toolbar (clases globales, no redefinir): `.list-toolbar` (`--stacked`) › `.list-toolbar__row` (`--chips`) ›
  `<app-list-search>`, `.list-toolbar-count` (`--end`), `.list-toolbar__actions` › `.list-iconbtn`. Fila de chips:
  `<app-filter-tabs>`, `<app-active-filters>`, `.list-ghost-button`.
- Tabla: `<app-shared-table>` con `appTableCell` / `appTableHeader`. Trae skeleton (`loading`), vacío
  (`emptyIcon`, `emptyTitle`, `emptyMessage`, `emptyActionLabel`), error con reintento (`error`, `errorTitle`,
  `errorMessage`) y paginación (`paginated`). Header sentence case 11.5/600 tertiary; filas 56px; hover
  `--theme-table-hover-bg`. Contenedor: `.table-container` / `@include table-container`.

### Acciones de fila
`<app-row-actions [primary]="editar" [actions]="resto">` (`RowAction`: `label`, `icon`, `run`, `permission`/`rule`,
`danger`, `disabled`). Clases globales `.row-actions`, `.row-action` (`--icon`, `--danger`): 30px de alto; tooltip
obligatorio en las de solo ícono. Acción bloqueada por regla de negocio (ej. rol SUPERADMIN): `disabled` con el
motivo visible.

### Badges y chips
- Publicación: `<app-estado-badge>`.
- Booleano: `.bool-badge` (`--active` / `--inactive`) con `.bool-badge__dot`.
- Permisos: `.perm-chip` agrupados en `.perm-group`.
- Placeholder: `<app-example-data-pill>`, `<app-gate-label source="…" permission="…">`.
- Badge nuevo: `@include estado-badge($bg-var, $text-var, $border-var)`.

### Estados (carga / vacío / error)
- Dentro de una card: `.state-panel` › `__icon` (`--error`), `__title`, `__text`, `__cta` (círculo 56, ícono 28,
  título 15, texto 12.5 máx. 250px). Error: `role="alert"` + "Reintentar" (`ph-arrow-clockwise`).
- Form/detalle que no carga o no existe: `.load-state`.
- Carga: skeleton en tablas (`--theme-skeleton-*`); `<app-loading>` para bloques.
- Mensaje inline: `@include inline-message`.
- Copys es-AR con voseo: "Todavía no hay organismos" · "No pudimos cargar los organismos" · "Revisá tu conexión e
  intentá de nuevo."

### Overlays
- Confirmación: `ConfirmDialogComponent` (`app-confirm-dialog`) con `ConfirmDialogData` (`highlight` resalta el
  objeto afectado, `danger`, `confirmAction` async + `busyText`). Título en pregunta ("¿Eliminar el organismo?"),
  consecuencia explícita, botones "Cancelar" / "Sí, eliminar".
- Error global: `app-error-dialog` (lo abre el interceptor; un servicio puede optar por `SKIP_ERROR_INTERCEPTOR`).
- Diálogos: radio `--theme-radius-lg` y sombra `--theme-elevation-3` (global en `_material.scss`).
- Snackbar: `panelClass` `snackbar-success` / `snackbar-error` / `snackbar-warning`.
- Menús: `mat-menu`; ítem destructivo con `.delete-action`.

### Features sin backend
Los controles de funciones pendientes (Ordenar, Exportar, Más filtros, CTA del Home, "Ver en el portal", ítems de
menú placeholder) quedan **visibles** con la directiva `appUnavailable` (`UnavailableDirective`,
`backoffice/src/app/shared/directives/unavailable.directive.ts`):
```html
<button type="button" class="list-iconbtn" appUnavailable aria-label="Exportar a CSV">…</button>
<button mat-stroked-button appUnavailable="Se habilita cuando exista el endpoint de exportación">…</button>
```
Pone `aria-disabled="true"` y la clase `.is-unavailable`, muestra el motivo en tooltip (default "Disponible
próximamente") y anula click/Enter/Espacio; el control sigue siendo focusable. **No** usarla para deshabilitados
legítimos por estado de formulario (ej. Guardar sin cambios).

## 10. Accesibilidad (WCAG 2.2 AA, no negociable)

- Texto ≥ 4.5:1; texto grande, contornos de controles y estados ≥ 3:1. Texto verde = `--theme-success-text`
  (nunca `--theme-success`); texto naranja = `--theme-warning-text`.
- Foco siempre visible con `@include focus-ring` (outline 2px `--theme-focus-ring-color`, offset 2px) o
  `@include focus-ring-inset`; inputs suman `--theme-focus-ring-soft`. Prohibido `outline: none` sin reemplazo.
- Botones de solo ícono: `aria-label` + tooltip. Íconos decorativos: `aria-hidden="true"`.
- Un tooltip no puede colgar de un `disabled` nativo (no recibe foco ni hover): usar `appUnavailable`,
  `aria-disabled` o envolver en `<span [matTooltip]>`.
- Labels reales (`<label for>` / `aria-labelledby`); los errores van asociados al campo y en texto, no solo color.
- Error de carga con `role="alert"`; spinners y skeletons con texto accesible ("Cargando…").
- Targets: controles sueltos ≥ 34px; acciones de fila de 30px dentro de filas de 56px (SC 2.5.8: ≥ 24px).
- Teclado completo; `Esc` cierra overlays; foco atrapado en diálogos.
- Respetar `prefers-reduced-motion`; transiciones `--theme-transition-fast/-normal/-slow` (150/250/350ms), sin
  animación decorativa.
- es-AR: fechas DD/MM/YYYY, UI en español con voseo, títulos con verbo en infinitivo cuando aplique.

## 11. Qué NO hacer

- Hardcodear hex, espaciados, sombras o breakpoints si existe token/mixin.
- Usar los valores del diseño que fallan AA: `#9AA0A6` como texto, `#C9CFD6` como contorno de input, `#16A34A`
  como texto.
- Redefinir o re-prefijar en un componente las clases globales (`.list-toolbar*`, `.list-iconbtn`,
  `.list-ghost-button`, `.state-panel*`, `.load-state`, `.row-action*`, `.bool-badge*`, `.is-unavailable`).
- Repetir un patrón en ≥2 pantallas en vez de subirlo (regla de 3 niveles: clase global en `_components.scss`,
  mixin en `_mixins.scss`, componente en `shared/components/` si hay comportamiento; ver `.claude/rules/scss-bem.md`).
- `@use` de `_themes` (o de cualquier parcial que emita CSS) desde un componente.
- Importar un módulo de Material sin sumar su `mat.*-theme` en `_material-theme.scss`.
- `disabled` + `title`/`matTooltip` para funciones sin backend, u ocultarlas sin aviso.
- Sombras en cards de contenido, gradientes, navy en el sidebar (el navy es solo del hero de Login).
- Emojis o un segundo set de íconos; agregar íconos sin re-correr `npm run icons`.
- Cambiar la familia tipográfica o el azul base.
- Estilos/plantillas inline (`templateUrl` + `styleUrl` siempre) o Angular signals (RxJS siempre).
