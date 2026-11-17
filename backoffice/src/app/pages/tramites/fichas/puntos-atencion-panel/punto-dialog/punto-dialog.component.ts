import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, finalize, map, startWith } from 'rxjs';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { FieldConfig } from '@core/models/field.interface';
import { aplicarErrorDeGuardado } from '@core/utils/save-error.utils';
import { FormErrorMessageDirective } from '@shared/components/dynamic-form-field/FormErrorMessage.directive';
import { FormErrorBannerComponent } from '@shared/components/form-error-banner/form-error-banner.component';
import { UnavailableDirective } from '@shared/directives/unavailable.directive';
import { cierreConConfirmacion } from '@shared/utils/cierre-con-confirmacion';
import { PuntoAtencionFormValue, PuntoAtencionVM, PuntosAtencionFacade } from '@features/puntos-atencion';
import { MAX_DECIMALES, coordenadaValida, formatearCoordenada, parsearCoordenada, urlMapa } from '../coordenadas';
import { CONFLICTOS_PUNTO, FALLBACK_PUNTO } from '../punto-save-error';
import { TEXTO_PUNTOS_SIMULADOS } from '../../ficha-textos';

/** Qué abre el diálogo: alta (sin `punto`) o edición. */
export interface PuntoDialogData {
  fichaId: string;
  punto: PuntoAtencionVM | null;
}

/** Largo razonable de los textos cortos (la base es VARCHAR/TEXT sin límite). */
const MAX_NOMBRE = 255;

type CampoConError = 'nombre' | 'direccion' | 'latitud' | 'longitud';

/** Texto de los errores de una coordenada (`coordenadaValida`), con el rango que le toca. */
function campoDeCoordenada(name: 'latitud' | 'longitud', label: string, limite: number, ejemplo: string): FieldConfig {
  const articulo = name === 'latitud' ? 'La latitud' : 'La longitud';
  return {
    name,
    label,
    type: 'text',
    validations: {
      mensajes: {
        required: `${articulo} es obligatoria`,
        numero: `Escribí un número (ej: ${ejemplo})`,
        rango: `Tiene que estar entre -${limite} y ${limite}`,
        decimales: `Hasta ${MAX_DECIMALES} decimales`,
      },
    },
  };
}

/**
 * Los campos que validan, descritos como los de `app-dynamic-form`: así el mensaje de cada error sale
 * de `form-error-messages.util`, uno por vez y con la misma prioridad que en el resto de los formularios.
 */
const CAMPOS: Record<CampoConError, FieldConfig> = {
  nombre: {
    name: 'nombre', label: 'Nombre', type: 'text',
    validations: { maxLength: MAX_NOMBRE, mensajes: { required: 'El nombre es obligatorio' } },
  },
  direccion: {
    name: 'direccion', label: 'Dirección', type: 'text',
    validations: { mensajes: { required: 'La dirección es obligatoria' } },
  },
  latitud: campoDeCoordenada('latitud', 'Latitud', 90, '-27,367104'),
  longitud: campoDeCoordenada('longitud', 'Longitud', 180, '-55,896108'),
};

/**
 * Alta y edición de un punto de atención (PLAN_TRAMITES_API.md §4.4, P-8): nombre, dirección,
 * contacto, horarios y latitud/longitud escritas a mano (coma o punto decimal), validadas en rango y
 * con hasta 6 decimales; se redondean a 6 antes de enviar (lo hace el mapper). "Ver en mapa" abre
 * OpenStreetMap para verificarlas. En edición, "Activo" permite reactivar un punto desactivado.
 * Queda abierto mientras guarda y, si el backend rechaza, cuenta el motivo acá mismo.
 * `afterClosed()` emite el punto guardado, o `undefined` si se canceló.
 */
