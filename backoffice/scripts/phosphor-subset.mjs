#!/usr/bin/env node
/**
 * Subset de Phosphor Icons (regular) para el backoffice.
 *
 *   npm run icons        → regenera src/assets/icons/phosphor-subset.css (+ la fuente woff2)
 *   npm run icons:check  → falla (exit 1) si un ícono usado no existe en Phosphor o falta en el subset
 *
 * Al agregar un ícono nuevo hay que re-correr `npm run icons` (el `prebuild` corre `icons:check`, así que
 * `npm run build` frena si alguien se olvidó). Ver scripts/README.md para las fuentes que se escanean y
 * cómo declarar íconos dinámicos (ICON_ALLOWLIST).
 *
 * Sin dependencias npm. La fuente se subsetea con fonttools (`python -m fontTools.subset`, necesita
 * `brotli` para woff2) si está instalado; si no, se copia el woff2 completo (correcto, pero ~147 kB).
 */
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP_DIR = path.join(ROOT, 'src', 'app');
const OUT_DIR = path.join(ROOT, 'src', 'assets', 'icons');
const OUT_CSS = path.join(OUT_DIR, 'phosphor-subset.css');
const OUT_FONT_NAME = 'phosphor-subset.woff2';
const OUT_FONT = path.join(OUT_DIR, OUT_FONT_NAME);
const CHECK = process.argv.includes('--check');

/**
 * Íconos que el escaneo estático NO puede ver: nombres armados en runtime o que llegan por @Input
 * desde datos. Cada entrada dice de dónde sale. Si agregás un `ph-{{ expr }}` / `[class]="'ph-' + x"`
 * cuyo valor no aparece como literal en el código, sumalo acá.
 */
const ICON_ALLOWLIST = {
  // shared/components/row-actions: `'ph ph-' + (busy ? 'spinner-gap' : accion.icon)` (accion.icon sale de `icon: '…'` en cada lista).
  'spinner-gap': 'row-actions (estado busy)',
  // pages/feedback/feedback.component.html: `ph-{{ row.esUtil ? 'thumbs-up' : 'thumbs-down' }}`.
  'thumbs-up': 'feedback (voto útil)',
  'thumbs-down': 'feedback (voto no útil)',
  // pages/auditoria/accion-label.pipe.ts: fallback de ACCION_ICONS (`|| 'info'`).
  info: 'auditoria accionLabel (fallback)',
  // shared/layouts/admin-layout: FALLBACK_SECTION_ICON + `item.icon` de NAV_ITEMS (role-mapping.constants).
  'file-text': 'admin-layout (ícono de sección por defecto)',
  // shared/components/table: default de `emptyActionIcon` (el de `emptyIcon` está en ICON_IGNORE).
  plus: 'table (emptyActionIcon por defecto)',
  // pages/dashboard/components/dashboard-panel: `ph-{{ icon }}` (los valores son `icon="…"` en dashboard.component.html
  // y `pipelineScope.icon` = 'git-branch' en dashboard.component.ts, ambos escaneados).
  'git-branch': 'dashboard pipelineScope',
};

/**
 * Nombres que el escaneo detecta pero NO son íconos de Phosphor y se ignoran con un warning (en vez de
 * fallar el build). Usar solo para bugs conocidos con dueño; borrar la entrada al corregirlos.
 */
const ICON_IGNORE = {};

// ── 1. Íconos usados ─────────────────────────────────────────────────────────────────────────────
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(html|ts)$/.test(e.name) && !/\.spec\.ts$/.test(e.name)) out.push(p);
  }
  return out;
}

const NAME = '[a-z0-9]+(?:-[a-z0-9]+)*';
const quoted = (expr) => [...expr.matchAll(new RegExp(`'(${NAME})'`, 'g'))].map((m) => m[1]);

