/** Utilidades de fechas en hora local (sin zona), para vigencias y datepickers. */

/** Primer instante del día (00:00:00). */
export function inicioDelDia(fecha: Date): Date {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 0, 0, 0);
}

/** Último segundo del día (23:59:59): un "hasta" de día completo. */
export function finDelDia(fecha: Date): Date {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 23, 59, 59);
}

/** Hoy a las 00:00:00. */
export function hoy(): Date {
  return inicioDelDia(new Date());
}
