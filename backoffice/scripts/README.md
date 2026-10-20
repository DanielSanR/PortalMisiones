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
