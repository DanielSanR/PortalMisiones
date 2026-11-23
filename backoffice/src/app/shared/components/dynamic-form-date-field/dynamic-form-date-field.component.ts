import { ChangeDetectionStrategy, Component, ElementRef, Input, OnChanges, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { Observable, distinctUntilChanged, map, of, startWith } from 'rxjs';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { FieldConfig } from '@core/models/field.interface';
import { provideFechaArDatepicker } from '@shared/adapters/fecha-ar-date-adapter';
import { FormErrorMessageDirective } from '../dynamic-form-field/FormErrorMessage.directive';

/**
 * Campo `datepicker` de `DynamicFormFieldComponent`.
 * Aislado para que `MatDatepicker` (~80 kB) se cargue en diferido (`@defer`) solo si el
 * formulario tiene un campo fecha.
 */
@Component({
  selector: 'app-dynamic-form-date-field',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [provideFechaArDatepicker()],
  imports: [
    AsyncPipe,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    FormErrorMessageDirective,
  ],
  templateUrl: './dynamic-form-date-field.component.html',
  styleUrl: './dynamic-form-date-field.component.scss',
})
export class DynamicFormDateFieldComponent implements OnChanges {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  @Input({ required: true }) field!: FieldConfig;
  @Input({ required: true }) group!: FormGroup;
  /**
   * Sube cada vez que el formulario cambia el estado de sus controles desde afuera de los campos
   * (`markAllAsTouched()` al enviar). Es un input solo para que los campos OnPush se revisen.
   */
  @Input() revision = 0;

  /** Hay una fecha cargada: se ofrece `field.fecha.quitar`. */
  conFecha$: Observable<boolean> = of(false);
  /** Día mínimo del calendario: el valor del campo `field.fecha.minDe`, al día. */
  minimo$: Observable<Date | null> = of(null);

  ngOnChanges(): void {
    const control = this.group.get(this.field.name);
    this.conFecha$ = control && this.field.fecha?.quitar
      ? control.valueChanges.pipe(startWith(null), map(() => !!control.value), distinctUntilChanged())
      : of(false);
    const otro = this.field.fecha?.minDe ? this.group.get(this.field.fecha.minDe) : null;
    const fecha = (valor: unknown): Date | null => (valor instanceof Date ? valor : null);
    this.minimo$ = otro ? otro.valueChanges.pipe(startWith(null), map(() => fecha(otro.value))) : of(null);
  }

  /** Botón `field.fecha.quitar`: es un cambio de la persona (deja el campo dirty). */
  vaciar(): void {
    const control = this.group.get(this.field.name);
    if (!control) return;
    control.markAsDirty();
    control.setValue(null);
    // El botón desaparece con el clic: el foco pasa al campo en vez de perderse en `body` (WCAG 2.4.3).
    this.host.querySelector<HTMLElement>('input')?.focus();
  }
}
