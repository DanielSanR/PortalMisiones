# Design System — Backoffice Misiones

Referencia de diseño del **backoffice** (Angular 17 + Angular Material 17, SCSS BEM). El portal ciudadano
(`portal/`, Next.js) tiene su propio sistema y no se rige por este documento.

## 1. Propósito y fuente de verdad

- **Visual:** proyecto de Claude Design https://claude.ai/design/p/84343836-e4c6-4d6f-af3b-9c6a09fd8b64,
  archivos **"Kitchen Sink — Design System Misiones"** (`kitchen-sink.dc.html`: fundaciones, componentes y bloque
  Handoff de tokens) y **"Pantallas backoffice"** (`pantallas-backoffice.dc.html`: pantallas aplicadas).
- **Código (lo que manda en runtime):** `backoffice/src/shared-styles/`
  - `_themes.scss` — tokens `--theme-*` (CSS custom properties en `:root`). Solo los que alguien consume:
    `npm run check:styles` (`token-sin-uso`) falla ante un token sin consumidor. El token se agrega junto con su primer uso.
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

### 3.1 Marca — escala azul (`--theme-primary-50…900`, sin `-500`: ese tono es `--theme-accent`)
`50 #E8F1FA · 100 #C5DCF2 · 200 #9EC4E8 · 300 #77ABDE · 400 #5A98D6 · 500 #3B82C4 · 600 #2F6EB1 · 700 #245A95 · 800 #1A4779 · 900 #0F335D`

| Token | Hex | Uso | Contraste |
|---|---|---|---|
| `--theme-primary` | `#2F6EB1` (600) | Botón primario, links, foco, acento | 5.27:1 (blanco encima: 5.27:1) |
| `--theme-primary-dark` | `#264F82` (= brand-dark del portal) | Hover del primario; texto de botón secundario y de `.row-action` | 8.33:1 |
| `--theme-primary-darker` | `#1A4779` (800) | Active del primario; `--theme-nav-item-active-fg` | 9.45:1 |
| `--theme-accent` | `#3B82C4` (500) | Acento claro | — |
| `--theme-surface-inverse` | `#0F335D` (900) | Solo hero de Login y tints oscuros | — |

### 3.2 Superficies y bordes

| Token | Hex | Uso |
|---|---|---|
| `--theme-surface-card` / `--theme-bg-card` | `#FFFFFF` | Contenido, cards |
| `--theme-bg-sidebar` | `#F7F9FB` | Sidebar claro |
| `--theme-surface-sunken` / `--theme-table-header-bg` | `#F7F9FB` | Header de tabla, wells |
| `--theme-bg-table-hover` / `--theme-table-hover-bg` | `#F7F9FB` | Hover de fila |
| `--theme-bg-sidebar-hover` | `#EDF1F5` | Hover de nav |
| `--theme-surface-canvas` | `#E8EBEF` | Marco exterior del shell |
| `--theme-border-primary` | `#DBE2EE` (= border-soft del portal) | Borde de card, divisor 1px (decorativo, 1.30:1) |
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

Destructivo (botones): `color="warn"` de Material (`#D32F2F`, = `--theme-error`) / hover `--theme-warn-dark` `#B71C1C`.

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
- Series: `--theme-chart-2` `#2F6EB1` y `--theme-chart-4` `#C5DCF2` (las únicas en uso; una serie nueva suma su token); histórico
  `--theme-chart-historic` `#5A98D6` (tramo reciente en `--theme-chart-2`). Nunca donut con más de 4 categorías.
- Skeleton: `--theme-skeleton-base` / `--theme-skeleton-highlight`.
- Snackbar: `--theme-snackbar-{success|error|warning}-{bg|action}` + `--theme-snackbar-text` (texto de las
  tres); se aplica con `panelClass: 'snackbar-success' | 'snackbar-error' | 'snackbar-warning'`. Texto y acción
  cumplen AA (≥ 4,5:1) sobre su fondo:

  | Variante | Fondo | Texto `#FFFFFF` | Acción |
  |---|---|---|---|
  | success | `#1A1A2E` | 17,06:1 | `#9EC4E8` · 9,35:1 |
  | error | `#8E1616` | 9,22:1 | `#FFCDD2` · 6,55:1 |
  | warning | `#BF360C` | 5,60:1 | `#FFF3E0` · 5,11:1 |

  El fondo de warning NO es `--theme-warning` (`#E65100`): con texto blanco da 3,79:1. No hay variante `info`.

