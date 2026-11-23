#!/usr/bin/env node
/**
 * Valida la ESTRUCTURA de carpetas y nombres de `src/app/core/features/*` y `src/app/pages/*` contra la
 * convención del proyecto (.claude/rules/arquitectura-capas.md). Solo lectura, Node puro.
 *
 *   npm run check:structure                       todo el árbol
 *   node scripts/check-structure.mjs --file <f>   solo desvíos NUEVOS del feature/sección de ese archivo (hooks)
 *   node scripts/check-structure.mjs --prune      borra del baseline las excepciones ya resueltas
 *   node scripts/check-structure.mjs --list       lista todos los desvíos (conocidos + nuevos), sin fallar
 *
 * Baseline con trinquete: `scripts/check-structure.baseline.json` lista los desvíos conocidos. Falla ante un
 * desvío nuevo Y ante una excepción que ya no existe (obliga a borrarla). Ver scripts/lib/baseline.mjs.
 *
 * Convención:
 *   core/features/<f>/  index.ts · <f>.providers.ts · models/ (*.dto.ts, *.vm.ts) · mappers/ (<f>.mapper.ts)
 *                       domain/ (opcional, reglas puras) · datasources/ (<f>.datasource.ts, .http.datasource.ts,
 *                       .mock.datasource.ts, .mock-data.ts opcional) · repositories/ · facades/
 *     barrel: exporta el Facade, tipos y provide<F>Feature; el Repository solo si lo consume otro feature;
 *             nunca datasources ni mappers.
 *   pages/<sección>/    componentes solo bajo list/ form/ detail/ dialog/ o components/<pieza>/ (y home/, solo en
 *                       dashboard); en la raíz solo helpers *-save-error.ts, *-accion-error.ts, *-dialogo.ts,
 *                       *-textos.ts, *.rutas.ts (+ specs); cada *.component.ts con su .html y .scss.
 *   Detalle y motivos: .claude/rules/pantallas-lista-dialogo.md.
 *
 * Además, MARKUP UNIFICADO (lo que ya tiene una sola forma y no se vuelve a escribir a mano; sin baseline: 0):
 *   - `familia-paneles`: las clases `detail-grid` / `detail-col` / `detail-card` se unificaron en `.ficha-paneles`
 *     (`shared-styles/_components.scss`); no existen más.
 *   - `membrete-inline`: el membrete de una entidad es `<app-membrete>` (`shared/components/membrete`); un
 *     `<header class="detail-header …">` escrito en otro lado es una copia.
 *   Detalle: .claude/rules/scss-bem.md y DESIGN.md §6.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compararConBaseline, informar, podarBaseline } from './lib/baseline.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP = path.join(ROOT, 'src', 'app');
const BASELINE = path.join(ROOT, 'scripts', 'check-structure.baseline.json');

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const fileArg = args.includes('--file') ? args[args.indexOf('--file') + 1] : null;

const rd = (d) => fs.readdirSync(d, { withFileTypes: true });
const posix = (p) => p.split(path.sep).join('/');
const desvios = [];
const err = (regla, file, msg) => desvios.push({ regla, archivo: posix(path.relative(APP, file)), msg });
const isSpec = (n) => n.endsWith('.spec.ts');

// ── FEATURES ─────────────────────────────────────────────────────────────────────────────────────
const FEAT = path.join(APP, 'core', 'features');
const LAYERS = ['models', 'mappers', 'domain', 'datasources', 'repositories', 'facades'];
const features = rd(FEAT).filter((e) => e.isDirectory()).map((e) => e.name);

/** Texto de todos los .ts (sin specs) de cada feature, para saber quién consume un Repository ajeno. */
const fuentesDe = (dir, acc = []) => {
  for (const e of rd(dir)) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) fuentesDe(p, acc);
    else if (e.name.endsWith('.ts') && !isSpec(e.name)) acc.push(fs.readFileSync(p, 'utf8'));
  }
  return acc;
};
const textoPorFeature = Object.fromEntries(features.map((f) => [f, fuentesDe(path.join(FEAT, f)).join('\n')]));