/** @returns {Map<string, Set<string>>} nombre → archivos donde aparece */
function collectUsed() {
  const used = new Map();
  const add = (name, file) => {
    if (!used.has(name)) used.set(name, new Set());
    used.get(name).add(path.relative(ROOT, file).replace(/\\/g, '/'));
  };

  for (const file of walk(APP_DIR)) {
    const src = fs.readFileSync(file, 'utf8');

    // Clases literales `ph-<nombre>` (class="ph ph-x", [class.ph-x], comentarios con `ph-x`).
    for (const m of src.matchAll(new RegExp(`(?<![\\w-])ph-(${NAME})(?![\\w-])`, 'g'))) add(m[1], file);

    // Expresiones dinámicas: `ph-{{ expr }}` y `[class]="… 'ph-' + expr"` → literales entre comillas simples.
    // Los argumentos de pipes (`| accionLabel:'icon'`) no son nombres de ícono: se descartan.
    const sinPipes = (expr) => expr.replace(/\|\s*\w+(?:\s*:\s*(?:'[^']*'|[\w.]+))*/g, '');
    for (const m of src.matchAll(/ph-\{\{([^}]*)\}\}/g)) quoted(sinPipes(m[1])).forEach((n) => add(n, file));
    for (const m of src.matchAll(/\[class\]="([^"]*'ph[ -][^"]*)"/g)) {
      quoted(m[1]).filter((n) => n !== 'ph').forEach((n) => add(n, file));
    }

    if (file.endsWith('.html')) {
      // Atributos de ícono: icon="x", emptyIcon="x", emptyActionIcon="x" …
      for (const m of src.matchAll(new RegExp(`\\s\\w*[iI]con\\w*="(${NAME})"`, 'g'))) add(m[1], file);
      // Bindings: [emptyIcon]="'x'", [emptyActionIcon]="cond ? 'x' : 'plus'" …
      for (const m of src.matchAll(/\[\w*[iI]con\w*\]="([^"]*)"/g)) quoted(m[1]).forEach((n) => add(n, file));
    } else {
      // Propiedades/constantes TS: icon: 'x', icono: 'x', emptyIcon = 'x', FALLBACK_SECTION_ICON = 'x' …
      for (const m of src.matchAll(new RegExp(`\\b\\w*icono?\\w*\\??\\s*[:=]\\s*'(${NAME})'`, 'gi'))) add(m[1], file);
      // Mapas `XXX_ICONS = { clave: 'x', … }` (ej. ACCION_ICONS en pages/auditoria/accion-label.pipe.ts).
      for (const m of src.matchAll(/\b\w*_ICONS\b[^=]*=\s*\{([^}]*)\}/g)) {
        for (const v of m[1].matchAll(new RegExp(`:\\s*'(${NAME})'`, 'g'))) add(v[1], file);
      }
    }
  }
  for (const name of Object.keys(ICON_ALLOWLIST)) add(name, path.join(ROOT, 'scripts', 'phosphor-subset.mjs'));
  for (const [name, motivo] of Object.entries(ICON_IGNORE)) {
    if (used.delete(name)) console.warn(`[icons] warning: se ignora '${name}' — ${motivo}`);
  }
  return used;
}

// ── 2. Phosphor ──────────────────────────────────────────────────────────────────────────────────
function phosphorCssPath() {
  const require = createRequire(import.meta.url);
  // El `exports` del paquete mapea `./*` → `./src/*`; se prueban ambas formas por si cambia.
  for (const spec of ['@phosphor-icons/web/regular/style.css', '@phosphor-icons/web/src/regular/style.css']) {
    try {
      return require.resolve(spec);
    } catch {
      /* siguiente */
    }
  }
  const fallback = path.join(ROOT, 'node_modules', '@phosphor-icons', 'web', 'src', 'regular', 'style.css');
  if (fs.existsSync(fallback)) return fallback;
  throw new Error('No se encontró @phosphor-icons/web/src/regular/style.css (¿falta npm install?)');
}