## 4. Tipografía

- **Familia:** `--theme-font-family: 'Oak Sans', …` — la misma del portal. Self-hosted en
  `src/assets/fonts/oak-sans/` (woff2 400/500/600/700 subseteados a Latin desde `public/public/fonts/oak-sans`),
  `@font-face` en `_base.scss` y preload del Regular en `index.html`.
- Mono: `--theme-font-mono` (JetBrains Mono).
- Números en tablas y métricas: `font-variant-numeric: tabular-nums`.

### Escala por rol (usar estos tokens)

| Rol | Tamaño / peso | Tokens | Uso |
|---|---|---|---|
| Page title | 16 / 600, −0.1px | `--theme-font-page-title-size/-weight/-tracking` | Título en el topbar |
| Display | 26 / 600, −0.3px | `--theme-font-display-size` | Título grande de página |
| Section | 17 / 600, −0.2px | `--theme-font-section-size/-weight/-line-height/-tracking` | Bandas del Home, H2 |
| Card title | 13.5 / 600 | `--theme-font-card-title-size/-weight` | Header de widget/card |
| Metric | 26 / 600 | `--theme-font-metric-size/-weight` | KPI |
| Subtitle | 15 / 400 | `--theme-font-subtitle-size` | Subtítulo de page-header |
| Body | 13.5 / 400, lh 1.5 | `--theme-font-body-size/-line-height` | Texto general, celdas |
| Small | 12.5 / 400 | `--theme-font-small-size/-line-height` | Metadatos, ayudas |
| Caption | 11.5 | `--theme-font-caption-size` | Header de tabla, badges, meta |
| Overline | 11 / 600, +0.5px, MAYÚSCULA | `--theme-font-overline-size/-weight/-track` | Label de campo (`@include field-label-overline`) |

La escala cruda (`--theme-font-size-2xs…3xl`, 11→30px) y los pesos (`--theme-font-weight-*`) quedan para casos sin
rol. Mixins de texto: `text-body`, `text-caption`, `truncate`, `line-clamp($lines)`.

Interlineado y tracking (letter-spacing) fuera de los roles — sin valores sueltos en los `.scss`:

| Token | Valor | Uso |
|---|---|---|
| `--theme-line-height-none` | 1 | Íconos, chips y números de una línea |
| `--theme-line-height-tight` / `-normal` | 1.25 / 1.5 | Escala base |
| `--theme-line-height-130` / `-140` / `-145` / `-160` | 1.3 / 1.4 / 1.45 / 1.6 | Intermedios nombrados por valor (ayudas, párrafos de card, avisos) |
| `--theme-tracking-tight` / `-wide` | −0.01em / +0.01em | Títulos `h1…h6` · cuerpo y tabs (escalan con el texto) |
| `--theme-tracking-tight-px` | −0.2px | Títulos de card y avatares |

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
| `--theme-space-5` / `-6` / `-7` / `-9` / `-10` / `-11` / `-13` / `-14` / `-22` / `-40` | 5 / 6 / 7 / 9 / 10 / 11 / 13 / 14 / 22 / 40 | Escalones intermedios del diseño (ver abajo) |

**Escalones intermedios.** Los valores del diseño que no caen en la escala t-shirt de arriba NO se redondean: tienen
su propio token, nombrado por el valor en px (`--theme-space-<px>`) y con exactamente ese valor. Escala completa, en
px: 2 · 4 · 5 · 6 · 7 · 8 · 9 · 10 · 11 · 13 · 14 · 16 · 18 · 22 · 24 · 30 · 32 · 40 · 48 · 64 (con `1px` literal
permitido para filetes). Un valor de un solo uso y sin significado reutilizable (3, 26, 34, 52 px) NO lleva token:
queda como literal con `// stylelint-disable-next-line scale-unlimited/declaration-strict-value -- <motivo>`.

- Alturas: `--theme-control-height-md` 34 (botón, chip, iconbtn) · `--theme-control-height-sm` 30 (acción de fila) ·
  `--theme-input-height` 40 · `--theme-table-row-height` 56 (44 en densidad compacta: `-comoda` / `-compacta`) · `--theme-table-cell-padding-y` 10 (6 en compacta) · `--theme-tree-row-height` 52 (44 en compacta, árbol de Categorías) · `--theme-tree-cell-padding-y` 9 (6 en compacta) · `--theme-header-height` 60 · `--theme-sidebar-width` 260.