for (const n of features) {
  const dir = path.join(FEAT, n);
  for (const e of rd(dir)) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!LAYERS.includes(e.name)) err('feat-dir', p, `carpeta no permitida (${LAYERS.join('|')})`);
      continue;
    }
    if (e.name !== 'index.ts' && e.name !== `${n}.providers.ts` && !isSpec(e.name)) {
      err('feat-root-file', p, 'en la raíz del feature solo index.ts y <feature>.providers.ts');
    }
  }
  for (const req of ['index.ts', `${n}.providers.ts`, `facades/${n}.facade.ts`, `repositories/${n}.repository.ts`,
    `datasources/${n}.datasource.ts`, `datasources/${n}.mock.datasource.ts`]) {
    if (!fs.existsSync(path.join(dir, req))) err('feat-missing', path.join(dir, req), 'archivo requerido');
  }
  const chk = (layer, re, hint) => {
    const d = path.join(dir, layer);
    if (!fs.existsSync(d)) return;
    for (const e of rd(d)) {
      if (e.isDirectory()) { err('feat-nested', path.join(d, e.name), 'sin subcarpetas dentro de la capa'); continue; }
      if (!isSpec(e.name) && !re.test(e.name)) err('feat-name', path.join(d, e.name), hint);
    }
  };
  chk('facades', new RegExp(`^${n}\\.facade\\.ts$`), `debe llamarse ${n}.facade.ts`);
  chk('repositories', new RegExp(`^${n}\\.repository\\.ts$`), `debe llamarse ${n}.repository.ts`);
  chk('mappers', new RegExp(`^${n}\\.mapper\\.ts$`), `debe llamarse ${n}.mapper.ts`);
  chk('datasources', new RegExp(`^${n}\\.(datasource|http\\.datasource|mock\\.datasource|mock-data)\\.ts$`),
    `debe ser ${n}.{datasource,http.datasource,mock.datasource,mock-data}.ts`);
  chk('models', /\.(dto|vm)\.ts$/, 'models/ solo *.dto.ts y *.vm.ts (las reglas de dominio van a domain/)');
  chk('domain', /^[a-z0-9-]+\.ts$/, 'domain/ solo archivos kebab-case .ts');

  const idx = path.join(dir, 'index.ts');
  if (fs.existsSync(idx)) {
    const s = fs.readFileSync(idx, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    for (const m of s.matchAll(/export[^;]*?from\s+['"]\.\/(datasources|mappers)\//g)) {
      err('barrel-internal', idx, `el barrel no exporta ${m[1]}`);
    }
    if (!/provide[A-Za-z]+Feature/.test(s)) err('barrel-provider', idx, 'falta provide<Feature>Feature');
    if (!/Facade/.test(s)) err('barrel-facade', idx, 'falta el Facade');
    for (const m of s.matchAll(/\b([A-Z]\w*Repository)\b/g)) {
      const usado = features.some((o) => o !== n && new RegExp(`\\b${m[1]}\\b`).test(textoPorFeature[o]));
      if (!usado) err('barrel-repository', idx, `${m[1]} se exporta pero ningún otro feature lo consume (sacalo del barrel)`);
    }
  }
}

// ── PAGES ────────────────────────────────────────────────────────────────────────────────────────
const PAGES = path.join(APP, 'pages');
const KINDS = ['list', 'form', 'detail', 'dialog', 'components'];
// Tipos extra válidos SOLO en una sección. `home` = pantalla de inicio: única sección sin lista.
const KINDS_POR_SECCION = { dashboard: ['home'] };
const SUBSECCIONES = { tramites: true }; // secciones que agrupan sub-secciones (tramites/plantillas, …)
// `-save-error`: rechazos al GUARDAR un formulario (o al eliminar la entidad del formulario).
// `-accion-error`: rechazos de acciones que no son un guardado (activar, desactivar, cambiar credencial…).
const HELPER_SUFIJOS = '-save-error|-accion-error|-dialogo|-textos|.rutas';
const HELPER_OK = /(-save-error|-accion-error|-dialogo|-textos)\.ts$|\.rutas\.ts$/;

function seccion(dir, esSub) {
  const kinds = [...KINDS, ...(KINDS_POR_SECCION[path.basename(dir)] ?? [])];
  for (const e of rd(dir)) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (kinds.includes(e.name)) { tipo(p); continue; }
      if (!esSub && SUBSECCIONES[path.basename(dir)]) { seccion(p, true); continue; }
      err('page-dir', p, `carpeta fuera de ${kinds.join('|')}`);
      continue;
    }
    if (!e.name.endsWith('.ts')) continue;
    if (isSpec(e.name)) {
      if (!fs.existsSync(path.join(dir, e.name.replace('.spec.ts', '.ts')))) err('page-root-spec', p, 'spec suelto sin su archivo');
      continue;
    }
    if (e.name.endsWith('.component.ts')) { err('page-comp-root', p, `componente suelto: va en ${kinds.join('|')}/`); continue; }
    if (!HELPER_OK.test(e.name)) err('page-helper', p, `helper de sección debe terminar en ${HELPER_SUFIJOS}`);
  }
}
function tipo(dir) {
  for (const e of rd(dir)) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { tipo(p); continue; }
    if (!e.name.endsWith('.component.ts')) continue;
    const base = p.slice(0, -3);
    for (const ext of ['.html', '.scss']) if (!fs.existsSync(base + ext)) err('page-trio', p, `falta ${path.basename(base)}${ext}`);
  }
}
for (const s of rd(PAGES)) {
  if (s.isDirectory()) seccion(path.join(PAGES, s.name), false);
  else if (s.name !== 'pages.module.ts') err('page-root-file', path.join(PAGES, s.name), 'archivo suelto en pages/');
}

