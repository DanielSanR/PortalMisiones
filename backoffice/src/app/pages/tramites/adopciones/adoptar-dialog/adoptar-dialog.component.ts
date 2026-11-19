import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, ElementRef, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BehaviorSubject, Observable, catchError, map, of, shareReplay, startWith, switchMap, timer } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { aplicarErrorDeGuardado } from '@core/utils/save-error.utils';
import { hoy } from '@core/utils/fecha.utils';
import { AdopcionFormValue, AdopcionOpciones, AdopcionVM, AdopcionesFacade } from '@features/adopciones';
import { FormErrorBannerComponent } from '@shared/components/form-error-banner/form-error-banner.component';
import { LoadingComponent } from '@shared/components/loading/loading.component';
import { cierreConConfirmacion } from '@shared/utils/cierre-con-confirmacion';
import { VigenciaCamposComponent } from '../vigencia-campos/vigencia-campos.component';
import { crearVigenciaForm, rangoDeVigencia } from '../vigencia-campos/vigencia-form';
import { CONFLICTOS_ADOPCION, FALLBACK_ADOPCION } from '../adopcion-save-error';

type EstadoOpciones =
  | { tipo: 'cargando' }
  | { tipo: 'error' }
  | { tipo: 'ok'; opciones: AdopcionOpciones };

/**
 * Diálogo "Adoptar trámite": plantilla activa + organismo + vigencia. Solo se abre con `ADOPTAR_ACCESS`
 * (P-2: hace falta `READ_ORGANISM` para elegir el organismo, o tener uno propio en la sesión). Con una
 * sesión de organismo el campo viene como dato de solo lectura, enfocable y con el motivo
 * (`opciones.organismoFijo`). Queda abierto mientras guarda y,
 * si el backend rechaza (`4080` solapamiento, `4012`, `4073`), cuenta el motivo acá mismo para
 * corregir y reintentar. `afterClosed()` emite la adopción creada, o `undefined` si se canceló.
 */
@Component({
  selector: 'app-adoptar-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe, ReactiveFormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, FormErrorBannerComponent, LoadingComponent, VigenciaCamposComponent,
  ],
  templateUrl: './adoptar-dialog.component.html',
  styleUrl: './adoptar-dialog.component.scss',
})
export class AdoptarDialogComponent {
  private readonly facade = inject(AdopcionesFacade);
  private readonly dialogRef = inject<MatDialogRef<AdoptarDialogComponent, AdopcionVM>>(MatDialogRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = inject(MatDialog);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

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

  /**
   * Estado de la carga de opciones, SIN efectos: lo consume la vista con `async`. Compartido
   * (`shareReplay`) porque también lo escucha el constructor, y no tiene que pedir las opciones dos veces.
   */
  readonly estado$: Observable<EstadoOpciones> = this.recargar$.pipe(
    switchMap(() => this.facade.getOpcionesAdoptar().pipe(
      map((opciones): EstadoOpciones => ({ tipo: 'ok', opciones })),
      catchError(() => of<EstadoOpciones>({ tipo: 'error' })),
      startWith<EstadoOpciones>({ tipo: 'cargando' }),
    )),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  /** El organismo lo fijó la sesión en la última carga (para deshacerlo si un "Reintentar" ya no lo trae). */
  private organismoFijado = false;

  constructor() {
    // Lo que la carga le hace al formulario va acá y no en un `tap` de `estado$`: ahí correría durante la
    // suscripción del `async` pipe, en plena detección de cambios, y con una fuente síncrona (caché del
    // facade) tocar el form daría `ExpressionChangedAfterItHasBeenChecked`. Esta suscripción se hace antes
    // del primer render y, después, solo recibe emisiones que nacen fuera de él ("Reintentar", la red).
    this.estado$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((estado) => {
      if (estado.tipo !== 'ok') return;
      this.fijarOrganismo(estado.opciones);
      this.enfocarPrimerCampo();
    });
  }

  /**
   * Sesión de organismo: el control queda con el organismo del usuario (la vista lo muestra de solo
   * lectura) y su valor viaja como cualquier otro. Sin `emitEvent` ni `markAsDirty`: no es un cambio de la
   * persona, así que cerrar sin tocar nada más no pide confirmación.
   */
  private fijarOrganismo(opciones: AdopcionOpciones): void {
    const organismo = this.form.controls.organismoId;
    if (opciones.organismoFijo) {
      organismo.setValue(opciones.organismoFijo.id, { emitEvent: false });
    } else if (this.organismoFijado) {
      // La sesión cambió entre un intento y otro ("Reintentar"): vuelve a ser un select vacío para elegir.
      organismo.reset('', { emitEvent: false });
    }
    this.organismoFijado = !!opciones.organismoFijo;
  }

  /**
   * Los campos recién existen cuando llegan las opciones, así que el `autoFocus` de Material (que corre al
   * abrir, con el diálogo todavía "Cargando…") deja el foco en el contenedor. Se lo da al primer campo en
   * cuanto se pinta, salvo que la persona ya haya movido el foco a algún control del formulario.
   */
  private enfocarPrimerCampo(): void {
    timer(0).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      const form = this.host.nativeElement.closest('form') ?? this.host.nativeElement.querySelector('form');
      const activo = document.activeElement;
      if (form && activo && activo !== document.body && form.contains(activo)) return;
      this.host.nativeElement.querySelector<HTMLElement>('#adoptar-plantilla')?.focus();
    });
  }

  /** X, Cancelar, Escape y clic afuera: con cambios sin guardar piden confirmación (criterio único de los diálogos de formulario). */
  private readonly cierre = cierreConConfirmacion({
    dialog: this.dialog,
    dialogRef: this.dialogRef,
    destroyRef: this.destroyRef,
    hayCambios: () => this.form.dirty,
    ocupado: () => this.guardando,
    mensaje: 'Hay datos sin guardar. Si cerrás ahora no se adopta el trámite.',
  });

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

    // `guardando` solo se apaga si falla: tras el éxito el diálogo se está cerrando y un segundo Enter o
    // clic durante la animación no tiene que adoptar el trámite otra vez.
    this.facade.adoptar(adopcion)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (creada) => this.dialogRef.close(creada),
        error: (err: unknown) => {
          this.guardando = false;
          this.cdr.markForCheck();
          this.errorMensaje = aplicarErrorDeGuardado(err, this.form, CONFLICTOS_ADOPCION, FALLBACK_ADOPCION);
        },
      });
  }

  /** Camino de cierre de la X y de Cancelar. */
  cancelar(): Promise<void> {
    return this.cierre();
  }
}
