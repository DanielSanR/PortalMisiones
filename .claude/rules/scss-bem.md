---
paths:
  - "backoffice/src/**/*.scss"
  - "backoffice/src/app/**/*.html"
---

# Estilos: BEM, prefijo por pantalla y tokens (backoffice)

## BEM
`bloque__elemento--modificador` + estados `.is-*`. En SCSS anidado: `&__elem`, `&--mod`, `&.is-activo`. **Nunca `&-elem`.**
```scss
.etiqlist {
  &__fila { gap: var(--theme-space-sm); }
  &__alcance { &--global { @include estado-badge(--theme-info-bg, --theme-info, --theme-info-border); } }
}
.plantdet-chips { &__chip { &--faltante { … } } }   // mini-bloque de la misma pantalla
```

## Un prefijo de bloque por pantalla: `<entidad><list|det|form>`
Piezas de la pantalla = mini-bloques `<prefijo>-<pieza>` con sus elementos en `__`. Prefijos en uso (no los repitas en otra pantalla):

| Pantalla | Prefijo | Pantalla | Prefijo |
|---|---|---|---|
| etiquetas / permisos / eventos de vida (lista) | `etiqlist` / `permlist` / `eventoslist` | plantillas | `plantlist` · `plantdet` · `plantform` |
| organismos (detalle) | `orgdet` | fichas | `fichalist` · `fichadet` · `fichaform` |
| roles (form) | `rolform` | adopciones | `adoplist` · `adopdet` |
| Mi perfil | `mi-perfil` | Preferencias | `preferencias` |

`mi-perfil` y `preferencias` son pantallas de la cuenta, sin entidad ni `<list|det|form>`: su prefijo es el nombre de la
pantalla (lo fijó el plan de perfil y preferencias).

Componentes de `shared/` y `components/<pieza>/`: bloque = nombre del componente (`row-actions`, `filter-tabs`).

## Ficha de una entidad: un membrete y UNA familia de paneles
- **Membrete**: `<app-membrete>` (`shared/components/membrete`; dibuja el `.detail-header` global). Sobre la tarjeta de
  paneles lleva `class="ficha-membrete"`. No escribas un `<header class="detail-header …">` en una pantalla.
- **Paneles**: bloque global `.ficha-paneles` (documentado en `shared-styles/_components.scss`). Unida (por defecto): una
  tarjeta con dos paneles y, en un formulario, el pie integrado; `--lectura` para el detalle. `--separados`: cada
  `__panel` es una tarjeta y `__columna` apila varias (`__panel--corrido` + `__barra` para listas de borde a borde).
  Elementos: `__grid` (`--iguales`, `--lateral-ancho`), `__panel` (`--lateral`, `--acotado`, `--corrido`), `__cabecera`,
  `__encabezado`, `__titulo`, `__subtitulo`, `__total`, `__cuerpo`, `__campos` (`--grilla`), `__grupo` (`--corrido`), `__opciones` /
  `__opcion`, `__barra`, `__columna`, `__nota`, `__indicador`. En un formulario del motor la dibuja
  `<app-dynamic-form [paneles]>`: a mano solo en un detalle o en la ficha por localidad.
- Las clases `detail-grid`, `detail-col` y `detail-card` **ya no existen** (se unificaron acá).

## Dónde va un estilo (3 niveles; buscá antes de escribir)
1. **Clase global** en `shared-styles/_components.scss` si el mismo markup se repite en ≥2 pantallas (`.list-toolbar*`,
   `.list-iconbtn`, `.list-ghost-button`, `.state-panel*`, `.load-state`, `.cell-name`, `.ficha-paneles*`, `.detail-field*`,
   `.detail-link`, `.form-field*`, `.dialogo-formulario`). No las redefinas ni las envuelvas con tu prefijo.
2. **Mixin** de `shared-styles/_mixins.scss` si se aplica a un selector propio o se parametriza: `@use 'shared-styles/mixins' as *;`.
3. **Local**, con el prefijo de la pantalla, solo lo que es propio de ella. Si hay markup + comportamiento: `shared/components/`.

## Hacé / No hagas
- Colores, espaciados, radios, sombras, `font-size`, `z-index`: siempre `var(--theme-*)` (definidos en `shared-styles/_themes.scss`).
- Responsive con `@include responsive(mobile | tablet | tablet-down | desktop | wide)` o `container-below`; nunca `@media` crudo.
- Overrides de Material (`.mat-mdc-*`, `.mdc-*`, `.cdk-*`): solo en `shared-styles/_material.scss` o una clase de panel global
  (`panelClass: 'custom-modal-panel'`). Módulo de Material nuevo → sumar su `mat.*-theme` en `_material-theme.scss`.
- Sin `::ng-deep`, `!important`, `#id`, hex / `rgb()` / colores nombrados, ni selectores por tag (excepción: `i.ph`).
- Máximo 3 niveles de anidamiento. Sin `@use` de `_themes` (ni de nada que emita CSS) desde un componente. Sin `@use` de mixins sin `@include`.
- Componente sin estilos propios: conserva su `.scss` (el trío `.ts/.html/.scss` es obligatorio) con **solo un comentario** que
  dice por qué no los tiene y qué clases globales usa. Completamente vacío, o con código pero sin reglas, falla `check:styles`.
- Sin entradas nuevas en `scripts/check-styles.baseline.json`. `stylelint-disable-next-line <regla> -- <motivo>` solo para un
  valor de un único uso que no merece token (ej. el `font-size: 16px` anti-zoom de iOS); si el valor se repite, se crea el token
  en `_themes.scss` (escala documentada ahí y en `DESIGN.md`). Nunca un `stylelint-disable` de archivo ni sin motivo.
- Los ganchos de test (`data-testid`, ids de formulario) no son clases BEM ni llevan estilos.

Ejemplo canónico: `pages/etiquetas/list/etiquetas-list.component.scss`.
Lo verifica: `npm run lint:styles` (stylelint: `selector-nested-pattern`, `color-no-hex`, `declaration-strict-value`,
`at-rule-disallowed-list`, `declaration-no-important`, `max-nesting-depth`), `npm run check:styles` (SCSS muerto) y
`npm run check:structure` (`familia-paneles`: clases `detail-grid/col/card`; `membrete-inline`: un `<header class="detail-header">` a mano).