// ── MARKUP UNIFICADO ─────────────────────────────────────────────────────────────────────────────
// Se mira todo `src/` (templates, estilos y código, sin specs): la familia eliminada tampoco puede volver por
// una clase armada en un `.ts` ni redefinirse en un `.scss`.
const SRC = path.join(ROOT, 'src');
const FAMILIA_ELIMINADA = /(?<![\w-])detail-(grid|col|card)(?![\w])/;
const MEMBRETE_INLINE = /<header[^>]*class="[^"]*detail-header(?![\w-])/;
const MEMBRETE_PROPIO = 'app/shared/components/membrete/';
function markup(dir) {
  for (const e of rd(dir)) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'assets') markup(p); continue; }
    if (!/\.(html|scss|ts)$/.test(e.name) || isSpec(e.name)) continue;
    const texto = fs.readFileSync(p, 'utf8');
    if (FAMILIA_ELIMINADA.test(texto)) {
      err('familia-paneles', p, 'usa `detail-grid` / `detail-col` / `detail-card`: la familia de paneles es `.ficha-paneles` (`--separados` para tarjetas sueltas)');
    }
    if (e.name.endsWith('.html') && MEMBRETE_INLINE.test(texto) && !posix(path.relative(SRC, p)).startsWith(MEMBRETE_PROPIO)) {
      err('membrete-inline', p, 'membrete escrito a mano (`<header class="detail-header …">`): usá `<app-membrete>`');
    }
  }
}
markup(SRC);

// ── Salida ───────────────────────────────────────────────────────────────────────────────────────
if (flag('--list')) {
  for (const d of desvios) console.log(`${d.regla.padEnd(18)} ${d.archivo}  — ${d.msg}`);
  const by = {};
  for (const d of desvios) by[d.regla] = (by[d.regla] ?? 0) + 1;
  console.log(`\nTOTAL ${desvios.length}`, by);
  process.exit(0);
}

let resultado = compararConBaseline(desvios, BASELINE);

if (flag('--prune')) {
  const n = podarBaseline(BASELINE, resultado.obsoletas);
  console.log(`[structure] baseline: ${n} excepción(es) obsoleta(s) borrada(s).`);
  resultado = compararConBaseline(desvios, BASELINE);
}

if (fileArg) {
  // Modo por archivo: solo los desvíos nuevos del mismo feature / sección que el archivo editado.
  const rel = posix(path.relative(APP, path.resolve(fileArg)));
  const m = /^(core\/features\/[^/]+|pages\/[^/]+)(\/|$)/.exec(rel);
  const ambito = m ? m[1] : rel.startsWith('pages/') ? rel : null;
  resultado = {
    ...resultado,
    nuevos: ambito ? resultado.nuevos.filter((d) => d.archivo === ambito || d.archivo.startsWith(`${ambito}/`) || d.archivo === rel) : [],
  };
}

process.exit(informar('structure', resultado, {
  rutaBaseline: 'scripts/check-structure.baseline.json',
  soloNuevos: Boolean(fileArg),
  ayuda: 'Movelo a su lugar según la convención (ver cabecera de scripts/check-structure.mjs y .claude/rules/arquitectura-capas.md). No lo agregues al baseline.',
}));
