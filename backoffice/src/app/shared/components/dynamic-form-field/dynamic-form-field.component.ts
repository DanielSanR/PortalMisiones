import {
  ChangeDetectionStrategy, Component, ElementRef, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, inject,
} from '@angular/core';
import { FormGroup } from '@angular/forms';
import { Observable, merge, of } from 'rxjs';
import { distinctUntilChanged, map, startWith } from 'rxjs/operators';
import { FieldConfig } from '@core/models/field.interface';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { TextFieldModule } from '@angular/cdk/text-field';
import { FormErrorMessageDirective } from './FormErrorMessage.directive';
import { getControlErrorMessage } from './form-error-messages.util';
// Solo se usan dentro de bloques `@defer` del template: Angular los separa en chunks lazy, así
// MatSelect / MatDatepicker / MatSlideToggle no entran al bundle de un form que no los usa.
import { DynamicFormSelectFieldComponent } from '../dynamic-form-select-field/dynamic-form-select-field.component';
import { DynamicFormDateFieldComponent } from '../dynamic-form-date-field/dynamic-form-date-field.component';
import { DynamicFormChoiceFieldComponent } from '../dynamic-form-choice-field/dynamic-form-choice-field.component';
import { DynamicFormTreeFieldComponent } from '../dynamic-form-tree-field/dynamic-form-tree-field.component';
import { OpcionSeleccion, SeleccionMultipleComponent } from '../seleccion-multiple/seleccion-multiple.component';
import { CampoFijo, EntradasDeVista, entradasDeVista } from '../dynamic-form/dynamic-form.vista';

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
    DynamicFormTreeFieldComponent,
    SeleccionMultipleComponent,
  ],
  templateUrl: './dynamic-form-field.component.html',
  styleUrl: './dynamic-form-field.component.scss',
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

  /**
   * `field.derivado.accion`: el valor ya no coincide con el que saldría del origen y la persona tocó algo
   * (este campo si sigue al origen; el origen si no). Abrir una edición no invita a cambiar nada.
   */
  rederivable$: Observable<boolean> = of(false);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  @Input() field!: FieldConfig;
  @Input() group!: FormGroup;
  /** Qué campos del formulario están en `readonly` (una `vista` que escribe no los toca). Referencia estable. */
  @Input() esFijo?: CampoFijo;
  /**
   * Sube cada vez que el formulario cambia el estado de sus controles desde afuera de los campos
   * (`markAllAsTouched()` al enviar). Es un input solo para que los campos OnPush se revisen.
   */
  @Input() revision = 0;
  /**
   * Nivel del encabezado de los rótulos de sección. 2 en una página (cuelgan del `h1` del shell);
   * 3 dentro de un diálogo, donde el título del diálogo ya es el `h2`.
   */
  @Input() nivelEncabezado = 2;
  /** La lista de este `select-multiple` está abierta (lo decide el formulario: una sola a la vez). */
  @Input() seleccionAbierta = false;
  @Output() seleccionAbiertaChange = new EventEmitter<boolean>();

  /** `field.options` como las espera `app-seleccion-multiple`; se rearma solo cuando cambia el campo. */
  opcionesDeSeleccion: OpcionSeleccion[] = [];

  /** Inputs del componente de un campo `vista` (`grupo`, `datos`, `escribir`); se rearman solo con el campo o el grupo. */
  entradasDeVista: EntradasDeVista | null = null;

  ngOnInit() {
    if (!this.field || !this.group) {
      console.error('Campo o grupo no definidos en DynamicFormFieldComponent');
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['field'] || changes['group']) {
      this.preview$ = this.buildPreview$();
      this.rederivable$ = this.buildRederivable$();
      this.entradasDeVista = this.field && this.group ? entradasDeVista(this.field, this.group, this.esFijo) : null;
    }
    if (changes['field'] && this.field?.type === 'select-multiple') {
      this.opcionesDeSeleccion = (this.field.options ?? []).map((opcion) => ({ id: String(opcion.id), nombre: opcion.name }));
    }
  }

  /**
   * `field.transformar`: normaliza lo escrito en cada `input`, dejando el cursor junto al mismo carácter (si
   * el texto crece, p. ej. `ß` → `SS`, el cursor avanza lo mismo). No toca el valor mientras un IME compone:
   * se normaliza al terminar (`compositionend`, que no trae `isComposing`). El `dirty` lo pone el propio `input`.
   */
  transformar(evento: Event): void {
    const transformar = this.field.transformar;
    if (!transformar || (evento as InputEvent).isComposing) return;
    const input = evento.target as HTMLInputElement;
    const transformado = transformar(input.value);
    if (transformado === input.value) return;
    const cursor = transformar(input.value.slice(0, input.selectionStart ?? input.value.length)).length;
    input.value = transformado;
    input.setSelectionRange(cursor, cursor);
    this.group.get(this.field.name)?.setValue(transformado);
  }

  private buildRederivable$(): Observable<boolean> {
    const derivado = this.field?.derivado;
    const control = derivado?.accion ? this.group?.get(this.field.name) : null;
    const origen = derivado ? this.group?.get(derivado.de) : null;
    if (!derivado || !control || !origen) return of(false);

    return merge(control.valueChanges, origen.valueChanges).pipe(
      startWith(null),
      map(() => {
        const sugerido = derivado.transform(String(origen.value ?? ''));
        // Con `seguir`, un campo vacío cuenta como "pide el derivado" (vaciarlo a mano lo deja sin tocar).
        const tocado = derivado.seguir ? control.dirty || !String(control.value ?? '').trim() : origen.dirty;
        return tocado && !!sugerido && sugerido !== control.value;
      }),
      distinctUntilChanged(),
    );
  }

  /** Vuelve a derivar el valor del origen (botón `derivado.accion`). */
  rederivar(): void {
    const derivado = this.field.derivado;
    const control = this.group.get(this.field.name);
    const origen = derivado ? this.group.get(derivado.de) : null;
    if (!derivado || !control || !origen) return;
    // Sin `seguir` es un cambio a guardar (dirty antes del `setValue`, para que quien escucha ya lo vea así).
    if (!derivado.seguir) control.markAsDirty();
    control.setValue(derivado.transform(String(origen.value ?? '')));
    // Con `seguir` vuelve a acompañar al origen.
    if (derivado.seguir) control.markAsPristine();
    // El botón desaparece con el clic: el foco pasa al campo en vez de perderse en `body` (WCAG 2.4.3).
    this.host.querySelector<HTMLElement>('input')?.focus();
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

  /**
   * Texto de un campo `readonly`: el nombre de la opción elegida si el campo tiene `options` (varios, con
   * coma, en un multi-select) y, si no, el valor tal cual. Un id que no está entre las opciones no se
   * muestra crudo (sería un UUID): queda el `placeholder`.
   */
  get valorDeSoloLectura(): string {
    const valor: unknown = this.group.get(this.field.name)?.value;
    const opciones = this.field.options;
    if (!opciones) return valor == null ? '' : String(valor);
    const elegidos = Array.isArray(valor) ? valor : [valor];
    const nombres = elegidos
      .map((id) => opciones.find((opcion) => opcion.id === id)?.name)
      .filter((nombre): nombre is string => !!nombre);
    return nombres.length ? nombres.join(', ') : this.field.placeholder ?? '';
  }

  /**
   * Error de un `select-multiple` (no tiene `mat-form-field` ni `mat-error`): solo con el control inválido y ya
   * tocado (cerrar la lista o quitar un chip lo tocan; enviar, `markAllAsTouched`).
   */
  get errorDeSeleccion(): string | null {
    const control = this.group.get(this.field.name);
    return control?.invalid && control.touched ? getControlErrorMessage(control, this.field) : null;
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }
}
