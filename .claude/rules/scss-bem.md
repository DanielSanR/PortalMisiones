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

## DRY
- Antes de escribir estilos nuevos, revisar si ya existe el token/mixin/clase compartida.
- Mantener los `.scss` de componente acotados; lo común sube a `shared-styles/`.