- Ancho: `--theme-content-max-width` 1400.
- Apilado local (dentro de un componente): `--theme-z-raised` 1 y `--theme-z-raised-above` 2; el chrome usa `--theme-z-sticky` 200, `--theme-z-header` 1000 y `--theme-z-modal` 1300.
- Responsive solo con `@include responsive(mobile | tablet | tablet-down | desktop | wide)`.
- Grids con `fr`: `minmax(0, Nfr)` para que los tracks puedan encogerse.

## 6. Radios

| Token | px | Uso |
|---|---|---|
| `--theme-radius-3` / `-6` | 3 / 6 | Barra de acento y thumb de scrollbar · items de menú y toggle (intermedios nombrados por valor) |
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

`--theme-focus-ring-soft` / `--theme-focus-ring-danger-soft`: halo de 3px del campo con foco / inválido con foco.
`--theme-shadow-snackbar` para el toast. Las cards no llevan sombra (el diseño es plano).

## 8. Iconografía

- **Phosphor Icons, peso regular**, único set. Markup: `<i class="ph ph-<nombre>" aria-hidden="true"></i>`.
  En `RowAction.icon` y en `emptyIcon` de `app-shared-table` va el nombre **sin** el prefijo `ph-`.
- Tamaños: `--theme-icon-size-sm` 16 (botones) · `--theme-icon-size-md` 17 (toolbar) · `--theme-icon-size-lg` 20 (nav).
  Intermedios nombrados por valor: `--theme-icon-size-13` · `-14` · `-18` · `-19`. Escala completa, en px: 13 · 14 ·
  sm 16 · md 17 · 18 · 19 · lg 20 · xl 24. Íconos de un solo uso (12, 22, 28, 40 px) quedan como literal con
  `stylelint-disable` y motivo.
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
  `appFormErrorMessage` (ícono `ph-warning-circle` + texto es-AR, un mensaje por vez) o `.form-field__error`, en
  `--theme-error-icon`. Un formulario a mano describe sus campos como `FieldConfig` y pone el texto de sus
  validadores propios en `validations.mensajes`, para que el campo y el banner resumen digan lo mismo.
- Piezas de formulario (globales, `_components.scss`): `.form-field__fila` (campo + botón al lado),
  `.form-field__mono` (slug, código), `.field-preview` (cómo queda un valor al guardarse), `.form-toggle`
  (booleano con su ayuda; `--separado`, `__ayuda`, `__aviso`), `.form-aviso` (advertencia sobre el formulario).
- Pie: `<app-form-actions>` (`.form-actions`, `__help`, `__buttons`; `[integrada]` en tarjetas de paneles). El botón
  de guardar es plano (`mat-flat-button`) en páginas y diálogos; el texto en curso lleva `…` ("Guardando…").
- Error de guardado y resumen de validación: `<app-form-error-banner>`.
- Formularios dinámicos: `<app-dynamic-form>` / `<app-dynamic-form-field>`. Con `[paneles]` dibuja la tarjeta de dos
  paneles (ver "Ficha de una entidad") con el pie integrado; un widget propio va con `<ng-template appCampoPropio>`.
- Diálogo con formulario: marco `.dialogo-formulario` (cabecera con título, subtítulo y X; cuerpo `mat-dialog-content`
  con scroll; error fuera del cuerpo; pie fijo; ancho `--theme-dialog-width-lg`). Es el mismo para `<app-form-dialog>`
  y para los diálogos con formulario propio. `.form-dialog` (`@include form-dialog`, `--theme-dialog-width-md`/`-sm`)
  queda para confirmaciones y avisos, sin campos. Cierre único (`cierreConConfirmacion`, `@shared/utils`): la X,
  Cancelar, Escape y el clic afuera piden confirmación si hay cambios sin guardar y cierran directo si no.
- Jerarquías (organismo superior, categoría padre): `<app-tree-select>` o el tipo de campo `tree-select` del
  formulario dinámico. Los nodos no elegibles se muestran con su motivo (`disabledReason`), no se ocultan.
- Selección múltiple de catálogos: `<app-seleccion-multiple>` (chips + lista con buscador, un grupo abierto a la vez); en un
  formulario es el tipo de campo `select-multiple` del motor. Ver el form de Plantilla.

