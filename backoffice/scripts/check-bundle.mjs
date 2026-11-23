#!/usr/bin/env node
/**
 * Guardia de tamaño del bundle de producción (complementa los budgets de angular.json, que no saben
 * distinguir chunks lazy sin nombre ni qué módulos entraron al inicial).
 *
 *   npm run build:stats && npm run check:bundle
 *   node scripts/check-bundle.mjs [dir de salida]     (default: dist/backoffice)
 *
 * Necesita `stats.json` (metafile de esbuild): `ng build --stats-json`. Sin dependencias npm.
 * Falla (exit 1) si: el inicial o un chunk lazy superan su umbral, un módulo prohibido entra al
 * inicial, o un mock no declarado viaja en el bundle. Los tamaños son bytes reales en disco (kB = 1000 B).
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.resolve(process.argv[2] ?? path.join(ROOT, 'dist', 'backoffice'));

// ── Umbrales (estado medido el 2026-11-20: inicial 521 kB / 151 kB gzip; lazy mayor 91 kB) ──────────
const LIMITES = {
  inicialRawKb: 550,   // JS + CSS del inicial, sin comprimir
  inicialGzipKb: 160,  // idem, gzip -9
  lazyRawKb: 110,      // cualquier chunk lazy
  stylesRawKb: 135,    // styles-*.css global
};

/**
 * Librerías que van SOLAS en su chunk lazy y no se pueden partir: tope propio en vez del general (que no se sube).
 * Cada una: regex sobre el input mayor del chunk → tope en kB y motivo. Solo se cargan con `import()` dinámico; si
 * una de estas aparece en el inicial, lo frena PROHIBIDO_EN_INICIAL.
 */
