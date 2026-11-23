/** Pestañas de la entidad (las mismas en la ficha y en la edición; el alta no tiene). */
export type TabDetalle = 'datos' | 'tramites' | 'responsables' | 'historial';

export interface Tab {
  clave: TabDetalle;
  label: string;
  /** Contador del pill. `null` cuando el dato todavía no existe en el backend. */
  contador: number | null;
}

/**
 * Los contadores van en `null` porque el backend no expone ni los trámites por
 * organismo ni sus responsables. Mostrar un 0 sería afirmar que no tiene.
 */
export const TABS: Tab[] = [
  { clave: 'datos', label: 'Datos', contador: null },
  { clave: 'tramites', label: 'Trámites', contador: null },
  { clave: 'responsables', label: 'Responsables', contador: null },
  { clave: 'historial', label: 'Historial', contador: null },
];

/**
 * Teclado del tablist (patrón APG, activación automática): ←/→ recorren las pestañas con vuelta,
 * Inicio/Fin saltan a la primera/última. Devuelve la pestaña a la que lleva la tecla, o `null` si la
 * tecla no es del tablist (no hay que frenarla).
 */
export function tabTrasTecla(tecla: string, actual: TabDetalle, tabs: Tab[] = TABS): TabDetalle | null {
  const claves = tabs.map((t) => t.clave);
  const indice = claves.indexOf(actual);
  const ultimo = claves.length - 1;
  switch (tecla) {
    case 'ArrowRight': return claves[indice >= ultimo ? 0 : indice + 1];
    case 'ArrowLeft': return claves[indice <= 0 ? ultimo : indice - 1];
    case 'Home': return claves[0];
    case 'End': return claves[ultimo];
    default: return null;
  }
}
