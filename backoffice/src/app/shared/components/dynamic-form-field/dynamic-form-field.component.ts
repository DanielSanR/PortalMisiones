import { ChangeDetectionStrategy, Component, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { Observable, of } from 'rxjs';
import { distinctUntilChanged, map, startWith } from 'rxjs/operators';
import { FieldConfig } from '../../../core/models/field.interface';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { TextFieldModule } from '@angular/cdk/text-field';
import { FormErrorMessageDirective } from './FormErrorMessage.directive';
// Solo se usan dentro de bloques `@defer` del template: Angular los separa en chunks lazy, así
// MatSelect / MatDatepicker / MatRadio / MatSlideToggle no entran al bundle de un form que no los usa.
import { DynamicFormSelectFieldComponent } from '../dynamic-form-select-field/dynamic-form-select-field.component';
import { DynamicFormDateFieldComponent } from '../dynamic-form-date-field/dynamic-form-date-field.component';
import { DynamicFormChoiceFieldComponent } from '../dynamic-form-choice-field/dynamic-form-choice-field.component';

@Component({
  selector: 'app-dynamic-form-field',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    TextFieldModule,
    FormErrorMessageDirective,
    DynamicFormSelectFieldComponent,
    DynamicFormDateFieldComponent,
    DynamicFormChoiceFieldComponent,
  ],
  templateUrl: './dynamic-form-field.component.html',
  styleUrls: ['./dynamic-form-field.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DynamicFormFieldComponent implements OnInit, OnChanges {
  showPassword = false;

  /**
   * Valor de `field.preview` derivado del control; `''` cuando no corresponde mostrarlo
   * (sin preview declarada, transformado vacío o igual a lo tipeado). Se recalcula si
   * cambia el campo o el grupo (con `fields` nuevo el `dynamic-form` conserva el grupo, pero
   * el campo llega como objeto nuevo).
   */
  preview$: Observable<string> = of('');

  @Input() field!: FieldConfig;
  @Input() group!: FormGroup;
  /**
   * Sube cada vez que el formulario cambia el estado de sus controles desde afuera de los campos
   * (`markAllAsTouched()` al enviar). Es un input solo para que los campos OnPush se revisen.
   */
  @Input() revision = 0;

  ngOnInit() {
    if (!this.field || !this.group) {
      console.error('Campo o grupo no definidos en DynamicFormFieldComponent');
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['field'] || changes['group']) {
      this.preview$ = this.buildPreview$();
    }
  }

  private buildPreview$(): Observable<string> {
    const preview = this.field?.preview;
    const control = preview ? this.group?.get(this.field.name) : null;
    if (!preview || !control) return of('');

    return control.valueChanges.pipe(
      startWith(control.value),
      map((valor) => {
        const tipeado = valor == null ? '' : String(valor);
        const transformado = preview.transform(tipeado);
        return transformado && transformado !== tipeado ? transformado : '';
      }),
      distinctUntilChanged(),
    );
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  preventE(event: KeyboardEvent) {
    if (event.key === 'e' || event.key === 'E') {
      event.preventDefault();
    }
  }
}