@Component({
  selector: 'app-punto-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe, ReactiveFormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule,
    MatSlideToggleModule, FormErrorBannerComponent, FormErrorMessageDirective, UnavailableDirective,
  ],
  templateUrl: './punto-dialog.component.html',
  styleUrl: './punto-dialog.component.scss',
})
export class PuntoDialogComponent {
  private readonly facade = inject(PuntosAtencionFacade);
  private readonly dialogRef = inject<MatDialogRef<PuntoDialogComponent, PuntoAtencionVM>>(MatDialogRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = inject(MatDialog);
  readonly data = inject<PuntoDialogData>(MAT_DIALOG_DATA);

  readonly esEdicion = !!this.data.punto;
  readonly fuenteSimulada = this.facade.fuenteSimulada;
  readonly textoPuntosSimulados = TEXTO_PUNTOS_SIMULADOS;
  readonly maxNombre = MAX_NOMBRE;
  readonly maxDecimales = MAX_DECIMALES;
  readonly campos = CAMPOS;

  readonly form = new FormGroup({
    nombre: new FormControl(this.data.punto?.nombre ?? '', {
      nonNullable: true, validators: [Validators.required, Validators.maxLength(MAX_NOMBRE), noSoloEspacios],
    }),
    direccion: new FormControl(this.data.punto?.direccion ?? '', {
      nonNullable: true, validators: [Validators.required, noSoloEspacios],
    }),
    contacto: new FormControl(this.data.punto?.contacto ?? '', { nonNullable: true }),
    horarios: new FormControl(this.data.punto?.horarios ?? '', { nonNullable: true }),
    latitud: new FormControl(formatearCoordenada(this.data.punto?.latitud ?? null), {
      nonNullable: true, validators: [Validators.required, coordenadaValida(-90, 90)],
    }),
    longitud: new FormControl(formatearCoordenada(this.data.punto?.longitud ?? null), {
      nonNullable: true, validators: [Validators.required, coordenadaValida(-180, 180)],
    }),
    activo: new FormControl(this.data.punto?.activo ?? true, { nonNullable: true }),
  });

  guardando = false;
  /** Motivo del último rechazo del backend (o `''`). */
  errorMensaje = '';

  /** Link de verificación, solo con las dos coordenadas válidas. */
  readonly mapa$: Observable<string | null> = this.form.valueChanges.pipe(
    startWith(null),
    map(() => {
      const { latitud, longitud } = this.form.controls;
      if (latitud.invalid || longitud.invalid) return null;
      const lat = parsearCoordenada(latitud.value);
      const lon = parsearCoordenada(longitud.value);
      return lat !== null && lon !== null ? urlMapa(lat, lon) : null;
    }),
  );

  /** X, Cancelar, Escape y clic afuera: con cambios sin guardar piden confirmación (criterio único de los diálogos de formulario). */
  private readonly cierre = cierreConConfirmacion({
    dialog: this.dialog,
    dialogRef: this.dialogRef,
    destroyRef: this.destroyRef,
    hayCambios: () => this.form.dirty,
    ocupado: () => this.guardando,
    mensaje: this.esEdicion
      ? 'Hay cambios sin guardar en este punto de atención. Si cerrás ahora se pierden.'
      : 'Hay datos sin guardar. Si cerrás ahora no se agrega el punto de atención.',
  });

  /** "Guardar" bloqueado: es edición y no cambió nada. */
  get sinCambios(): boolean {
    return this.esEdicion && this.form.pristine;
  }

  /** Submit del `<form>` (botón o Enter). */
  guardar(): void {
    if (this.guardando || this.sinCambios) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const valor = this.form.getRawValue();
    const punto: PuntoAtencionFormValue = {
      fichaId: this.data.fichaId,
      nombre: valor.nombre,
      direccion: valor.direccion,
      contacto: valor.contacto,
      horarios: valor.horarios,
      // Validadas arriba: no son null.
      latitud: parsearCoordenada(valor.latitud) as number,
      longitud: parsearCoordenada(valor.longitud) as number,
      activo: valor.activo,
    };

    this.guardando = true;
    this.errorMensaje = '';
    const request$ = this.data.punto ? this.facade.update(this.data.punto.id, punto) : this.facade.create(punto);
    // `guardando` solo se apaga si falla: tras el éxito el diálogo se está cerrando y un segundo Enter o
    // clic durante la animación no tiene que volver a guardar (en alta, duplicaría el punto).
    request$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (guardado) => this.dialogRef.close(guardado),
        error: (err: unknown) => {
          this.guardando = false;
          this.cdr.markForCheck();
          this.errorMensaje = aplicarErrorDeGuardado(err, this.form, CONFLICTOS_PUNTO, FALLBACK_PUNTO);
        },
      });
  }

  /** Camino de cierre de la X y de Cancelar. */
  cancelar(): Promise<void> {
    return this.cierre();
  }

  invalido(nombre: keyof PuntoDialogComponent['form']['controls']): boolean {
    const control = this.form.controls[nombre];
    return control.invalid && control.touched;
  }
}

/** `@NotBlank` del backend: solo espacios no cuenta como completado. */
function noSoloEspacios(control: AbstractControl): ValidationErrors | null {
  const valor = String(control.value ?? '');
  return valor && !valor.trim() ? { required: true } : null;
}
