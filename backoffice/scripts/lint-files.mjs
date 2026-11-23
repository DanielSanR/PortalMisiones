#!/usr/bin/env node
/**
 * Lint POR ARCHIVO, solo ERRORES (los warnings con tope se miden en `npm run lint` / `lint:styles`, no acá).
 * Lo usan el hook PostToolUse de Claude Code y el pre-commit de git. ESLint y stylelint corren en proceso
 * (API de Node) para que tarde ~2 s y no dependa de bash/npx.
 *
 *   node scripts/lint-files.mjs <archivo> [<archivo>…]     rutas absolutas o relativas a backoffice/
 *   node scripts/lint-files.mjs --staged                   los archivos staged de backoffice/src (pre-commit)
 *
 * .ts/.html bajo src/app → ESLint · .scss bajo src → stylelint · el resto se ignora.
 * Exit 1 con el detalle por stderr si hay errores. Fail-open (exit 0) si falta node_modules.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import nodeModule from 'node:module';

// Node >= 22.1: caché de compilación de V8 para el arranque de ESLint/stylelint. En Node 20 no existe: no-op.
try { nodeModule.enableCompileCache?.(); } catch { /* opcional */ }

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const posix = (p) => p.split(path.sep).join('/');

let entrada = process.argv.slice(2);
if (entrada.includes('--staged')) {
  try {
    entrada = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '--relative', '-z', '--', 'src'], { cwd: ROOT, encoding: 'utf8' })
      .split('\0').filter(Boolean);
  } catch {
    process.exit(0); // sin git: nada que mirar
  }
}

const archivos = [...new Set(entrada.map((f) => path.resolve(ROOT, f)))].filter((f) => fs.existsSync(f) && fs.statSync(f).isFile());
const rel = (f) => posix(path.relative(ROOT, f));
const ts = archivos.filter((f) => /\.(ts|html)$/.test(f) && rel(f).startsWith('src/app/'));
const scss = archivos.filter((f) => f.endsWith('.scss') && rel(f).startsWith('src/'));

if (!fs.existsSync(path.join(ROOT, 'node_modules'))) {
  console.warn('[lint-files] sin node_modules: se saltea (corré `npm ci` en backoffice/).');
  process.exit(0);
}

const errores = [];

if (ts.length) {
  try {
    const { ESLint } = await import('eslint');
    const eslint = new ESLint({ cwd: ROOT });
    const resultados = ESLint.getErrorResults(await eslint.lintFiles(ts));
    for (const r of resultados) {
      for (const m of r.messages) errores.push(`${rel(r.filePath)}:${m.line}:${m.column}  ${m.ruleId ?? 'parse'}  ${m.message}`);
    }
  } catch (e) {
    console.warn(`[lint-files] ESLint no pudo correr (se saltea): ${String(e.message).split('\n')[0]}`);
  }
}

if (scss.length) {
  try {
    const stylelint = (await import('stylelint')).default;
    const { results } = await stylelint.lint({ files: scss.map(posix), cwd: ROOT, quiet: true });
    for (const r of results) {
      for (const w of r.warnings) if (w.severity === 'error') errores.push(`${rel(r.source)}:${w.line}:${w.column}  ${w.rule}  ${w.text.replace(/\s*\([\w/-]+\)$/, '')}`);
    }
  } catch (e) {
    console.warn(`[lint-files] stylelint no pudo correr (se saltea): ${String(e.message).split('\n')[0]}`);
  }
}

if (errores.length) {
  console.error(`[lint-files] ${errores.length} error(es):`);
  for (const e of errores) console.error(`  ${e}`);
  process.exit(1);
}
process.exit(0);
