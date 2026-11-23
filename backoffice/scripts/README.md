# scripts/

## `phosphor-subset.mjs` — subset de íconos Phosphor

El backoffice no carga el CSS completo de `@phosphor-icons/web` (1530 íconos, ~60 kB de reglas + fuente de
~147 kB): carga `src/assets/icons/phosphor-subset.css` (GENERADO) con solo los íconos usados, y su fuente
`phosphor-subset.woff2` (`font-display: swap`). Ambos están en `angular.json → styles`; la carpeta
`assets/icons` se excluye de la copia de assets porque el CSS ya se empaqueta en `styles.css` y la fuente
sale a `media/` con hash.

**Al agregar un ícono nuevo hay que correr `npm run icons`** (y commitear los dos archivos generados).
Si te olvidás, el ícono no se ve; `npm run build` corre `icons:check` en `prebuild` y frena con la lista
de faltantes y dónde se usan.

```
npm run icons        # regenera el CSS + la fuente
npm run icons:check  # exit 1 si un ícono usado no existe en Phosphor o falta en el subset
```

### Qué se escanea (`src/app/**/*.{html,ts}`, sin specs)
- Clases literales `ph-<nombre>` (incluye `[class.ph-x]="…"`).
- Literales `'…'` dentro de `ph-{{ expr }}` y de `[class]="'ph ph-' + expr"` (se descartan argumentos de pipes).
- HTML: atributos `icon="x"`, `emptyIcon="x"`, `emptyActionIcon="x"`… y bindings `[emptyActionIcon]="c ? 'x' : 'y'"`.
- TS: `icon: 'x'`, `icono: 'x'`, `emptyIcon = 'x'`, `FALLBACK_SECTION_ICON = 'x'` (cualquier clave/const con "icon").
- Mapas `XXX_ICONS = { clave: 'x', … }` (ej. `ACCION_ICONS`).
- `ICON_ALLOWLIST` (en el script): nombres que solo existen en runtime. **Si escribís un ícono dinámico cuyo
  valor no aparece como literal en ninguna de las formas anteriores, sumalo ahí.**
- `ICON_IGNORE`: nombres detectados que no son íconos de Phosphor (bugs conocidos); se avisan sin fallar.

### Fuente
Se subsetea con fonttools (`python -m fontTools.subset`, requiere `pip install fonttools brotli`). Sin
fonttools el script copia la fuente completa (funciona igual, pesa ~147 kB en vez de ~10 kB) y lo avisa.

## `check-prod-mocks.mjs`

El build de producción reemplaza (`angular.json → production → fileReplacements`) los `*.mock.datasource.ts`
de features que en `environment.prod.ts` van por HTTP con `src/app/core/mocks/excluded-mock.datasource.ts`,
para que los mocks no viajen al bundle. Este check (en `prebuild`) falla si alguno de esos features pasa a
`'mock'` en prod: en ese caso quitá su entrada de `fileReplacements`. Al revés, cuando un feature mock pase a
real en prod, agregá su reemplazo.

## Sistema de chequeos (fuente única: los scripts de `package.json`)

| Script | Qué corre |
|---|---|
| `npm run typecheck` | `ngc` (templates con `strictTemplates`) + `tsc` (incluye specs) |
| `npm run lint` | ESLint sobre `src/app/**/*.{ts,html}` (`.eslintrc.cjs`), con `--max-warnings <tope>` |
| `npm run lint:styles` | stylelint sobre `src/**/*.scss` (`.stylelintrc.json`), con `--max-warnings <tope>` |
| `npm run check:structure` | `check-structure.mjs`: carpetas y nombres de `core/features` y `pages`; y el markup unificado (`familia-paneles`: clases `detail-grid/col/card`, que ya no existen; `membrete-inline`: un `<header class="detail-header">` fuera de `app-membrete`) |
| `npm run check:styles` | `check-styles.mjs`: mixins/clases globales sin uso, tokens `--theme-*` sin consumidor, SCSS vacíos (sin reglas ni comentario), peso por componente |
| `npm run check:circular` | madge: 0 dependencias circulares |
| `npm run check:static` | lint + lint:styles + structure + styles + circular + icons:check + prod-mocks (**es el `prebuild`**) |
| `npm run check:fast` | typecheck + check:static |
| `npm run check:stop` | check:fast + `ng build` (gate de Stop de Claude Code) |
| `npm run check` | check:fast + tests headless + build con stats + `check:bundle` (pre-push y CI) |
| `npm run build:ci` | `npm run build -- --stats-json` + `check:bundle` |