const LIBRERIAS_LAZY = [
  // Leaflet 1.9.4 (~148 kB minificado, sin tree-shaking posible: es un UMD). Lo baja `app-mapa-ubicacion` con
  // `import('leaflet')` recién al dibujar un mapa (diálogo del punto de atención). Medido: 149.5 kB (2026-11-21).
  [/node_modules\/leaflet\//, 160, 'Leaflet (mapa del punto de atención, import() diferido)'],
];

/** Inputs que NO pueden entrar al inicial (regex sobre la ruta del metafile → motivo). */
const PROHIBIDO_EN_INICIAL = [
  [/node_modules\/@angular\/material\//, 'Angular Material (va en los chunks lazy de cada pantalla)'],
  [/node_modules\/@angular\/cdk\//, 'Angular CDK'],
  [/node_modules\/@angular\/forms\//, '@angular/forms'],
  [/node_modules\/@angular\/animations\/fesm2022\/browser/, 'motor de animaciones (provideAnimationsAsync lo carga aparte)'],
  [/node_modules\/(chart\.js|ng2-charts|moment|lodash|leaflet)\//, 'dependencia pesada'],
  [/^src\/app\/(pages|auth)\//, 'pantallas (deben ir por loadComponent/loadChildren)'],
  [/^src\/app\/shared\/(components|layouts)\//, 'componentes compartidos (import() dinámico desde core)'],
  [/\/facades\/[^/]+\.facade\.ts$/, 'facade en el inicial (app.config debe importar <feature>.providers, no el barrel)'],
];

/** Mocks que viajan a prod A PROPÓSITO (features sin backend). Borrar la entrada al pasar el feature a real. */
const MOCKS_PERMITIDOS = [
  /core\/features\/(dashboard|auditoria|feedback)\/datasources\/[^/]+\.(mock\.datasource|mock-data)\.ts$/,
  /core\/mocks\/(mock-api\.interceptor|mock-data)\.ts$/, // legado /api/usuarios: quitar cuando se retire el interceptor
];
const ES_MOCK = /(\.mock\.datasource|[.-]mock-data|\/mocks\/mock-[\w-]+)\.ts$/;
const BYTES_STUB = 400; // excluded-mock.datasource.ts pesa ~220 B por feature; más que eso es un mock de verdad

// ── Lectura ──────────────────────────────────────────────────────────────────────────────────────
const statsPath = path.join(DIST, 'stats.json');
if (!fs.existsSync(statsPath)) {
  console.error(`[bundle] No existe ${statsPath}. Corré \`ng build --stats-json\` (npm run build:stats).`);
  process.exit(1);
}
const outs = JSON.parse(fs.readFileSync(statsPath, 'utf8')).outputs;
const BROWSER = fs.existsSync(path.join(DIST, 'browser')) ? path.join(DIST, 'browser') : DIST;
const js = Object.keys(outs).filter((o) => o.endsWith('.js'));
const leer = (o) => fs.readFileSync(path.join(BROWSER, path.basename(o)));
const kb = (n) => (n / 1000).toFixed(1);

const inicial = new Set();
const visitar = (o) => {
  if (inicial.has(o) || !outs[o]) return;
  inicial.add(o);
  for (const i of outs[o].imports ?? []) if (i.kind === 'import-statement') visitar(i.path);
};
js.filter((o) => /^(main|polyfills)[-.]/.test(path.basename(o))).forEach(visitar);

const errores = [];
let raw = 0;
let gzip = 0;
for (const o of inicial) { const b = leer(o); raw += b.length; gzip += zlib.gzipSync(b, { level: 9 }).length; }
const styles = fs.readdirSync(BROWSER).filter((f) => /^styles[-.].*\.css$/.test(f));
let stylesRaw = 0;
for (const f of styles) { const b = fs.readFileSync(path.join(BROWSER, f)); stylesRaw += b.length; raw += b.length; gzip += zlib.gzipSync(b, { level: 9 }).length; }

if (raw > LIMITES.inicialRawKb * 1000) errores.push(`inicial ${kb(raw)} kB > ${LIMITES.inicialRawKb} kB`);
if (gzip > LIMITES.inicialGzipKb * 1000) errores.push(`inicial gzip ${kb(gzip)} kB > ${LIMITES.inicialGzipKb} kB`);
if (stylesRaw > LIMITES.stylesRawKb * 1000) errores.push(`styles.css ${kb(stylesRaw)} kB > ${LIMITES.stylesRawKb} kB`);

let mayorLazy = ['', 0];
const librerias = [];
for (const o of js.filter((x) => !inicial.has(x))) {
  const n = leer(o).length;
  const top = Object.entries(outs[o].inputs).sort((a, b) => b[1].bytesInOutput - a[1].bytesInOutput)[0]?.[0] ?? '';
  const libreria = LIBRERIAS_LAZY.find(([re]) => re.test(top));
  const tope = libreria ? libreria[1] : LIMITES.lazyRawKb;
  if (libreria) librerias.push(`${libreria[2]} ${kb(n)} kB (tope ${tope} kB)`);
  else if (n > mayorLazy[1]) mayorLazy = [path.basename(o), n];
  if (n > tope * 1000) errores.push(`chunk lazy ${path.basename(o)} ${kb(n)} kB > ${tope} kB (mayor input: ${top})`);
}

for (const o of inicial) {
  for (const [input, v] of Object.entries(outs[o].inputs ?? {})) {
    if (!v.bytesInOutput) continue;
    const regla = PROHIBIDO_EN_INICIAL.find(([re]) => re.test(input));
    if (regla) errores.push(`en el inicial (${path.basename(o)}): ${input} — ${regla[1]}`);
  }
}

let mocks = 0;
for (const o of js) {
  for (const [input, v] of Object.entries(outs[o].inputs ?? {})) {
    if (!ES_MOCK.test(input) || v.bytesInOutput <= BYTES_STUB) continue;
    mocks += v.bytesInOutput;
    if (!MOCKS_PERMITIDOS.some((re) => re.test(input))) errores.push(`mock en el bundle de prod: ${input} (${kb(v.bytesInOutput)} kB en ${path.basename(o)})`);
  }
}

console.log(`[bundle] inicial ${kb(raw)} kB (gzip ${kb(gzip)} kB, ${inicial.size} JS) · styles ${kb(stylesRaw)} kB · lazy mayor ${mayorLazy[0]} ${kb(mayorLazy[1])} kB · mocks permitidos ${kb(mocks)} kB`);
if (librerias.length) console.log(`[bundle] librerías lazy con tope propio: ${librerias.join(' · ')}`);
if (errores.length) {
  console.error('[bundle] FALLA:');
  for (const e of errores) console.error(`  - ${e}`);
  process.exit(1);
}
console.log('[bundle] OK');
