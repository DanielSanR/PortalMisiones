import { AbstractControl, FormControl, FormGroup, ValidationErrors, Validators } from '@angular/forms';
import { finDelDia, inicioDelDia } from '@core/utils/fecha.utils';

/** Vigencia de una adopción en el form: días (ver `rangoDeVigencia` para cómo se mandan). */
export type VigenciaForm = FormGroup<{
  vigenteDesde: FormControl<Date | null>;
  vigenteHasta: FormControl<Date | null>;
}>;

/**
 * "Hasta" no puede ser un día anterior a "desde". El mismo día vale: la vigencia va de 00:00:00 a
 * 23:59:59, y el backend solo exige `effectiveTo > effectiveFrom` (si no, `4012`).
 */
function hastaNoAnterior(control: AbstractControl): ValidationErrors | null {
  const hasta = control.value as Date | null;
  const desde = control.parent?.get('vigenteDesde')?.value as Date | null | undefined;
  if (!hasta || !desde) return null;
  return inicioDelDia(hasta).getTime() >= inicioDelDia(desde).getTime() ? null : { hastaAnterior: true };
}

export function crearVigenciaForm(desde: Date | null = null, hasta: Date | null = null): VigenciaForm {
  return new FormGroup({
    vigenteDesde: new FormControl<Date | null>(desde, { validators: Validators.required }),
    vigenteHasta: new FormControl<Date | null>(hasta, { validators: hastaNoAnterior }),
  });
}

/** Motivo legible del primer error de un campo de fecha (`mat-error`). */
export function motivoDeFecha(control: AbstractControl): string | null {
  if (control.hasError('matDatepickerParse')) return 'Escribí la fecha como DD/MM/AAAA';
  if (control.hasError('required')) return 'Es obligatoria';
  if (control.hasError('hastaAnterior')) return 'No puede ser anterior a la fecha de inicio';
  return null;
}

/**
 * Lo que se manda al backend (el PUT es total). Un campo editado va al borde de su día: desde a las
 * 00:00:00, hasta a las 23:59:59 (inclusive). Un campo SIN tocar reenvía el valor `original` con su
 * hora exacta: si no, guardar solo "Habilitado" podía mover la vigencia de una adopción cargada con
 * otras horas (p. ej. un fin a las 00:00 pasaba a 23:59:59, un día más).
 */
export function rangoDeVigencia(
  grupo: VigenciaForm,
  original?: { vigenteDesde: Date; vigenteHasta: Date | null },
): { vigenteDesde: Date; vigenteHasta: Date | null } {
  const { vigenteDesde, vigenteHasta } = grupo.controls;
  return {
    vigenteDesde: original && vigenteDesde.pristine ? original.vigenteDesde : inicioDelDia(vigenteDesde.value!),
    vigenteHasta: original && vigenteHasta.pristine
      ? original.vigenteHasta
      : vigenteHasta.value ? finDelDia(vigenteHasta.value) : null,
  };
}