function readPhosphor() {
  const cssPath = phosphorCssPath();
  const css = fs.readFileSync(cssPath, 'utf8');
  const base = css.match(/\.ph\s*\{[\s\S]*?\n\}/);
  if (!base) throw new Error(`No se encontró la regla base .ph en ${cssPath}`);
  /** @type {Map<string, string>} nombre → content (escape CSS, ej. "\\e4f8") */
  const rules = new Map();
  for (const m of css.matchAll(/\.ph\.ph-([a-z0-9-]+):before\s*\{\s*content:\s*"([^"]+)";\s*\}/g)) rules.set(m[1], m[2]);
  return { cssPath, baseRule: base[0], rules, fontPath: path.join(path.dirname(cssPath), 'Phosphor.woff2') };
}

// ── 3. Fuente ────────────────────────────────────────────────────────────────────────────────────
function subsetFont(fontPath, codepoints) {
  const unicodes = codepoints.map((c) => `U+${c.toString(16).toUpperCase()}`).join(',');
  const args = [
    '-m', 'fontTools.subset', fontPath,
    `--unicodes=${unicodes}`,
    '--flavor=woff2',
    `--output-file=${OUT_FONT}`,
    '--layout-features=', // los íconos se pintan por codepoint (`content`), no por ligadura
    '--no-hinting',
    '--desubroutinize',
  ];
  for (const py of ['python3', 'python', 'py']) {
    const r = spawnSync(py, args, { encoding: 'utf8' });
    if (r.error) continue; // intérprete inexistente
    if (r.status === 0 && fs.existsSync(OUT_FONT)) return `subset con fonttools (${py})`;
    if (/No module named|ModuleNotFoundError/.test(r.stderr || '')) continue;
    console.warn(`[icons] fonttools falló con ${py}:\n${(r.stderr || '').trim()}`);
  }
  fs.copyFileSync(fontPath, OUT_FONT);
  return 'fuente COMPLETA (fonttools/brotli no disponible: `pip install fonttools brotli` para subsetear)';
}

// ── main ─────────────────────────────────────────────────────────────────────────────────────────
const used = collectUsed();
const { cssPath, baseRule, rules, fontPath } = readPhosphor();
const names = [...used.keys()].sort();
const unknown = names.filter((n) => !rules.has(n));

if (unknown.length) {
  console.error('[icons] Íconos usados que NO existen en Phosphor (regular):');
  for (const n of unknown) console.error(`  - ph-${n}  ←  ${[...used.get(n)].join(', ')}`);
}

if (CHECK) {
  const present = new Set();
  if (fs.existsSync(OUT_CSS)) {
    for (const m of fs.readFileSync(OUT_CSS, 'utf8').matchAll(/\.ph\.ph-([a-z0-9-]+):before/g)) present.add(m[1]);
  }
  const missing = names.filter((n) => rules.has(n) && !present.has(n));
  const fontOk = fs.existsSync(OUT_FONT);
  if (missing.length) {
    console.error('[icons] Íconos usados que faltan en src/assets/icons/phosphor-subset.css (correr `npm run icons`):');
    for (const n of missing) console.error(`  - ph-${n}  ←  ${[...used.get(n)].join(', ')}`);
  }
  if (!fontOk) console.error(`[icons] Falta src/assets/icons/${OUT_FONT_NAME} (correr \`npm run icons\`).`);
  if (unknown.length || missing.length || !fontOk) process.exit(1);
  console.log(`[icons] OK: ${names.length} íconos usados, todos presentes en el subset.`);
  process.exit(0);
}

if (unknown.length) process.exit(1);

fs.mkdirSync(OUT_DIR, { recursive: true });
const codepoints = names.map((n) => parseInt(rules.get(n).replace(/^\\/, ''), 16));
const fontMode = subsetFont(fontPath, codepoints);

const header = `/*
 * GENERADO por scripts/phosphor-subset.mjs — NO editar a mano. Re-generar con \`npm run icons\`.
 * Fuente: @phosphor-icons/web (regular), ${names.length} íconos de ${rules.size}. Fuente woff2: ${fontMode}.
 */`;
const fontFace = `@font-face {
  font-family: "Phosphor";
  src: url("./${OUT_FONT_NAME}") format("woff2");
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}`;
const body = names.map((n) => `.ph.ph-${n}:before {\n  content: "${rules.get(n)}";\n}`).join('\n');
fs.writeFileSync(OUT_CSS, `${header}\n${fontFace}\n\n${baseRule}\n\n${body}\n`);

const kb = (f) => (fs.statSync(f).size / 1024).toFixed(1);
console.log(`[icons] ${names.length} íconos → ${path.relative(ROOT, OUT_CSS)} (${kb(OUT_CSS)} KiB)`);
console.log(`[icons] ${fontMode} → ${path.relative(ROOT, OUT_FONT)} (${kb(OUT_FONT)} KiB; original ${kb(fontPath)} KiB)`);
console.log(`[icons] origen: ${path.relative(ROOT, cssPath)}`);
