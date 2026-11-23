import { MotivoNoVigente } from '../models/ficha-local.vm';

/** Lo que hace falta de una adopción para saber si está vigente. */
export interface VigenciaDeAdopcion {
  habilitada: boolean;
  vigenteDesde: Date;
  vigenteHasta: Date | null;
}

/**
 * ÚNICO lugar donde una fecha de vigencia de la adopción se convierte en el instante que se compara con "ahora".
 *
 * SUPUESTO (sin confirmar en staging/prod, ver M-1): `effectiveFrom`/`effectiveTo` son `LocalDateTime` del
 * backend, sin zona. El front los lee y los escribe como hora de pared del NAVEGADOR (`parseLocalDateTime` /
 * `toLocalDateTime` del mapper de adopciones), y acá se asume que el reloj del backend marca esa misma hora de
 * pared (`LocalDateTime.now()` en la zona de Misiones, UTC-3). Eso vale con el backend corriendo en una máquina
 * en hora argentina; NO vale si su JVM corre en UTC —la imagen `eclipse-temurin:17-jre` del Dockerfile no fija
 * `TZ` ni `user.timezone`, y el backend no configura `spring.jackson.time-zone` ni `hibernate.jdbc.time_zone`—:
 * en ese caso el backend da por empezada (y por vencida) una adopción 3 horas ANTES de lo que calcula el front.
 * El efecto queda acotado a esa ventana: esta regla solo decide avisos y qué se ofrece; el backend vuelve a
 * decidir al guardar. Si se confirma la zona del backend, la corrección es acá (p. ej. restar el desfase del
 * navegador respecto de la zona del servidor) y no en cada comparación.
 */
export function instanteDeVigencia(fecha: Date): number {
  return fecha.getTime();
}

/**
 * Por qué una adopción NO está vigente en `ahora`, o `null` si lo está. Misma regla que el backend
 * (`OrganismProcedure.isEffectiveAt`, `dev` @ `586b670`), que es la que aplica al crear o editar una ficha:
 * habilitada, `desde <= ahora` (inclusive) y `hasta` nulo o posterior a `ahora` (exclusive).
 * Función pura (hoja): la usa el facade.
 */
export function motivoNoVigente(adopcion: VigenciaDeAdopcion, ahora: Date): MotivoNoVigente | null {
  if (!adopcion.habilitada) return 'deshabilitada';
  if (instanteDeVigencia(adopcion.vigenteDesde) > ahora.getTime()) return 'programada';
  if (adopcion.vigenteHasta && instanteDeVigencia(adopcion.vigenteHasta) <= ahora.getTime()) return 'vencida';
  return null;
}
