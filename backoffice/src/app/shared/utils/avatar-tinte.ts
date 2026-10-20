/** Tintes de `.cell-avatar` (`--blue | --warm | --green | --grey`, Kitchen Sink §05). */
const TINTES = ['blue', 'warm', 'green', 'grey'] as const;

export type TinteAvatar = (typeof TINTES)[number];

/**
 * Tinte estable derivado del id: el mismo ítem conserva su color entre recargas y ordenamientos,
 * en vez de depender de su posición en la lista.
 */
export function tinteDeAvatar(id: string | null | undefined): TinteAvatar {
  let acumulado = 0;
  for (const caracter of id ?? '') acumulado = (acumulado + caracter.charCodeAt(0)) % 997;
  return TINTES[acumulado % TINTES.length];
}
