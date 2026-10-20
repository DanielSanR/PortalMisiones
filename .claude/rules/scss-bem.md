---
paths:
  - "backoffice/src/**/*.scss"
---

# Estilos — BEM anidado con `&`, mixins y tokens (backoffice)

## BEM anidado con `&`
Anidar SIEMPRE con `&` (no repetir el bloque). Ejemplo:

```scss
.container {
  // estilos del bloque

  &-panel {        // .container-panel
    // ...
  }

  &-header {       // .container-header
    // ...
  }

  &.is-active {    // estado/modifier
    // ...
  }
}
```

- Un bloque por archivo de componente; los elementos/estados van anidados con `&`.
- Nombres en kebab-case, semánticos (no utilitarios sueltos tipo `.mt-4`).

## Tokens y mixins (reutilización estricta)
- Usar las **CSS variables del tema** (`var(--theme-*)`) y los mixins/variables de `shared-styles/`
  (`_themes.scss`, `_mixins.scss`, `_responsive.scss`). PROHIBIDO hardcodear colores/espaciados/breakpoints.
- Si un patrón visual se repite, extraer un **mixin** en `shared-styles/` y reusarlo. Evitar duplicación.
- Responsive con los mixins/breakpoints compartidos, no media queries con números mágicos.

## Dónde vive un estilo compartido (3 niveles)
Con encapsulación emulada, cada `@include` en un `*.component.scss` **copia el CSS dentro del chunk JS**:
el fuente queda DRY pero el bundle no. Decidir así:

| Caso | Hacer | Dónde |
|---|---|---|
| Mismo markup y misma clase en ≥2 pantallas (toolbar de lista, iconbtn, estados vacío/error) | **Clase global** generada desde el mixin, una sola vez | `shared-styles/_components.scss` (`.list-toolbar { @include list-toolbar; }`) |
| Se aplica a un selector propio del componente o se parametriza | **Mixin** incluido localmente | `shared-styles/_mixins.scss` |
| Hay markup **y** comportamiento | **Componente compartido** | `shared/components/` |

- Clases globales existentes: `.list-toolbar` (`--stacked`, `__row`, `__row--chips`, `__actions`), `.list-toolbar-count` (`--end`),
  `.list-iconbtn`, `.list-ghost-button`, `.state-panel` (`__icon`, `__icon--error`, `__title`, `__text`, `__cta`), `.load-state`.
  No redefinirlas ni envolverlas con prefijo propio en el componente.
- Las clases globales llevan nombre de bloque claro (`list-*`, `state-panel*`), nunca genérico.
- Importar mixins con `@use 'shared-styles/mixins' as *;` (hay `includePaths: ["src"]`), sin `../../`.
- Nunca `@use` de `_themes` (ni de nada que emita CSS) desde un componente: duplica el `:root` en el bundle.
- Al importar un módulo nuevo de Material, sumar su `mat.*-theme` en `shared-styles/_material-theme.scss`.

## DRY
- Antes de escribir estilos nuevos, revisar si ya existe el token/mixin/clase compartida.
- Mantener los `.scss` de componente acotados; lo común sube a `shared-styles/`.
