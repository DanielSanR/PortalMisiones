/**
 * De dónde se llegó a `organismos/editar/:id`. Al guardar o cancelar, la edición vuelve
 * a ese lugar: si el usuario editó desde la lista, retomarla; si vino de la ficha, a la ficha.
 *
 * Va como query param (y no en `history.state`) para que sobreviva a un F5 y sea visible
 * en la URL. Sin el param —URL tipeada o link viejo— se vuelve a la ficha.
 */
export const PARAM_ORIGEN_EDICION = 'origen';

export type OrigenEdicionOrganismo = 'lista' | 'ficha';

export function origenEdicionDesde(valor: string | null | undefined): OrigenEdicionOrganismo {
  return valor === 'lista' ? 'lista' : 'ficha';
}
