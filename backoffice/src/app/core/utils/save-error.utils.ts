import { FormGroup } from '@angular/forms';
import { extractErrorCode, extractErrorMessage } from '../models/api-response.model';

/**
 * Un error de negocio con texto propio: se cuenta en un campo concreto del form (ej. unicidad) o,
 * sin `control`, solo en el banner (ej. "algo de lo elegido ya no existe").
 */
export interface ConflictoDeCampo {
  /** Código de negocio del backend (`API_CODES`). */
  code: number;
  /** Nombre del control del form donde se marca. Sin él, el mensaje va directo al banner. */
  control?: string;
  /** Texto bajo el campo (o del banner, si no hay `control`). */
  mensaje: string;
}

/**
 * Traduce un error de guardado al form. Si el código de negocio coincide con algún conflicto
 * declarado, lo marca en su campo (`setErrors({ server })`, que `form-error-messages.util` muestra
 * y que se limpia solo al editar el valor) y devuelve el texto del banner. Si no, devuelve el
 * mensaje del backend o el `fallback`.
 *
 * El banner del form ya se titula "No se pudo guardar": el texto devuelto no lo repite.
 */
export function aplicarErrorDeGuardado(
  err: unknown,
  form: FormGroup | undefined,
  conflictos: ConflictoDeCampo[],
  fallback: string,
): string {
  const body = (err as { error?: unknown })?.error;
  const code = extractErrorCode(body);
  const conflicto = conflictos.find((c) => c.code === code);

  if (conflicto) {
    const control = conflicto.control ? form?.get(conflicto.control) : null;
    if (!control) return conflicto.mensaje;
    control.setErrors({ server: conflicto.mensaje });
    control.markAsTouched();
    return 'Revisá el campo marcado.';
  }

  return extractErrorMessage(body) || fallback;
}
