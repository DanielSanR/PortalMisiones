#!/usr/bin/env node
/**
 * SessionStart — guarda la HUELLA BASE de backoffice/ para esta sesión. El gate de Stop
 * (backoffice-gate.mjs) la usa para saber si la sesión tocó backoffice/: si la huella no cambió, no corre nada.
 *
 * En `startup`/`clear` la base se pisa; en `resume`/`compact` se conserva la que ya había (la sesión sigue).
 * El stdout de SessionStart se agrega al contexto del modelo: se usa para recordar los chequeos.
 */
import fs from 'node:fs';
import path from 'node:path';
import { STATE, estado, huella, idSesion, leerEvento } from './backoffice-lib.mjs';

try {
  const ev = leerEvento();
  const sesion = idSesion(ev);
  const conservar = ev.source === 'resume' || ev.source === 'compact';
  if (!(conservar && estado.leer(`base-${sesion}`))) {
    const h = huella();
    if (h) estado.escribir(`base-${sesion}`, h);
    estado.borrar(`fallos-${sesion}`);
  }

  // Limpieza: estado de sesiones de hace más de 14 días.
  try {
    for (const f of fs.readdirSync(STATE)) {
      const p = path.join(STATE, f);
      if (/^(base|fallos|fallida)-/.test(f) && Date.now() - fs.statSync(p).mtimeMs > 14 * 864e5) fs.rmSync(p);
    }
  } catch { /* sin estado todavía */ }

  fs.writeSync(1,
    'Backoffice — chequeos automáticos activos: al editar un archivo de backoffice/src se le corre ESLint/stylelint ' +
    '+ check-structure (los errores vuelven como feedback del hook); al terminar el turno, si se tocó backoffice/, ' +
    'corre `npm run check:stop` (typecheck + lint + estilos + estructura + madge + build). ' +
    'Para adelantarte: `cd backoffice && npm run check:fast`. No desactives reglas ni sumes excepciones a los ' +
    'baselines (`scripts/*.baseline.json`) ni subas los `--max-warnings` de package.json: esos topes solo bajan.\n',
  );
} catch { /* fail-open */ }
process.exit(0);