#### Ficha de una entidad: membrete + paneles (un solo patrón para formularios de página y detalles)
- **Membrete**: `<app-membrete>` (`shared/components/membrete`). Tile con ícono (o avatar con iniciales, `[membreteTile]`),
  título `h2` (atenuado mientras está vacío), estado (`[membretePill]`), línea meta (`[datos]`: slug/código en mono +
  datos con ícono, separados por un filete), aviso opcional y acciones a la derecha ("Desactivar", o la pill
  "Editando" / "Nuevo" del formulario). Es el mismo en el detalle y en el formulario, que lo arma en vivo.
- **Paneles**: familia única `.ficha-paneles` (`_components.scss`), en dos presentaciones:
  - **Unida**: UNA tarjeta con dos paneles (1.6fr / 1fr; `__grid--iguales` 1 / 1) separados por una línea fina, cada uno
    con su cabecera (barra de acento + título 15/600 + subtítulo, y un total a la derecha) y, en un formulario, el pie de
    guardar integrado abarcando ambos (`<app-form-actions [integrada]="true">`, indicador en `formActionsInfo`). Borde
    celeste = "en edición"; `--lectura` (borde neutro, sin pie) para el detalle. Plantilla, Rol y Ficha (formulario),
    Ficha (detalle).
  - **`--separados`**: cada panel es una tarjeta y una columna apila varias (gap 12). Organismo, Trámite del organismo
    (`__grid--lateral-ancho`, 1 / 1.4) y Plantilla (detalle).
  En tablet y mobile el segundo panel baja debajo del primero. Los campos de lectura van como `.detail-field`.
- **Ver y editar, la misma pantalla en dos modos**: el detalle usa el mismo membrete (con "Desactivar" como acción) y la
  misma tarjeta que su formulario. Un panel hijo con su propio alta (puntos de atención) lleva su cabecera con título,
  total y botón; con `#<fragmento>` en la URL el foco va al título.

#### Alta y edición: ¿diálogo o página?
Una sola forma por entidad; nunca las dos para lo mismo.
- **Diálogo sobre la lista** cuando la entidad tiene pocos campos, no tiene ficha propia y ayuda ver la lista de
  fondo. El marco es `<app-form-dialog>` (`shared/components/form-dialog`) sobre `app-dynamic-form`: cada pantalla
  describe campos, textos y guardado como `FormDialogData` en su `pages/<x>/<x>-dialogo.ts` y lo abre con
  `abrirFormDialog` (`@shared/utils/abrir-form-dialog`, carga diferida). Si no hay nada que cargar antes de mostrar
  el formulario, la config se arma con `formDialogEstatico`. Lo usan usuarios (alta/edición y cambio de email o
  contraseña) y los catálogos de "nombre y poco más" (modalidades, destinatarios, eventos de vida, tipos de
  organismo, permisos, etiquetas). También los que llevan algo más que campos, que el motor resuelve con
  capacidades declaradas en el `FieldConfig`: Categorías (franja de ubicación como campo `vista` y slug `derivado`
  del nombre), puntos de atención (mapa interactivo como `vista` que escribe latitud y longitud, con las coordenadas a mano como
  alternativa) y "Adoptar trámite" (dos `datepicker` con regla
  cruzada). No quedan diálogos de formulario con componente propio.
- **Página** cuando la entidad tiene ficha con más bloques alrededor o muchos campos. Ej.: Organismos (ficha única
  en modos ver / editar / nuevo).
- Las rutas `…/nuevo` y `…/editar/:id` de una entidad con diálogo se mantienen como puerta de entrada (enlaces
  directos, paleta de comandos): cargan la lista con el diálogo abierto y al cerrarlo vuelven a `…/lista`.
  Cableado: guards `redirigirAlDialogo` (en `…/nuevo` y `…/editar/:id`) y `validarDialogoDeLista` (en la lista, con
  `runGuardsAndResolvers: 'paramsOrQueryParamsChange'`) de `@core/guards`, y `DialogoEnLista`
  (`@shared/utils/dialogo-en-lista`) en el componente de la lista.
- Ayuda y error bajo un campo: alineados al borde izquierdo del control y a 6px de él (global en `_material.scss`).
  La ayuda de un control que no es `mat-form-field` incluye el mixin `form-help-text`.

