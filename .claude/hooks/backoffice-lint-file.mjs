#!/usr/bin/env node
/**
 * PostToolUse (Edit|Write|MultiEdit) — SÍNCRONO, por archivo.
 *
 * Si el archivo editado está en backoffice/src:
 *   .ts / .html → ESLint solo sobre ese archivo        (scripts/lint-files.mjs)
 *   .scss       → stylelint solo sobre ese archivo + check-styles --file
 *   siempre     → check-structure --file (carpetas/nombres del feature o sección)
 * Solo fallan los ERRORES; los warnings con tope se miden en `npm run lint` (gate de Stop).
 *
 * Exit 2 + detalle por stderr → Claude lo recibe y lo corrige en el mismo turno.
 * Fail-open: sin node_modules, sin node o ante un fallo propio del hook → exit 0.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { BACKOFFICE, archivoEditado, hayNodeModules, leerEvento, salir } from './backoffice-lib.mjs';

const correr = (args) => new Promise((resolve) => {
  const p = spawn(process.execPath, args, { cwd: BACKOFFICE, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  p.stdout.on('data', (d) => (out += d));
  p.stderr.on('data', (d) => (out += d));
  p.on('error', () => resolve({ code: 0, out: '' })); // fail-open
  p.on('close', (code) => resolve({ code: code ?? 0, out }));
});

try {
  const archivo = archivoEditado(leerEvento());
  if (!archivo || !/\.(ts|html|scss)$/.test(archivo.rel)) process.exit(0);
  if (!fs.existsSync(archivo.abs) || !hayNodeModules()) process.exit(0);

  const scripts = path.join(BACKOFFICE, 'scripts');
  const tareas = [correr([path.join(scripts, 'lint-files.mjs'), archivo.abs])];
  if (fs.existsSync(path.join(scripts, 'check-structure.mjs'))) tareas.push(correr([path.join(scripts, 'check-structure.mjs'), '--file', archivo.abs]));
  if (archivo.rel.endsWith('.scss') && fs.existsSync(path.join(scripts, 'check-styles.mjs'))) tareas.push(correr([path.join(scripts, 'check-styles.mjs'), '--file', archivo.abs]));

  const fallas = (await Promise.all(tareas)).filter((r) => r.code === 1); // 1 = violaciones; otros códigos = fallo del script → fail-open
  if (!fallas.length) process.exit(0);

  salir(2, {
    stderr:
      `Chequeo del backoffice sobre ${archivo.rel}: hay errores. Corregilos antes de seguir ` +
      '(no desactives la regla ni agregues excepciones al baseline):\n\n' +
      fallas.map((f) => f.out.trim()).join('\n'),
  });
} catch {
  process.exit(0);
}
