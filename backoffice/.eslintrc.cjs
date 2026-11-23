/**
 * ESLint del backoffice — `npm run lint` (todo `src/app`, .ts + .html).
 *
 * PRINCIPIO DE ADOPCIÓN
 *   - Regla con 0 violaciones → `error`.
 *   - Regla con violaciones conocidas → `warn`, y `npm run lint` corre con `--max-warnings <tope>`
 *     (package.json). El tope es el conteo actual y SOLO PUEDE BAJAR: al limpiar una regla, bajá el tope
 *     y, cuando llegue a 0 violaciones, subila a `error` acá.
 *   - Nunca apagar una regla para destrabar: si hace falta una excepción, va en EXCEPCIONES con su motivo.
 *
 * OJO con los overrides: un override posterior REEMPLAZA (no mezcla) el valor de `no-restricted-imports` /
 * `no-restricted-syntax`. Por eso las listas se COMPONEN con `restringir(...)` y cada bloque declara el
 * conjunto completo que le corresponde.
 *
 * Dos severidades para imports restringidos = dos reglas con las mismas opciones:
 *   `no-restricted-imports`                     → error (reglas duras, 0 violaciones)
 *   `@typescript-eslint/no-restricted-imports`  → warn  (deuda con tope; hoy sin uso: no queda deuda de imports)
 */

// ───────────────────────────── Imports restringidos (piezas) ─────────────────────────────

/** REGLA DURA: RxJS, nunca signals. */
const SIGNALS = {
  paths: [
    {
      name: '@angular/core',
      importNames: [
        'signal', 'computed', 'effect', 'model', 'input', 'output', 'viewChild', 'viewChildren',
        'contentChild', 'contentChildren', 'linkedSignal', 'resource', 'untracked', 'Signal', 'WritableSignal',
      ],
      message: 'REGLA DURA: RxJS, nunca signals. Usá Observables + async pipe (@Input/@Output/@ViewChild clásicos).',
    },
    {
      name: '@angular/core/rxjs-interop',
      importNames: ['toSignal', 'toObservable'],
      message: 'REGLA DURA: RxJS, nunca signals. De rxjs-interop solo `takeUntilDestroyed`.',
    },
  ],
};

/** HttpClient solo en los datasources (el DataSource es el único que conoce la fuente). */
const HTTP_CLIENT = {
  paths: [
    {
      name: '@angular/common/http',
      importNames: ['HttpClient'],
      message: 'HttpClient solo se inyecta en core/features/<f>/datasources/*.http.datasource.ts. Consumí el Facade del feature.',
    },
  ],
};

/** La UI entra a un feature solo por su barrel. */
const DEEP_FEATURE = {
  patterns: [
    {
      group: ['@features/*/*', '@features/*/**', '**/core/features/**', '@core/features/**'],
      message: 'Entrá al feature solo por su barrel: `@features/<x>` (nada de rutas internas).',
    },
  ],
};

/** La UI consume Facades, nunca Repository/DataSource. */
const UI_SIN_REPO = {
  patterns: [
    {
      group: ['@features/*'],
      importNamePattern: '(Repository|DataSource)$',
      message: 'La UI consume el Facade del feature, nunca su Repository/DataSource.',
    },
  ],
};

/** Prohibido facade→facade (misma capa). Cross-feature: el Repository del otro feature, vía barrel. */
const FACADE_A_FACADE = {
  patterns: [
    {
      group: ['@features/*'],
      importNamePattern: 'Facade$',
      message: 'Prohibido facade→facade. Desde un facade consumí el Repository del otro feature (vía su barrel).',
    },
  ],
};

/**
 * Relativo solo dentro de la misma carpeta (`./x`) o subiendo UN nivel (`../x`, `../components/y/z`).
 * Subir dos o más (`../../…`) va siempre por alias: entre secciones de pages/ es `@pages/<sección>/…`.
 * (No se confunde con carpetas locales llamadas `shared`, p. ej. `auth/shared/` → `../shared/auth-shell`.)
 */
const RELATIVOS = {
  patterns: [
    {
      group: ['../../*', '../../**'],
      message: 'Import relativo profundo: usá los alias @core/*, @features/*, @shared/*, @pages/*, @env/*.',
    },
  ],
};