### Lista: encabezado, toolbar y tabla
- Encabezado: lo dibuja el shell (`AdminLayout`): el `<h1>` y las migas salen de `data.breadcrumb` de la ruta
  (`pages/pages.module.ts`); la pantalla solo aporta sus acciones con `<ng-template appPageActions>`.
- Toolbar (clases globales, no redefinir): `.list-toolbar` (`--stacked`) › `.list-toolbar__row` (`--chips`) ›
  `<app-list-search>`, `.list-toolbar-count` (`--end`), `.list-toolbar__actions` › `.list-iconbtn`. Fila de chips:
  `<app-filter-tabs>`, `<app-active-filters>`, `.list-ghost-button`.
- Chips de filtro (`<app-filter-tabs>`) y `.list-ghost-button`: pills como las del portal. Reposo blanco con borde
  suave; activo celeste suave (info-bg + primary-800, 600), no relleno primary: el azul sólido queda para el CTA.
- Selects de filtro de la fila A: sin `<mat-label>`; la opción vacía nombra el filtro ("Todos los estados",
  "Todas las localidades") y el `mat-select` lleva `aria-label="Filtrar por …"`. Alto 34 (regla en `.list-toolbar`).
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
- Página (formulario o detalle) que todavía no tiene qué dibujar: `<app-estado-carga>`. **Cargando**: un solo dibujo,
  ícono giratorio + texto en línea (`.loading-inline`), con `role="status"` y `aria-live="polite"`. **No carga**:
  `.load-state` con "Reintentar". **No existe**: `.load-state` con texto propio e "Ir al listado", sin "Reintentar".
- Carga: skeleton en tablas (`--theme-skeleton-*`); `<app-loading>` para bloques.
- Mensaje inline: `@include inline-message`.
- Copys es-AR con voseo: "Todavía no hay organismos" · "No pudimos cargar los organismos" · "Revisá tu conexión e
  intentá de nuevo."

### Overlays
- Confirmación: `ConfirmDialogComponent` (`app-confirm-dialog`) con `ConfirmDialogData` (`highlight` resalta el
  objeto afectado, `danger`, `confirmAction` async + `busyText`). Título en pregunta ("¿Eliminar el organismo?"),
  consecuencia explícita, botones "Cancelar" / "Sí, eliminar".
- Error global: `app-error-dialog` (lo abre el interceptor; un `.http.datasource.ts` lo evita con `sinDialogoGlobal()`
  cuando el error lo muestra el formulario o la confirmación).
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

### Atajos de teclado (WCAG 2.1.4)

Pocos y los mismos en todas las pantallas; se pueden apagar desde el menú de usuario ("Atajos de teclado", persistido
en `localStorage`; apagados no dispara ninguno, ni `/` ni `?`).

| Tecla | Acción | Dónde |
|---|---|---|
| `/` | Foco al buscador del menú lateral | `admin-layout` |
| `N` (alias `+`) | "Nuevo": acción principal de la pantalla | botón con `appAtajo="n"` |
| `F` | Foco al buscador de la lista | `<app-list-search [atajoFoco]="true">` |
| `?` | Diálogo con los atajos vigentes en la pantalla | `admin-layout` |

No disparan con foco en campos editables (`input`, `textarea`, `select`, `mat-select`, `[contenteditable]`,
`role=combobox|textbox`), con Ctrl/Alt/Meta (Shift solo en `?`, `+`, `/`), en `repeat`/IME, ni con un diálogo o menú
abierto. Un solo listener en `AtajosService` (`core/services/atajos.service.ts`).

**Agregar un atajo**: poner la directiva `AtajoDirective` (`shared/directives/atajo.directive.ts`) sobre el botón o
campo existente: `<button appAtajo="n" *appHasPermission="…">Nuevo usuario</button>`. Hace `click()` (botones) o
`focus()` (campos); hereda permisos (si `*appHasPermission` no lo renderiza, no hay atajo) y no dispara con
`disabled`/`aria-disabled`. Opcionales: `atajoAlias`, `atajoDescripcion` (por defecto `aria-label` o texto del host).
Suma `aria-keyshortcuts` y la tecla en el tooltip ("Nuevo usuario (N)"); el host no puede tener ya `matTooltip` ni
`appUnavailable`. Atajos fuera de un elemento (shell): `AtajosService.registrar({ teclas, descripcion, accion })`.
Si dos elementos comparten tecla gana el último conectado y visible.

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
