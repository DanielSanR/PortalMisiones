import { ChangeDetectionStrategy, Component, DestroyRef, Input, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { provideFechaArDatepicker } from '@shared/adapters/fecha-ar-date-adapter';
import { VigenciaForm, motivoDeFecha } from './vigencia-form';

/**
 * Campos "Vigente desde" (obligatorio) y "Vigente hasta" (opcional, posterior) con datepicker es-AR
 * (DD/MM/AAAA). Los comparten el diálogo "Adoptar trámite" y la edición del detalle.
 */
@Component({
  selector: 'app-vigencia-campos',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, MatDatepickerModule, MatFormFieldModule, MatInputModule],
  providers: [provideFechaArDatepicker()],
  templateUrl: './vigencia-campos.component.html',
  styleUrl: './vigencia-campos.component.scss',
})
export class VigenciaCamposComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  @Input({ required: true }) grupo!: VigenciaForm;
  /** Prefijo de los ids de los inputs: puede haber más de un form de vigencia en el DOM. */
  @Input() idPrefijo = 'vigencia';
  /**
   * Contador de intentos de envío del padre. `markAllAsTouched()` no emite eventos y este componente
   * es OnPush: el cambio de este input es lo que hace que se repinten los errores al apretar "Guardar".
   */
  @Input() intentos = 0;

  readonly motivo = motivoDeFecha;

  ngOnInit(): void {
    // "Hasta" depende de "desde": al mover el inicio se revalida el fin (y se muestra si ya tenía valor).
    this.grupo.controls.vigenteDesde.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        const hasta = this.grupo.controls.vigenteHasta;
        hasta.updateValueAndValidity({ emitEvent: false });
        if (hasta.value) hasta.markAsTouched();
      });
  }

  limpiarHasta(): void {
    const hasta = this.grupo.controls.vigenteHasta;
    hasta.setValue(null);
    hasta.markAsDirty();
  }
}
