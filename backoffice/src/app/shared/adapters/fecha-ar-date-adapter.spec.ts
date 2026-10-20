import { TestBed } from '@angular/core/testing';
import { DateAdapter, MAT_DATE_LOCALE, MAT_NATIVE_DATE_FORMATS } from '@angular/material/core';
import { provideFechaArDatepicker } from './fecha-ar-date-adapter';

describe('FechaArDateAdapter', () => {
  let adapter: DateAdapter<Date>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: MAT_DATE_LOCALE, useValue: 'es-AR' }, ...provideFechaArDatepicker()],
    });
    adapter = TestBed.inject(DateAdapter);
  });

  it('parsea DD/MM/AAAA (no MM/DD)', () => {
    const fecha = adapter.parse('05/03/2026', null)!;
    expect(fecha.getDate()).toBe(5);
    expect(fecha.getMonth()).toBe(2);
    expect(fecha.getFullYear()).toBe(2026);
  });

  it('vacío es null; texto o fecha imposible es inválido', () => {
    expect(adapter.parse('  ', null)).toBeNull();
    expect(adapter.isValid(adapter.parse('31/02/2026', null)!)).toBeFalse();
    expect(adapter.isValid(adapter.parse('mañana', null)!)).toBeFalse();
  });

  it('muestra el input como DD/MM/AAAA', () => {
    expect(adapter.format(new Date(2026, 2, 5), MAT_NATIVE_DATE_FORMATS.display.dateInput)).toBe('05/03/2026');
  });
});