/** Las páginas no leen la sesión directo: la expone el facade del feature (como Observable). */
const SESION_EN_PAGES = {
  patterns: [
    {
      group: ['**/auth-token.service', '**/auth.service'],
      message: 'Las páginas no importan AuthTokenService/AuthService: pedí la sesión al facade del feature (ver "Excepción: sesión" en .claude/rules/arquitectura-capas.md).',
    },
  ],
};

const restringir = (...piezas) => ({
  paths: piezas.flatMap((p) => p.paths ?? []),
  patterns: piezas.flatMap((p) => p.patterns ?? []),
});
/** Opción de regla lista para usar; apaga la regla si no queda nada que restringir. */
const regla = (severidad, ...piezas) => {
  const o = restringir(...piezas);
  if (!o.paths.length) delete o.paths;
  if (!o.patterns.length) delete o.patterns;
  return Object.keys(o).length ? [severidad, o] : 'off';
};

// ───────────────────────────── Sintaxis restringida (piezas) ─────────────────────────────
// Igual que con los imports: un override REEMPLAZA la lista, así que cada bloque declara el conjunto completo.

/** Angular 17 → `styleUrl` singular. */
const STYLE_URLS = {
  selector: "Decorator[expression.callee.name='Component'] Property[key.name='styleUrls']",
  message: 'Usá `styleUrl` (singular, un solo archivo) en vez de `styleUrls`.',
};

/** Los avisos salen de `@shared/utils/avisos` (duración, botón y variante en un solo lugar). */
const SNACKBAR_DIRECTO = {
  selector: "CallExpression[callee.property.name='open'][callee.object.property.name=/^snack(B|b)ar$/], "
    + "CallExpression[callee.property.name='open'][callee.object.name=/^snack(B|b)ar$/]",
  message: 'No abras el snackbar a mano: usá `avisarExito` / `avisarAdvertencia` / `avisarError` / `avisar` (`@shared/utils/avisos`).',
};

/** Búsqueda, orden y paginado en cliente los da `ListaCliente`; no se rearman en cada lista. */
const LISTA_A_MANO = {
  selector: 'PropertyDefinition[key.name=/^(sort|pageIndex|pageSize)[$]$/]',
  message: 'Orden y paginado en cliente: usá `ListaCliente` (`@shared/utils/lista-cliente`) en vez de `sort$` / `pageIndex$` / `pageSize$` propios.',
};

/** Las rutas de una sección viven en su `<sección>.rutas.ts`. (El selector no puede llevar `/`: se matchea con `.`.) */
const RUTA_LITERAL = {
  selector: 'Literal[value=/^.dashboard[^a-z]/], TemplateElement[value.raw=/^.dashboard[^a-z]/]',
  message: "No escribas rutas '/dashboard/…' en la pantalla: usá las constantes de `pages/<sección>/<sección>.rutas.ts`.",
};

/**
 * Todo formulario de envío va por el dynamic form (`FieldConfig[]` + `abrirFormDialog` / `<app-dynamic-form>`):
 * en `pages/` no se arma un `FormGroup` a mano. Ver `.claude/rules/formularios-dynamic-form.md`.
 */
const FORMULARIO_A_MANO = {
  selector: 'NewExpression[callee.name=/^(Untyped)?FormGroup$/], '
    + "CallExpression[callee.property.name='group'][callee.object.name=/^(fb|formBuilder)$/], "
    + "CallExpression[callee.property.name='group'][callee.object.property.name=/^(fb|formBuilder)$/]",
  message: 'No armes un `FormGroup` a mano en una pantalla: describí el formulario como `FieldConfig[]` y usá el dynamic form '
    + '(`abrirFormDialog` + `<x>-dialogo.ts`, o `<app-dynamic-form>`). Ver .claude/rules/formularios-dynamic-form.md.',
};

// ───────────────────────────── Excepciones explícitas ─────────────────────────────

/**
 * `FormGroup` a mano en `pages/`. Lista cerrada: no se suma un archivo sin decisión del dueño
 * (`.claude/rules/formularios-dynamic-form.md`, "Excepciones cerradas").
 */
