#!/usr/bin/env node
/**
 * Código muerto y peso del SCSS (lo que stylelint no ve porque cruza archivos). Solo lectura.
 *
 *   npm run check:styles
 *   node scripts/check-styles.mjs --file <f.scss>   solo la regla 3 sobre ese archivo (hooks, sin compilar)
 *   node scripts/check-styles.mjs --prune           borra del baseline las excepciones ya resueltas
 *   node scripts/check-styles.mjs --list            lista todos los desvíos (conocidos + nuevos), sin fallar
 *
 * Reglas:
 *   mixin-sin-uso      todo `@mixin` de shared-styles/_mixins.scss tiene al menos un `@include`.
 *   clase-sin-uso      toda clase de shared-styles/_components.scss y _base.scss aparece en algún .html/.ts
 *                      (o se arma dinámicamente: ver CLASES_DINAMICAS).
 *   scss-vacio         ningún *.component.scss completamente vacío. Un componente sin estilos propios conserva su
 *                      .scss (check-structure exige el trío .ts/.html/.scss) con SOLO un comentario que dice por
 *                      qué no los tiene (qué clases globales usa): eso es válido. Falla si no hay ni reglas ni
 *                      comentario, o si lo único que hay es código sin reglas (p. ej. un `@use` suelto).
 *   use-sin-include    ningún `@use '…/mixins'` sin usar el namespace.
 *   token-sin-uso      todo `--theme-*` de shared-styles/_themes.scss tiene un consumidor: un `var(--theme-x)` en el
 *                      CSS compilado (global o de un componente; así cuentan los nombres que arma Sass por
 *                      interpolación), su nombre en un .ts/.html, u otro token que sí se consume y lo referencia.
 *                      Un token que solo referencian tokens sin uso también está sin uso.
 *   peso-componente    AVISO (no falla) si el CSS compilado de un componente supera AVISO_KB; el límite duro
 *                      es el budget `anyComponentStyle` de angular.json.
 *
 * Baseline con trinquete: `scripts/check-styles.baseline.json` (ver scripts/lib/baseline.mjs).
 * Usa el `sass` del proyecto (dependencia de @angular-devkit/build-angular); sin él, saltea lo que compila.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { compararConBaseline, informar, podarBaseline } from './lib/baseline.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const BASELINE = path.join(ROOT, 'scripts', 'check-styles.baseline.json');
const AVISO_KB = 12;

/**
 * Clases globales que se arman en runtime (no aparecen como literal completo). Prefijo → dónde se arma.
 * Además se detecta solo el patrón `prefijo{{ … }}` / `prefijo${ … }` / `'prefijo' + …` en html/ts.
 */
const CLASES_DINAMICAS = [
  'cell-avatar--', // TableComponent: color del avatar por hash del nombre
  'pill--',        // EstadoBadgePipe / badges: variante por estado
];
/** Clases que pone una librería o el framework, no nuestro código. */
const CLASES_EXTERNAS = /^(mat-|mdc-|cdk-|ng-|ph$|ph-)/;

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const fileArg = args.includes('--file') ? args[args.indexOf('--file') + 1] : null;

const posix = (p) => p.split(path.sep).join('/');
const rel = (p) => posix(path.relative(ROOT, p));
const walk = (dir, exts, acc = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, exts, acc);
    else if (exts.some((x) => e.name.endsWith(x))) acc.push(p);
  }
  return acc;
};
const sinComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const desvios = [];
const err = (regla, archivo, msg) => desvios.push({ regla, archivo, msg });
const avisos = [];

