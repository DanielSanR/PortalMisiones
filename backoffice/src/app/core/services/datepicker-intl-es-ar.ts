import { Injectable } from '@angular/core';
import { MatDatepickerIntl } from '@angular/material/datepicker';

/** Textos del calendario de Material en es-AR (por defecto vienen en inglés). */
@Injectable()
export class DatepickerIntlEsAr extends MatDatepickerIntl {
  override calendarLabel = 'Calendario';
  override openCalendarLabel = 'Elegir fecha';
  override closeCalendarLabel = 'Cerrar calendario';
  override prevMonthLabel = 'Mes anterior';
  override nextMonthLabel = 'Mes siguiente';
  override prevYearLabel = 'Año anterior';
  override nextYearLabel = 'Año siguiente';
  override prevMultiYearLabel = '24 años anteriores';
  override nextMultiYearLabel = '24 años siguientes';
  override switchToMonthViewLabel = 'Elegir un mes';
  override switchToMultiYearViewLabel = 'Elegir mes y año';

  override formatYearRange(start: string, end: string): string {
    return `${start} a ${end}`;
  }

  override formatYearRangeLabel(start: string, end: string): string {
    return `${start} a ${end}`;
  }
}