const FORMULARIOS_A_MANO = [
  // Filtros de una lista con paginado en servidor: no son formularios de envío.
  'src/app/pages/auditoria/list/auditoria-list.component.ts',
  'src/app/pages/feedback/list/feedback-list.component.ts',
  // Excepción cerrada: edición concurrente por versión.
  'src/app/pages/tramites/fichas/form/ficha-form.component.ts',
];

/**
 * HttpClient fuera de un datasource. Infra de autenticación previa a la arquitectura de capas.
 * Para sacarlos de acá: moverlos a un feature (`cuenta`/`auth`) con su HttpDataSource.
 */
const HTTP_CLIENT_LEGADO = [
  'src/app/core/services/auth.service.ts',    // login / refresh / logout contra /api/auth
  'src/app/core/services/usuario.service.ts', // legado /api/usuarios (lo sirve mock-api.interceptor)
];

// ───────────────────────────── Capas (eslint-plugin-boundaries) ─────────────────────────────

const F = 'src/app/core/features';
const ELEMENTOS = [
  { type: 'feature-model',      mode: 'file', pattern: `${F}/*/models/*`,       capture: ['feature', 'file'] },
  { type: 'feature-mapper',     mode: 'file', pattern: `${F}/*/mappers/*`,      capture: ['feature', 'file'] },
  { type: 'feature-domain',     mode: 'file', pattern: `${F}/*/domain/*`,       capture: ['feature', 'file'] },
  { type: 'feature-datasource', mode: 'file', pattern: `${F}/*/datasources/*`,  capture: ['feature', 'file'] },
  { type: 'feature-repository', mode: 'file', pattern: `${F}/*/repositories/*`, capture: ['feature', 'file'] },
  { type: 'feature-facade',     mode: 'file', pattern: `${F}/*/facades/*`,      capture: ['feature', 'file'] },
  { type: 'feature-public',     mode: 'file', pattern: `${F}/*/index.ts`,       capture: ['feature'] },
  { type: 'feature-providers',  mode: 'file', pattern: `${F}/*/*.providers.ts`, capture: ['feature', 'file'] },
  // Infra transversal de core. Lista cerrada a propósito: una carpeta nueva en core/ cae en
  // `boundaries/no-unknown-files` y obliga a decidir a qué capa pertenece.
  {
    type: 'core-infra',
    mode: 'file',
    pattern: 'src/app/core/{config,constants,enums,errors,guards,interceptors,mocks,models,services,utils}/**/*',
  },
  { type: 'app-shared', mode: 'file', pattern: 'src/app/shared/**/*' },
  { type: 'app-page',   mode: 'file', pattern: 'src/app/pages/**/*' },
  { type: 'app-auth',   mode: 'file', pattern: 'src/app/auth/**/*' },
  { type: 'app-root',   mode: 'file', pattern: 'src/app/*' },
];

const mismo = (tipo) => [tipo, { feature: '${from.feature}' }];
const REGLAS_CAPAS = [
  // ── dentro de un feature (dirección estricta, 0 deps misma-capa entre features) ──
  { from: 'feature-facade', allow: [mismo('feature-repository'), mismo('feature-model'), mismo('feature-domain'), 'feature-public', 'core-infra'] },
  { from: 'feature-repository', allow: [mismo('feature-datasource'), mismo('feature-mapper'), mismo('feature-model'), mismo('feature-domain'), 'core-infra'] },
  { from: 'feature-datasource', allow: [mismo('feature-datasource'), mismo('feature-mapper'), mismo('feature-model'), mismo('feature-domain'), 'core-infra'] },
  { from: 'feature-mapper', allow: [mismo('feature-model'), mismo('feature-domain'), 'feature-public', 'core-infra'] },
  { from: 'feature-domain', allow: [mismo('feature-model'), mismo('feature-domain'), 'core-infra'] },
  { from: 'feature-model', allow: [mismo('feature-model'), mismo('feature-domain'), 'feature-public', 'core-infra'] },
  { from: 'feature-providers', allow: [mismo('feature-datasource'), 'feature-public', 'core-infra'] },
  { from: 'feature-public', allow: [mismo('feature-facade'), mismo('feature-repository'), mismo('feature-model'), mismo('feature-domain'), mismo('feature-providers')] },
  // ── resto de la app ──
  { from: 'core-infra', allow: ['core-infra'] }, // core no conoce features, shared ni pantallas
  { from: 'app-shared', allow: ['app-shared', 'core-infra', 'feature-public'] },
  { from: 'app-page', allow: ['app-page', 'app-shared', 'core-infra', 'feature-public'] },
  { from: 'app-auth', allow: ['app-auth', 'app-shared', 'core-infra', 'feature-public'] },
  { from: 'app-root', allow: ['app-root', 'app-page', 'app-auth', 'app-shared', 'core-infra', 'feature-public', 'feature-providers'] },
];

