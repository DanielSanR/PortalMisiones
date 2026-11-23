/**
 * Baseline con trinquete, compartido por los checks propios (`check-structure`, `check-styles`).
 *
 * El baseline es un JSON `{ excepciones: [{ regla, archivo, motivo? }] }` con los desvíos CONOCIDOS.
 * El check falla (exit 1) si:
 *   - aparece un desvío que no está en el baseline (deuda nueva), o
 *   - una excepción listada ya no existe (se arregló: hay que borrarla, así el baseline solo baja).
 *
 * `--prune` borra del archivo las excepciones obsoletas. A propósito NO existe un flag para AGREGAR:
 * sumar una excepción es una decisión que se toma editando el JSON a mano, con su `motivo`.
 */
import fs from 'node:fs';

const clave = (x) => `${x.regla}\u0000${x.archivo}`;

export function leerBaseline(ruta) {
  if (!fs.existsSync(ruta)) return { excepciones: [] };
  const json = JSON.parse(fs.readFileSync(ruta, 'utf8'));
  return { ...json, excepciones: json.excepciones ?? [] };
}

/**
 * @param {{regla:string, archivo:string, msg:string}[]} desvios  desvíos encontrados ahora
 * @param {string} rutaBaseline
 * @returns {{nuevos: object[], obsoletas: object[], conocidos: object[]}}
 */
export function compararConBaseline(desvios, rutaBaseline) {
  const base = leerBaseline(rutaBaseline);
  const enBase = new Set(base.excepciones.map(clave));
  const actuales = new Set(desvios.map(clave));
  return {
    nuevos: desvios.filter((d) => !enBase.has(clave(d))),
    conocidos: desvios.filter((d) => enBase.has(clave(d))),
    obsoletas: base.excepciones.filter((e) => !actuales.has(clave(e))),
  };
}

/** Reescribe el baseline sin las excepciones obsoletas. Devuelve cuántas quitó. */
export function podarBaseline(rutaBaseline, obsoletas) {
  if (!obsoletas.length) return 0;
  const base = leerBaseline(rutaBaseline);
  const quitar = new Set(obsoletas.map(clave));
  base.excepciones = base.excepciones.filter((e) => !quitar.has(clave(e)));
  fs.writeFileSync(rutaBaseline, JSON.stringify(base, null, 2) + '\n');
  return quitar.size;
}

/**
 * Imprime el resultado y devuelve el exit code. `soloNuevos`: modo por archivo (hooks), no exige podar.
 */
export function informar(tag, { nuevos, obsoletas, conocidos }, { rutaBaseline, soloNuevos = false, ayuda = '' } = {}) {
  const linea = (d) => `  - [${d.regla}] ${d.archivo}${d.msg ? ` — ${d.msg}` : ''}`;
  let falla = false;
  if (nuevos.length) {
    falla = true;
    console.error(`[${tag}] ${nuevos.length} desvío(s) NUEVO(S):`);
    for (const d of nuevos) console.error(linea(d));
    if (ayuda) console.error(`  → ${ayuda}`);
  }
  if (!soloNuevos && obsoletas.length) {
    falla = true;
    console.error(`[${tag}] ${obsoletas.length} excepción(es) del baseline ya no existen (¡bien!). Borralas de ${rutaBaseline}:`);
    for (const d of obsoletas) console.error(linea(d));
    console.error(`  → node scripts/${tag === 'structure' ? 'check-structure' : 'check-styles'}.mjs --prune`);
  }
  if (!falla) console.log(`[${tag}] OK: 0 desvíos nuevos${conocidos.length ? ` (${conocidos.length} conocidos en el baseline, solo puede bajar)` : ''}.`);
  return falla ? 1 : 0;
}
