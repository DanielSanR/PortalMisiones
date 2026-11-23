#!/usr/bin/env node
/**
 * PostToolUse (Edit|Write|MultiEdit) — EN SEGUNDO PLANO (`asyncRewake: true`), con debounce.
 *
 * Al editar un .ts/.html de backoffice/src corre `npm run typecheck` (ngc valida templates con
 * strictTemplates + tsc valida specs). Como corre en segundo plano no frena la edición; si falla sale
 * con exit 2 y Claude Code despierta al modelo con el stderr.
 *
 * Debounce: cada edición deja una marca; el hook espera ESPERA_MS y solo sigue si la suya sigue siendo la
 * última (una ráfaga de ediciones dispara UN typecheck). Si ya hay un typecheck corriendo, este sale: el
 * que corre vuelve a tipar al terminar si hubo ediciones después de que empezó.
 */
import fs from 'node:fs';
import { setTimeout as dormir } from 'node:timers/promises';
import { archivoEditado, cola, estado, hayNodeModules, leerEvento, npmRun, salir } from './backoffice-lib.mjs';

const ESPERA_MS = 6000;
const LOCK_VENCE_MS = 5 * 60 * 1000;
const MARCA = 'typecheck.marca';
const LOCK = 'typecheck.lock';

try {
  const archivo = archivoEditado(leerEvento());
  if (!archivo || !/\.(ts|html)$/.test(archivo.rel) || !hayNodeModules()) process.exit(0);

  const mia = `${Date.now()}-${process.pid}`;
  estado.escribir(MARCA, mia);
  await dormir(ESPERA_MS);
  if (estado.leer(MARCA) !== mia) process.exit(0); // hubo otra edición: se encarga ese hook

  // Un solo typecheck a la vez (lock con vencimiento por si un proceso murió).
  try {
    const st = fs.statSync(estado.ruta(LOCK));
    if (Date.now() - st.mtimeMs < LOCK_VENCE_MS) process.exit(0);
  } catch { /* sin lock */ }
  estado.escribir(LOCK, mia);

  let resultado;
  try {
    for (let vuelta = 0; vuelta < 3; vuelta++) {
      const marcaAlEmpezar = estado.leer(MARCA);
      resultado = npmRun('typecheck', { timeoutMs: 240_000 });
      if (estado.leer(MARCA) === marcaAlEmpezar) break; // nadie editó mientras tipaba
      await dormir(ESPERA_MS);
    }
  } finally {
    estado.borrar(LOCK);
  }

  if (resultado.ok) process.exit(0);
  salir(2, {
    stderr:
      'Typecheck del backoffice (`npm run typecheck`: ngc con strictTemplates + tsc) FALLÓ después de tus ' +
      'últimas ediciones. Corregí los errores de tipos/templates:\n\n' + cola(resultado.salida, 60),
  });
} catch {
  process.exit(0);
}
