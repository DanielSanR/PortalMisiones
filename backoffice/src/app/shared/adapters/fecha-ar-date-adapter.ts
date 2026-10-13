import { Injectable, Provider } from '@angular/core';
import { DateAdapter, MAT_DATE_FORMATS, MAT_NATIVE_DATE_FORMATS, NativeDateAdapter } from '@angular/material/core';

/** `D/M/AAAA` (también con `-` o `.`), lo que se tipea en un campo de fecha es-AR. */
const FECHA_AR = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/;

const dosDigitos = (n: number): string => String(n).padStart(2, '0');

/**
 * `NativeDateAdapter` con el formato del proyecto (DD/MM/AAAA). El nativo parsea con `Date.parse`,
 * que lee "05/03/2026" como 3 de mayo (formato de EE.UU.): escribir la fecha a mano daba otro día.
 * El calendario (nombres de meses y días) sigue saliendo del locale es-AR.
 */
@Injectable()
export class FechaArDateAdapter extends NativeDateAdapter {
  override parse(value: unknown, parseFormat?: unknown): Date | null {
    if (typeof value !== 'string') return super.parse(value, parseFormat);
    const texto = value.trim();
    if (!texto) return null;
    const partes = FECHA_AR.exec(texto);
    if (!partes) return this.invalid();
    const [dia, mes, anio] = [Number(partes[1]), Number(partes[2]), Number(partes[3])];
    const fecha = new Date(anio, mes - 1, dia);
    // `new Date` "corrige" el 31/02 al 3/03: eso es una fecha inválida, no otra.
    return fecha.getFullYear() === anio && fecha.getMonth() === mes - 1 && fecha.getDate() === dia
      ? fecha
      : this.invalid();
  }

  /** En es-AR la semana empieza el lunes (el nativo devuelve domingo). */
  override getFirstDayOfWeek(): number {
    return 1;
  }

  override format(date: Date, displayFormat: object): string {
    if (displayFormat === MAT_NATIVE_DATE_FORMATS.display.dateInput) {
      return `${dosDigitos(date.getDate())}/${dosDigitos(date.getMonth() + 1)}/${date.getFullYear()}`;
    }
    return super.format(date, displayFormat);
  }
}

/** Providers del datepicker es-AR, para el `providers` del componente que lo usa. */
export function provideFechaArDatepicker(): Provider[] {
  return [
    { provide: DateAdapter, useClass: FechaArDateAdapter },
    { provide: MAT_DATE_FORMATS, useValue: MAT_NATIVE_DATE_FORMATS },
  ];
}