// ───────────────────────────── Config ─────────────────────────────

const SPECS = ['**/*.spec.ts', '**/*.testing.ts', '**/testing/**'];
const UI = ['src/app/pages/**/*.ts', 'src/app/shared/**/*.ts', 'src/app/auth/**/*.ts'];

module.exports = {
  root: true,
  ignorePatterns: ['dist/**', '.angular/**', 'node_modules/**', 'coverage/**'],
  overrides: [
    // ══════════ TypeScript: todo src/app ══════════
    {
      files: ['*.ts'],
      parser: '@typescript-eslint/parser',
      extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:@angular-eslint/recommended',
      ],
      plugins: ['boundaries'],
      settings: {
        'import/resolver': {
          typescript: { alwaysTryTypes: true, project: 'tsconfig.json' },
        },
        'boundaries/include': ['src/app/**/*'],
        'boundaries/elements': ELEMENTOS,
      },
      rules: {
        '@angular-eslint/directive-selector': 'off',
        '@angular-eslint/component-selector': 'off',

        // ── error: 0 violaciones ──
        'no-restricted-imports': regla('error', SIGNALS, HTTP_CLIENT, RELATIVOS),
        '@angular-eslint/prefer-on-push-component-change-detection': 'error',
        '@typescript-eslint/no-explicit-any': 'error',
        '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
        'no-restricted-syntax': ['error', STYLE_URLS],
        '@angular-eslint/component-max-inline-declarations': ['error', { template: 0, styles: 0, animations: 20 }],
        '@angular-eslint/prefer-standalone': 'error',
        'no-console': ['error', { allow: ['warn', 'error'] }],
        'boundaries/no-unknown': 'error',
        'boundaries/no-unknown-files': 'error',
        // Archivos de producción de más de 400 líneas: partir en `components/<pieza>/` o helpers (specs y `testing/` exentos).
        'max-lines': ['error', { max: 400 }],
        'boundaries/element-types': [
          'error',
          {
            default: 'disallow',
            message: 'Violación de capas: ${file.type} no puede depender de ${dependency.type} (ver .claude/rules/arquitectura-capas.md)',
            rules: REGLAS_CAPAS,
          },
        ],

        // ── warn con tope (--max-warnings en package.json; conteos al 2026-11-21) ──
        '@angular-eslint/use-component-view-encapsulation': 'warn', // 1 (TableComponent: ViewEncapsulation.None)
      },
    },

    // ══════════ Composición de imports restringidos por zona (cada bloque = conjunto completo) ══════════
    {
      // El DataSource es el único que puede usar HttpClient.
      files: [`${F}/*/datasources/*.ts`, ...HTTP_CLIENT_LEGADO],
      rules: { 'no-restricted-imports': regla('error', SIGNALS, RELATIVOS) },
    },
    {
      files: [`${F}/*/facades/*.ts`],
      rules: { 'no-restricted-imports': regla('error', SIGNALS, HTTP_CLIENT, RELATIVOS, FACADE_A_FACADE) },
    },
    {
      files: UI,
      rules: { 'no-restricted-imports': regla('error', SIGNALS, HTTP_CLIENT, RELATIVOS, DEEP_FEATURE, UI_SIN_REPO) },
    },
    {
      // pages/ = UI + sin sesión directa (0 violaciones desde 2026-11-20: regla dura).
      files: ['src/app/pages/**/*.ts'],
      rules: { 'no-restricted-imports': regla('error', SIGNALS, HTTP_CLIENT, RELATIVOS, DEEP_FEATURE, UI_SIN_REPO, SESION_EN_PAGES) },
    },

    {
      // Pantallas: lo que ya está extraído a `@shared/utils` no se reintroduce (0 violaciones desde 2026-11-20).
      // Las listas con paginado en servidor (auditoría, feedback) no usan `sort$` / `pageIndex$`: no chocan.
      files: ['src/app/pages/**/*.ts'],
      excludedFiles: ['src/app/pages/pages.module.ts', 'src/app/pages/**/*.rutas.ts'],
      rules: { 'no-restricted-syntax': ['error', STYLE_URLS, SNACKBAR_DIRECTO, LISTA_A_MANO, RUTA_LITERAL, FORMULARIO_A_MANO] },
    },
    {
      // Los únicos `FormGroup` a mano de `pages/` (0 violaciones fuera de esta lista desde 2026-11-20).
      files: FORMULARIOS_A_MANO,
      rules: { 'no-restricted-syntax': ['error', STYLE_URLS, SNACKBAR_DIRECTO, LISTA_A_MANO, RUTA_LITERAL] },
    },
    {
      // El resto de la UI tampoco abre el snackbar a mano (el único `open` vive en `shared/utils/avisos.ts`).
      files: ['src/app/shared/**/*.ts', 'src/app/auth/**/*.ts'],
      excludedFiles: ['src/app/shared/utils/avisos.ts'],
      rules: { 'no-restricted-syntax': ['error', STYLE_URLS, SNACKBAR_DIRECTO] },
    },

    // ══════════ Specs y helpers de test ══════════
    {
      files: SPECS,
      rules: {
        '@angular-eslint/component-class-suffix': 'off',
        '@angular-eslint/directive-class-suffix': 'off',
        '@angular-eslint/prefer-on-push-component-change-detection': 'off',
        '@angular-eslint/component-max-inline-declarations': 'off',
        '@angular-eslint/prefer-standalone': 'off',
        '@angular-eslint/use-component-view-encapsulation': 'off',
        'boundaries/element-types': 'off',
        'boundaries/no-unknown': 'off',
        'boundaries/no-unknown-files': 'off',
        'max-lines': 'off',
        'no-restricted-syntax': 'off',
        // Un spec puede usar HttpClient/HttpTestingController y entrar a internals; signals siguen prohibidos.
        'no-restricted-imports': regla('error', SIGNALS),
      },
    },

    // ══════════ Templates ══════════
    {
      files: ['*.html'],
      parser: '@angular-eslint/template-parser',
      plugins: ['@angular-eslint/template'],
      rules: {
        // ── error: 0 violaciones ──
        '@angular-eslint/template/alt-text': 'error',
        '@angular-eslint/template/valid-aria': 'error',
        '@angular-eslint/template/role-has-required-aria': 'error',
        '@angular-eslint/template/no-positive-tabindex': 'error',
        '@angular-eslint/template/no-autofocus': 'error',
        '@angular-eslint/template/table-scope': 'error',
        // `appListaPendiente` (shared/components/lista-pendiente) pone el ícono, el rótulo y el `aria-label` del botón.
        '@angular-eslint/template/elements-content': ['error', { allowList: ['appListaPendiente'] }],
        '@angular-eslint/template/no-distracting-elements': 'error',
        '@angular-eslint/template/banana-in-box': 'error',
        '@angular-eslint/template/eqeqeq': 'error',
        '@angular-eslint/template/no-inline-styles': ['error', { allowNgStyle: true, allowBindToStyle: true }],

        // ── warn con tope (conteos al 2026-11-21) ──
        '@angular-eslint/template/button-has-type': 'warn',               // 20
        '@angular-eslint/template/interactive-supports-focus': 'warn',    // 8
        '@angular-eslint/template/click-events-have-key-events': 'warn',  // 3
        '@angular-eslint/template/label-has-associated-control': 'warn',  // 2
        '@angular-eslint/template/no-negated-async': 'warn',              // 1
        '@angular-eslint/template/prefer-control-flow': 'warn',           // ~80-92
      },
    },
  ],
};
