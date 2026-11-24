import { MatSnackBar, MatSnackBarConfig, MatSnackBarRef, TextOnlySnackBar } from '@angular/material/snack-bar';
import { DuracionDeAvisos } from '@core/models/preferencias.model';
import { leerPreferencias } from '@core/services/preferencias.service';

/** Lo único que varía entre avisos del mismo tipo. */
export interface OpcionesDeAviso {
  /** Milisegundos en pantalla. Cada helper tiene su valor por defecto. */
  duracion?: number;
  /** Texto del botón del aviso ("OK" por defecto). Con otro (p. ej. "Ver"), escuchá `onAction()` del resultado. */
  accion?: string;
}

/**
 * Avisos breves (snackbar) del backoffice. Un solo lugar para la duración, el botón y la variante
 * visual de cada tipo (clases `snackbar-*` de `shared-styles/_material.scss`, Kitchen Sink §07), en
 * vez de un `snackBar.open(…)` armado a mano en cada pantalla.
 *
 *   avisarExito(this.snackBar, 'Etiqueta eliminada');
 *   avisarExito(this.snackBar, 'Trámite adoptado', { accion: 'Ver', duracion: 5000 }).onAction()…
 *   avisarAdvertencia(this.snackBar, 'El rol ya se creó, pero no pudimos abrir la lista. Buscalo ahí.');
 *
 * La duración final sigue la preferencia "Duración de los avisos" (Preferencias, por navegador): `normal` deja la de
 * cada helper (o la `duracion` pedida), `largo` la duplica y `fijo` deja el aviso hasta que la persona lo cierra.
 * Se lee de `localStorage` en forma síncrona en cada aviso, a propósito: son funciones sin inyección.
 */

/** Algo salió bien: "Etiqueta creada", "Cuenta desactivada". 3 s. */
export function avisarExito(snackBar: MatSnackBar, mensaje: string, opciones: OpcionesDeAviso = {}): MatSnackBarRef<TextOnlySnackBar> {
  return abrir(snackBar, mensaje, opciones, 3000, 'snackbar-success');
}

/** Salió bien a medias y la persona tiene que hacer algo más: queda más tiempo (8 s). */
export function avisarAdvertencia(snackBar: MatSnackBar, mensaje: string, opciones: OpcionesDeAviso = {}): MatSnackBarRef<TextOnlySnackBar> {
  return abrir(snackBar, mensaje, opciones, 8000, 'snackbar-warning');
}

/** No se pudo hacer algo que no tiene formulario ni confirmación donde mostrar el error. 5 s. */
export function avisarError(snackBar: MatSnackBar, mensaje: string, opciones: OpcionesDeAviso = {}): MatSnackBarRef<TextOnlySnackBar> {
  return abrir(snackBar, mensaje, opciones, 5000, 'snackbar-error');
}

/** Aviso neutro, sin variante de color ("No encontramos esa etiqueta"). 5 s. */
export function avisar(snackBar: MatSnackBar, mensaje: string, opciones: OpcionesDeAviso = {}): MatSnackBarRef<TextOnlySnackBar> {
  return abrir(snackBar, mensaje, opciones, 5000);
}

function abrir(
  snackBar: MatSnackBar, mensaje: string, opciones: OpcionesDeAviso, duracionPorDefecto: number, panelClass?: string,
): MatSnackBarRef<TextOnlySnackBar> {
  const config: MatSnackBarConfig = {
    duration: duracionSegunPreferencia(opciones.duracion ?? duracionPorDefecto, leerPreferencias(storageLocal()).avisos),
  };
  if (panelClass) config.panelClass = panelClass;
  return snackBar.open(mensaje, opciones.accion ?? 'OK', config);
}

/** Duración final según la preferencia: igual (`normal`), el doble (`largo`) o sin duración, hasta cerrarlo (`fijo`). */
export function duracionSegunPreferencia(ms: number, modo: DuracionDeAvisos): number | undefined {
  if (modo === 'fijo') return undefined;
  return modo === 'largo' ? ms * 2 : ms;
}

/** `localStorage`, o `null` si no existe o si acceder tira (algunos navegadores en modo privado). */
function storageLocal(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}
