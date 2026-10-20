/** Dónde está una adopción respecto de hoy. */
export type EstadoVigencia = 'vigente' | 'programada' | 'vencida';

/**
 * Dónde está una vigencia respecto de `ahora`, con la misma regla de intervalo que el backend
 * (`findOverlappingEnabled`): desde inclusive, hasta exclusive, `hasta = null` = sin fin.
 * Vive en `models` (función pura, hoja): la usa el facade, que no puede depender de mappers.
 */
export function estadoDeVigencia(desde: Date, hasta: Date | null, ahora: Date): EstadoVigencia {
  if (ahora.getTime() < desde.getTime()) return 'programada';
  if (hasta && ahora.getTime() >= hasta.getTime()) return 'vencida';
  return 'vigente';
}