### Principio de adopción (trinquete)
- Regla con 0 violaciones → `error`.
- Regla con violaciones conocidas → `warn` + tope `--max-warnings` (package.json) **igual al conteo actual**.
  El tope **solo baja**: al limpiar, bajalo; cuando una regla llega a 0, subila a `error` en la config.
- Desvíos de estructura / SCSS muerto conocidos → `check-structure.baseline.json` / `check-styles.baseline.json`.
  El check falla ante un desvío nuevo **y** ante una entrada del baseline que ya no existe: borrala con
  `node scripts/check-structure.mjs --prune` (o `check-styles.mjs --prune`). No hay flag para agregar entradas.
- Excepciones puntuales de stylelint (archivos que hoy usan `::ng-deep`, `!important` o clases internas de
  Material): son los `overrides` por archivo del final de `.stylelintrc.json`, que bajan la regla a `warning`
  solo ahí. Al limpiar un archivo, borrá su override.
- Nunca apagar una regla, subir un tope ni sumar al baseline para "destrabar" un chequeo.

### `.scss` sin estilos propios (`check-structure` + `check-styles`)
`check-structure` exige el trío `.ts` / `.html` / `.scss` por componente; `check-styles` (`scss-vacio`) no acepta un `.scss`
muerto. Se concilian así: un componente sin estilos propios deja su `.scss` con **solo un comentario** que dice por qué
(qué clases globales usa). Falla si el archivo está completamente vacío o si tiene código sin ninguna regla (un `@use` suelto).

### Tokens del tema sin consumidor (`check-styles`, regla `token-sin-uso`)
Todo `--theme-*` definido en `src/shared-styles/_themes.scss` necesita un consumidor. Cuenta como uso:
- un `var(--theme-x)` en el **CSS compilado** de `styles.scss` (sin el bloque de definiciones) o de cualquier
  `*.component.scss` — al mirar lo compilado también cuentan los nombres que Sass arma por interpolación
  (`var(--theme-estado-#{$tono}-bg)`);
- el nombre escrito en un `.ts` / `.html` de `src/app` (y el prefijo, si el nombre se arma en runtime: `--theme-x-${…}`);
- que lo referencie **otro token que sí está en uso** (los alias). Un token que solo referencian tokens sin uso
  también está sin uso: se borran en cadena.

Baseline en 0 (mismo trinquete que el resto). Si falla: borrá el token, o agregalo recién junto con su primer uso.
Al borrar uno, sacalo también de la sección de tokens de `DESIGN.md`.

### `lint-files.mjs`
Lint por archivo, **solo errores** (`node scripts/lint-files.mjs <archivos…>` o `--staged`). Lo usan el hook
PostToolUse de Claude Code (`.claude/hooks/backoffice-lint-file.mjs`) y el `pre-commit`.

### `check-bundle.mjs`
Necesita `stats.json` (`ng build --stats-json`); por eso no va en `prebuild`. Umbrales y listas de módulos
prohibidos en el inicial / mocks permitidos: en la cabecera del script. Una librería que va sola en su chunk lazy y
no se puede partir tiene tope propio en `LIBRERIAS_LAZY` (hoy solo Leaflet, 160 kB, que baja el mapa del punto de
atención con `import()`); el tope general de 110 kB no se sube. El CSS de Leaflet tampoco va en `styles.css`: es el
bundle `mapa.css` (`angular.json` → `styles` con `inject: false`, fuente `src/shared-styles/mapa-leaflet.scss`), que
el mapa agrega con un `<link>` al mostrarse.

### Git hooks (`backoffice/.githooks`)
`npm run hooks:install` setea `core.hooksPath=backoffice/.githooks` en el clon (también corre en `prepare`).
`pre-commit`: lint de los archivos staged + `check-structure` (segundos). `pre-push`: `npm run check` si el
push toca `backoffice/`. Desactivar: `git config --unset core.hooksPath`.

### Caché
ESLint y stylelint cachean en `node_modules/.cache/`. La caché es por archivo: si movés un archivo del que
dependen otros (reglas de capas), un `lint` local puede no re-evaluar a los que lo importan. CI corre sin caché
y es la referencia; ante la duda: `rm -rf node_modules/.cache/eslint`.