// ── 3. scss-vacio / use-sin-include (por archivo) ────────────────────────────────────────────────
function revisarComponente(p) {
  const crudo = fs.readFileSync(p, 'utf8');
  const s = sinComentarios(crudo);
  if (!/\{/.test(s)) {
    // Sin reglas: solo vale si el archivo es únicamente un comentario con texto (el motivo).
    const comentarios = [...crudo.matchAll(/\/\*([\s\S]*?)\*\/|(?:^|[^:])\/\/(.*)$/gm)].map((m) => m[1] ?? m[2] ?? '').join(' ');
    const explica = /[A-Za-zÁÉÍÓÚáéíóúñ]{3,}/.test(comentarios);
    if (s.trim() !== '') err('scss-vacio', rel(p), 'código sin ninguna regla: escribí los estilos o dejá solo el comentario que explica por qué no hay');
    else if (!explica) err('scss-vacio', rel(p), 'archivo vacío: escribí los estilos o un comentario de una línea que diga por qué el componente no tiene estilos propios');
  }
  for (const m of s.matchAll(/@use\s+['"]([^'"]*mixins)['"](?:\s+as\s+([\w*-]+))?/g)) {
    const ns = m[2] ?? m[1].split('/').pop().replace(/^_/, '');
    const usado = ns === '*' ? /@include\s/.test(s) : new RegExp(`\\b${escapar(ns)}\\.`).test(s);
    if (!usado) err('use-sin-include', rel(p), `\`@use '${m[1]}'\` sin ningún \`@include\` de ese módulo: quitá el @use`);
  }
}

if (fileArg) {
  const p = path.resolve(fileArg);
  if (p.endsWith('.component.scss') && fs.existsSync(p)) revisarComponente(p);
  const r = compararConBaseline(desvios, BASELINE);
  process.exit(informar('styles', r, { rutaBaseline: 'scripts/check-styles.baseline.json', soloNuevos: true }));
}

const scss = walk(SRC, ['.scss']);
const componentes = scss.filter((p) => p.endsWith('.component.scss'));
componentes.forEach(revisarComponente);

// ── 1. mixin-sin-uso ─────────────────────────────────────────────────────────────────────────────
const MIXINS = path.join(SRC, 'shared-styles', '_mixins.scss');
const todoScss = scss.map((p) => sinComentarios(fs.readFileSync(p, 'utf8'))).join('\n');
for (const m of sinComentarios(fs.readFileSync(MIXINS, 'utf8')).matchAll(/@mixin\s+([\w-]+)/g)) {
  if (!new RegExp(`@include\\s+(?:[\\w-]+\\.)?${escapar(m[1])}(?![\\w-])`).test(todoScss)) {
    err('mixin-sin-uso', `src/shared-styles/_mixins.scss#${m[1]}`, 'mixin sin ningún @include: borralo');
  }
}

// ── sass del proyecto (reglas 2 y 4) ─────────────────────────────────────────────────────────────
let sass = null;
try { sass = createRequire(import.meta.url)('sass'); } catch { /* sin sass: se saltea lo que compila */ }
const compilar = (p) => sass.compile(p, { loadPaths: [SRC, path.join(ROOT, 'node_modules')], style: 'compressed', quietDeps: true, logger: sass.Logger?.silent }).css;

if (!sass) {
  console.warn('[styles] AVISO: no se encontró `sass`; se saltean clase-sin-uso y peso-componente.');
} else {
  // ── 2. clase-sin-uso ───────────────────────────────────────────────────────────────────────────
  const fuentes = [...walk(path.join(SRC, 'app'), ['.html', '.ts']).filter((p) => !p.endsWith('.spec.ts')), path.join(SRC, 'index.html')];
  const texto = fuentes.map((p) => fs.readFileSync(p, 'utf8')).join('\n');
  const esDinamica = (c) => {
    const i = c.indexOf('--');
    if (i < 0) return false;
    const pref = c.slice(0, i + 2);
    if (CLASES_DINAMICAS.includes(pref)) return true;
    return new RegExp(`${escapar(pref)}(\\{\\{|\\$\\{|['"\`]\\s*\\+)`).test(texto);
  };
  for (const archivo of ['_components.scss', '_base.scss']) {
    const p = path.join(SRC, 'shared-styles', archivo);
    if (!fs.existsSync(p)) continue;
    const css = compilar(p).replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, '""');
    const clases = new Set();
    // Selectores = lo que precede a cada `{` (se descartan los preludios de at-rules).
    for (const m of css.matchAll(/(?:^|[{}])([^{}@]+)\{/g)) {
      for (const c of m[1].matchAll(/\.([a-zA-Z_][\w-]*)/g)) clases.add(c[1]);
    }
    for (const c of [...clases].sort()) {
      if (CLASES_EXTERNAS.test(c) || esDinamica(c)) continue;
      if (!new RegExp(`(^|[^\\w-])${escapar(c)}($|[^\\w-])`).test(texto)) {
        err('clase-sin-uso', `src/shared-styles/${archivo}#.${c}`, 'clase global que no aparece en ningún .html/.ts: borrala (o sumá su prefijo a CLASES_DINAMICAS)');
      }
    }
  }

  // ── 4. peso-componente (aviso) ─────────────────────────────────────────────────────────────────
  const cssDeComponentes = [];
  for (const p of componentes) {
    try {
      const css = compilar(p);
      cssDeComponentes.push(css);
      const kb = Buffer.byteLength(css) / 1000;
      if (kb > AVISO_KB) avisos.push(`${rel(p)} compila a ${kb.toFixed(1)} kB (> ${AVISO_KB} kB): partí el componente o subí lo común a shared-styles`);
    } catch (e) {
      err('scss-no-compila', rel(p), String(e.message).split('\n')[0]);
    }
  }

  // ── 5. token-sin-uso ───────────────────────────────────────────────────────────────────────────
  try {
    // Definiciones: nombre → tokens que su valor referencia.
    const cssDeTemas = compilar(path.join(SRC, 'shared-styles', '_themes.scss'));
    const referencias = new Map();
    for (const m of cssDeTemas.matchAll(/(--theme-[\w-]+):((?:[^;{}"']|"[^"]*"|'[^']*')*)/g)) {
      referencias.set(m[1], [...m[2].matchAll(/var\((--theme-[\w-]+)/g)].map((r) => r[1]));
    }
    // Consumidores directos. El CSS global es el de styles.scss sin el bloque de definiciones (si no, las
    // referencias entre tokens contarían como uso).
    const cssGlobal = compilar(path.join(SRC, 'styles.scss'));
    if (!cssGlobal.includes(cssDeTemas)) throw new Error('el CSS de _themes.scss no aparece tal cual en el de styles.scss: revisá la regla token-sin-uso');
    const cssConsumidor = [cssGlobal.replace(cssDeTemas, ''), ...cssDeComponentes].join('\n');
    const vivos = new Set([...cssConsumidor.matchAll(/var\((--theme-[\w-]+)/g)].map((m) => m[1]));
    for (const m of texto.matchAll(/--theme-[\w-]+/g)) {
      // `--theme-estado-${clave}` o `'--theme-estado-' + clave`: nombre armado en runtime, cuenta todo el prefijo.
      const sigue = texto.slice(m.index + m[0].length, m.index + m[0].length + 4);
      if (m[0].endsWith('-') || /^(\$\{|\{\{|['"`]\s*\+)/.test(sigue)) {
        for (const token of referencias.keys()) if (token.startsWith(m[0])) vivos.add(token);
      } else {
        vivos.add(m[0]);
      }
    }
    // Un token en uso mantiene en uso a los que referencia.
    const pendientes = [...vivos];
    while (pendientes.length) {
      for (const ref of referencias.get(pendientes.pop()) ?? []) {
        if (vivos.has(ref)) continue;
        vivos.add(ref);
        pendientes.push(ref);
      }
    }
    for (const token of [...referencias.keys()].sort()) {
      if (!vivos.has(token)) err('token-sin-uso', `src/shared-styles/_themes.scss#${token}`, 'token sin consumidor (ni CSS, ni .ts/.html, ni otro token en uso): borralo');
    }
  } catch (e) {
    err('scss-no-compila', 'src/styles.scss', String(e.message).split('\n')[0]);
  }
}

// ── Salida ───────────────────────────────────────────────────────────────────────────────────────
for (const a of avisos) console.warn(`[styles] AVISO peso-componente: ${a}`);

if (flag('--list')) {
  for (const d of desvios) console.log(`${d.regla.padEnd(16)} ${d.archivo}  — ${d.msg}`);
  const by = {};
  for (const d of desvios) by[d.regla] = (by[d.regla] ?? 0) + 1;
  console.log(`\nTOTAL ${desvios.length}`, by);
  process.exit(0);
}

let resultado = compararConBaseline(desvios, BASELINE);
if (flag('--prune')) {
  const n = podarBaseline(BASELINE, resultado.obsoletas);
  console.log(`[styles] baseline: ${n} excepción(es) obsoleta(s) borrada(s).`);
  resultado = compararConBaseline(desvios, BASELINE);
}
process.exit(informar('styles', resultado, {
  rutaBaseline: 'scripts/check-styles.baseline.json',
  ayuda: 'Borrá el código muerto en vez de sumarlo al baseline.',
}));
