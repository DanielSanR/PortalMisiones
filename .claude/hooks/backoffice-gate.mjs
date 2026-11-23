#!/usr/bin/env node
/**
 * Stop — gate autoritativo del backoffice al terminar un turno.
 *
 * Corre `npm run check:stop` (typecheck + lint + lint:styles + estructura + estilos + madge + icons +
 * prod-mocks + ng build) SOLO si:
 *   - la huella de backoffice/ cambió respecto de la base de la sesión (SessionStart), y
 *   - ese estado exacto no fue validado ya (huella "verde").
 * La huella (ver backoffice-lib.mjs) ve archivos nuevos, borrados, staged y commits del turno; un
 * `git diff --quiet` no los vería.
 *
 * Si falla: últimas líneas por STDERR + exit 2 → Claude sigue trabajando para corregirlo.
 * Corte de bucle: tras MAX_FALLOS fallos seguidos en la sesión deja de bloquear y avisa al humano
 * (`systemMessage`). Vuelve a bloquear cuando el gate pasa una vez.
 * Fail-open: sin git, sin node_modules o ante un fallo propio del hook → exit 0.
 */
import { backofficeSucio, cola, estado, hayNodeModules, huella, idSesion, leerEvento, npmRun, salir } from './backoffice-lib.mjs';

const MAX_FALLOS = 3;
const VERDE = 'verde';

const avisarHumano = (texto) => salir(0, { stdout: JSON.stringify({ systemMessage: texto }) });

try {
  const ev = leerEvento();
  const sesion = idSesion(ev);
  if (!hayNodeModules()) process.exit(0);

  const actual = huella();
  if (!actual) process.exit(0); // sin git

  const base = estado.leer(`base-${sesion}`);
  if (base ? actual === base : !backofficeSucio()) process.exit(0); // el turno no tocó backoffice/
  if (actual === estado.leer(VERDE)) process.exit(0);               // este estado ya pasó el gate

  const fallos = Number(estado.leer(`fallos-${sesion}`) ?? 0);
  const resumenCorte =
    `Gate del backoffice: \`npm run check:stop\` falló ${MAX_FALLOS} veces seguidas y Claude no logró dejarlo en verde. ` +
    'Se deja de bloquear el cierre del turno: revisalo a mano con `cd backoffice && npm run check:stop`.';
  if (fallos >= MAX_FALLOS && estado.leer(`fallida-${sesion}`) === actual) avisarHumano(resumenCorte); // mismo estado roto: no repetir 1-2 min de chequeos

  // BACKOFFICE_GATE_SCRIPT: solo para probar el hook con un script más corto.
  const script = /^[\w:-]+$/.test(process.env.BACKOFFICE_GATE_SCRIPT ?? '') ? process.env.BACKOFFICE_GATE_SCRIPT : 'check:stop';
  const r = npmRun(script);

  if (r.ok) {
    estado.escribir(VERDE, huella() ?? actual);
    estado.borrar(`fallos-${sesion}`);
    estado.borrar(`fallida-${sesion}`);
    process.exit(0);
  }

  estado.escribir(`fallos-${sesion}`, fallos + 1);
  estado.escribir(`fallida-${sesion}`, huella() ?? actual);
  if (fallos + 1 >= MAX_FALLOS) avisarHumano(`${resumenCorte}\n\nÚltima salida:\n${cola(r.salida, 25)}`);

  salir(2, {
    stderr:
      `Gate del backoffice: \`npm run ${script}\` FALLÓ (intento ${fallos + 1} de ${MAX_FALLOS}). ` +
      'Corregí la causa (no desactives reglas, no subas topes de --max-warnings, no agregues excepciones a los baselines) ' +
      'y terminá de nuevo. Últimas líneas:\n\n' + cola(r.salida, 80),
  });
} catch {
  process.exit(0);
}
