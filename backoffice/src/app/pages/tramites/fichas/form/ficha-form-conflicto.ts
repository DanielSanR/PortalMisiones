import { AbstractControl } from '@angular/forms';
import { canonicalizarSlug } from '@core/utils/slug.utils';
import { FichaBase, FichaLocalVM } from '@features/fichas-locales';
import { FichaForm } from './ficha-form-campos';

/**
 * Edición concurrente de una ficha. Antes de guardar, el facade relee la ficha: si cambió (versión, estado o
 * `activa`) desde que se leyó, no guarda (el backend no lo detecta: el PUT va sin versión) y avisa con
 * `FichaCambiadaError`. La pantalla entonces REBASA el form sobre la ficha actual (`rebasar`): así un guardado
 * nunca revierte en silencio lo que cambió otra persona en un campo que acá no se tocó.
 */

/**
 * Campos de la ficha que se editan en el form, con la etiqueta que se ve en pantalla (así los nombra el aviso de
 * conflicto). La localidad y el trámite no cambian en edición.
 */
const ETIQUETA_EDITABLE = {
  slug: 'Slug',
  url: 'URL del trámite',
  requisitos: 'Requisitos',
  costos: 'Costos',
  activa: 'Ficha activa',
} as const;

type CampoEditable = keyof typeof ETIQUETA_EDITABLE;

const CAMPOS_EDITABLES = Object.keys(ETIQUETA_EDITABLE) as CampoEditable[];

/** El valor de un campo editable tal como lo muestra el form (`null` del backend = vacío). */
function valorEditable(ficha: FichaLocalVM, campo: CampoEditable): string | boolean {
  if (campo === 'activa') return ficha.activa;
  return ficha[campo] ?? '';
}

/** Lo que el facade compara antes de guardar (ver `FichaBase`). */
export function baseDe(ficha: FichaLocalVM): FichaBase {
  return { version: ficha.version, estado: ficha.estado, activa: ficha.activa };
}

/**
 * La ficha cambió en el servidor mientras se la editaba y el form ya se REBASÓ sobre lo recién leído: los campos
 * sin tocar tomaron el valor nuevo y los editados conservan lo escrito. Todavía no se guardó nada.
 */
export interface ConflictoFicha {
  /** La ficha tal como está ahora en el servidor (ya es la base del próximo guardado). */
  actual: FichaLocalVM;
  /**
   * Etiquetas de los campos que cambiaron los dos (la otra persona y quien edita, con valores distintos): quedan
   * con lo escrito acá y, al guardar, reemplazan lo que cargó la otra persona.
   */
  enDisputa: string[];
}

/** Cómo quedó la pantalla después de rebasar el form. */
export interface ResultadoDelRebase {
  /** Quedan cambios propios: se ofrece guardarlos o descartarlos. `null` = no quedó ninguno. */
  conflicto: ConflictoFicha | null;
  /** Sin cambios propios: versión de la ficha que ya se está viendo, para avisar que se actualizó. Si no, `null`. */
  fichaActualizada: number | null;
  /**
   * La ficha resultó PUBLICADA y activa mientras acá se la quería desactivar: el interruptor volvió a quedar
   * prendido y bloqueado (desde el form no se desactiva una publicada), y el aviso lo dice.
   */
  activaRestablecida: boolean;
}

/**
 * Rebasa el form sobre `actual` en vez de guardar encima. Guardar sin más mandaría, en los campos que acá no se
 * tocaron, los valores viejos (el PUT es total): revertiría en silencio lo que cambió la otra persona, o
 * reactivaría una ficha que desactivó.
 *
 * - Campo sin tocar (pristine): toma el valor de `actual`, sin ensuciarse.
 * - Campo editado acá: conserva lo escrito. Si además lo cambió la otra persona (con otro valor), va a
 *   `enDisputa`: el aviso lo nombra, porque al guardar reemplaza lo que cargó la otra persona. Si lo escrito
 *   coincide con lo que hay ahora, deja de contar como cambio.
 * - `actual` pasa a ser la ficha leída: lo hace `adoptar` (de la pantalla: base del próximo guardado, slug que se
 *   conserva, estado, `activa` y bloqueo del interruptor), que se llama con los campos ya rebasados.
 *
 * Si después de eso no queda ningún cambio propio, no hay conflicto: se avisa que la ficha se actualizó.
 *
 * @param anterior la ficha tal como se había leído (`null` si no hay: nada queda en disputa).
 */
export function rebasar(
  form: FichaForm, anterior: FichaLocalVM | null, actual: FichaLocalVM, adoptar: (ficha: FichaLocalVM) => void,
): ResultadoDelRebase {
  const quedaBloqueada = actual.estado === 'PUBLICADO' && actual.activa;
  const activa = form.controls.activa;
  const activaRestablecida = quedaBloqueada && activa.dirty && !activa.value;
  if (quedaBloqueada) activa.markAsPristine();

  const enDisputa: string[] = [];
  for (const campo of CAMPOS_EDITABLES) {
    const control: AbstractControl = form.controls[campo];
    const nuevo = valorEditable(actual, campo);
    // El slug editado se guarda canonicalizado: se compara así.
    const escrito = campo === 'slug' ? canonicalizarSlug(String(control.value)) : control.value;
    if (control.dirty && escrito !== nuevo) {
      if (anterior && valorEditable(anterior, campo) !== nuevo) enDisputa.push(ETIQUETA_EDITABLE[campo]);
      continue;
    }
    control.setValue(nuevo);
    control.markAsPristine();
  }

  adoptar(actual);
  // Una URL que hoy no valida muestra el error de entrada (dice qué corregir).
  if (form.controls.url.invalid) form.controls.url.markAsTouched();

  return form.dirty
    ? { conflicto: { actual, enDisputa }, fichaActualizada: null, activaRestablecida }
    : { conflicto: null, fichaActualizada: actual.version, activaRestablecida };
}
