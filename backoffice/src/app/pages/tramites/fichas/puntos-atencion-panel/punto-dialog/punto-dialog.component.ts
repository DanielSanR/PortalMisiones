import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, finalize, map, startWith } from 'rxjs';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { aplicarErrorDeGuardado } from '@core/utils/save-error.utils';
import { PuntoAtencionFormValue, PuntoAtencionVM, PuntosAtencionFacade } from '@features/puntos-atencion';
import { MAX_DECIMALES, coordenadaValida, formatearCoordenada, parsearCoordenada, urlMapa } from '../coordenadas';
import { CONFLICTOS_PUNTO, FALLBACK_PUNTO } from '../punto-save-error';

/** Qué abre el diálogo: alta (sin `punto`) o edición. */
export interface PuntoDialogData {
  fichaId: string;
  punto: PuntoAtencionVM | null;
}

/** Largo razonable de los textos cortos (la base es VARCHAR/TEXT sin límite). */
const MAX_NOMBRE = 255;

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
    MatProgressSpinnerModule, MatSlideToggleModule,
  ],
  templateUrl: './punto-dialog.component.html',
  styleUrl: './punto-dialog.component.scss',
})
export class PuntoDialogComponent {
  private readonly facade = inject(PuntosAtencionFacade);
  private readonly dialogRef = inject<MatDialogRef<PuntoDialogComponent, PuntoAtencionVM>>(MatDialogRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  readonly data = inject<PuntoDialogData>(MAT_DIALOG_DATA);

  readonly esEdicion = !!this.data.punto;
  readonly maxNombre = MAX_NOMBRE;
  readonly maxDecimales = MAX_DECIMALES;

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

  /** Submit del `<form>` (botón o Enter). */
  guardar(): void {
    if (this.guardando) return;
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
    this.dialogRef.disableClose = true;
    const request$ = this.data.punto ? this.facade.update(this.data.punto.id, punto) : this.facade.create(punto);
    request$
      .pipe(
        finalize(() => {
          this.guardando = false;
          this.dialogRef.disableClose = false;
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (guardado) => this.dialogRef.close(guardado),
        error: (err: unknown) => {
          this.errorMensaje = aplicarErrorDeGuardado(err, this.form, CONFLICTOS_PUNTO, FALLBACK_PUNTO);
        },
      });
  }

  cancelar(): void {
    this.dialogRef.close();
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
