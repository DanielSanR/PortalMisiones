import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BehaviorSubject, Observable, catchError, finalize, map, of, shareReplay, startWith, switchMap } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { aplicarErrorDeGuardado } from '@core/utils/save-error.utils';
import { hoy } from '@core/utils/fecha.utils';
import { AdopcionFormValue, AdopcionOpciones, AdopcionVM, AdopcionesFacade } from '@features/adopciones';
import { VigenciaCamposComponent } from '../vigencia-campos/vigencia-campos.component';
import { crearVigenciaForm, rangoDeVigencia } from '../vigencia-campos/vigencia-form';
import { CONFLICTOS_ADOPCION, FALLBACK_ADOPCION } from '../adopcion-save-error';

type EstadoOpciones =
  | { tipo: 'cargando' }
  | { tipo: 'error' }
  | { tipo: 'ok'; opciones: AdopcionOpciones };

/**
 * Diálogo "Adoptar trámite": plantilla activa + organismo + vigencia. Solo se abre con `ADOPTAR_ACCESS`
 * (P-2: sin `READ_ORGANISM` no hay a qué organismo adoptar, por G-2). Queda abierto mientras guarda y,
 * si el backend rechaza (`4080` solapamiento, `4012`, `4073`), cuenta el motivo acá mismo para
 * corregir y reintentar. `afterClosed()` emite la adopción creada, o `undefined` si se canceló.
 */
@Component({
  selector: 'app-adoptar-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe, ReactiveFormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule,
    MatSelectModule, VigenciaCamposComponent,
  ],
  templateUrl: './adoptar-dialog.component.html',
  styleUrl: './adoptar-dialog.component.scss',
})
export class AdoptarDialogComponent {
  private readonly facade = inject(AdopcionesFacade);
  private readonly dialogRef = inject<MatDialogRef<AdoptarDialogComponent, AdopcionVM>>(MatDialogRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  readonly form = new FormGroup({
    plantillaId: new FormControl('', { nonNullable: true, validators: Validators.required }),
    organismoId: new FormControl('', { nonNullable: true, validators: Validators.required }),
    vigencia: crearVigenciaForm(hoy()),
  });

  guardando = false;
  /** Intentos de envío inválidos: le avisan a `app-vigencia-campos` (OnPush) que repinte errores. */
  intentos = 0;
  /** Motivo del último rechazo del backend (o `''`). */
  errorMensaje = '';

  private readonly recargar$ = new BehaviorSubject<void>(undefined);

  readonly estado$: Observable<EstadoOpciones> = this.recargar$.pipe(
    switchMap(() => this.facade.getOpcionesAdoptar().pipe(
      map((opciones): EstadoOpciones => ({ tipo: 'ok', opciones })),
      catchError(() => of<EstadoOpciones>({ tipo: 'error' })),
      startWith<EstadoOpciones>({ tipo: 'cargando' }),
    )),
    // Compartido: lo leen el cuerpo y el botón "Adoptar" (dos `async`, una sola llamada).
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  reintentar(): void {
    this.recargar$.next();
  }

  /** Submit del `<form>` (botón o Enter). */
  guardar(): void {
    if (this.guardando) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.intentos++;
      return;
    }

    const valor = this.form.getRawValue();
    const adopcion: AdopcionFormValue = {
      plantillaId: valor.plantillaId,
      organismoId: valor.organismoId,
      organismoTitularId: null,
      habilitada: true,
      ...rangoDeVigencia(this.form.controls.vigencia),
    };

    this.guardando = true;
    this.errorMensaje = '';
    this.dialogRef.disableClose = true;

    this.facade.adoptar(adopcion)
      .pipe(
        finalize(() => {
          this.guardando = false;
          this.dialogRef.disableClose = false;
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (creada) => this.dialogRef.close(creada),
        error: (err: unknown) => {
          this.errorMensaje = aplicarErrorDeGuardado(err, this.form, CONFLICTOS_ADOPCION, FALLBACK_ADOPCION);
        },
      });
  }

  cancelar(): void {
    this.dialogRef.close();
  }
}
