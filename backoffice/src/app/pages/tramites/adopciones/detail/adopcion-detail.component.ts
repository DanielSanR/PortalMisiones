import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject } from '@angular/core';
import { AsyncPipe, DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  BehaviorSubject, Observable, catchError, combineLatest, filter, finalize, map, of, shareReplay, startWith, switchMap, tap,
} from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { PageActionsDirective } from '../../../../shared/directives/page-actions.directive';
import { PuedeTenerCambiosSinGuardar } from '@core/guards';
import { aplicarErrorDeGuardado } from '@core/utils/save-error.utils';
import { inicioDelDia } from '@core/utils/fecha.utils';
import { AdopcionFormValue, AdopcionVM, AdopcionesFacade } from '@features/adopciones';
import { RUTA_DETALLE_PLANTILLA } from '../../plantillas/plantillas.rutas';
import { RUTA_LISTA_ADOPCIONES } from '../adopciones.rutas';
import {
  CONFLICTOS_ADOPCION, FALLBACK_ADOPCION, NO_DISPONIBLE, TEXTOS_ADOPCION_INEXISTENTE, esAdopcionInexistente,
} from '../adopcion-save-error';
import { confirmDeshabilitar } from '../adopcion-textos';
import { VigenciaBadgeComponent } from '../vigencia-badge/vigencia-badge.component';
import { FichasDeAdopcionComponent } from '../../fichas/de-adopcion/fichas-de-adopcion.component';
import { VigenciaCamposComponent } from '../vigencia-campos/vigencia-campos.component';
import { crearVigenciaForm, rangoDeVigencia } from '../vigencia-campos/vigencia-form';

type EstadoDetalle =
  | { tipo: 'cargando' }
  | { tipo: 'error'; noExiste: boolean }
  | { tipo: 'ok'; adopcion: AdopcionVM };

/**
 * Detalle de un trámite del organismo (adopción, habilitada o no: `GET /{id}` devuelve las dos).
 * Datos + edición de vigencia y "habilitada" (`UPDATE_ADOPTION`, PUT total que reenvía plantilla,
 * organismo y titular tal cual) + "Deshabilitar" (`DELETE_ADOPTION`) + "Fichas por localidad"
 * (`app-fichas-de-adopcion`, hijo con su propio facade, con `READ_VARIANT`).
 */
@Component({
  selector: 'app-adopcion-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe, DatePipe, RouterLink, ReactiveFormsModule, MatButtonModule, MatSlideToggleModule, MatSnackBarModule,
    HasPermissionDirective, PageActionsDirective, VigenciaBadgeComponent, VigenciaCamposComponent, FichasDeAdopcionComponent,
  ],
  templateUrl: './adopcion-detail.component.html',
  styleUrl: './adopcion-detail.component.scss',
})
export class AdopcionDetailComponent implements PuedeTenerCambiosSinGuardar {
  private readonly facade = inject(AdopcionesFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly noDisponible = NO_DISPONIBLE;
  readonly textosInexistente = TEXTOS_ADOPCION_INEXISTENTE;
  readonly rutaPlantilla = RUTA_DETALLE_PLANTILLA;

  readonly form = new FormGroup({
    vigencia: crearVigenciaForm(),
    habilitada: new FormControl(true, { nonNullable: true }),
  });

  guardando = false;
  /** Intentos de envío inválidos: le avisan a `app-vigencia-campos` (OnPush) que repinte errores. */
  intentos = 0;
  /** Motivo del último rechazo del backend al guardar (o `''`). */
  errorMensaje = '';

  /** Adopción mostrada (la última que resolvió `estado$`): la base del PUT total. */
  private actual: AdopcionVM | null = null;
  /**
   * `null` = leer del backend; una adopción = la que devolvió el último guardado (se muestra sin
   * volver a pedirla y sin pasar por "cargando").
   */
  private readonly fuente$ = new BehaviorSubject<AdopcionVM | null>(null);

  /**
   * Compartido: lo leen el contenido y las acciones del header (dos `async`, una sola llamada).
   * Sigue a `paramMap`: si el router reutiliza el componente con otro `:id`, recarga.
   */
  readonly estado$: Observable<EstadoDetalle> = combineLatest([
    this.route.paramMap.pipe(map((params) => params.get('id') ?? '')),
    this.fuente$,
  ]).pipe(
    switchMap(([id, guardada]) => guardada?.id === id
      ? of<EstadoDetalle>({ tipo: 'ok', adopcion: guardada })
      : this.facade.getDetalle(id).pipe(
        map((adopcion): EstadoDetalle => ({ tipo: 'ok', adopcion })),
        catchError((err: unknown) => of<EstadoDetalle>({ tipo: 'error', noExiste: esAdopcionInexistente(err) })),
        startWith<EstadoDetalle>({ tipo: 'cargando' }),
      )),
    tap((estado) => {
      if (estado.tipo === 'ok') this.cargarEnForm(estado.adopcion);
    }),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  reintentar(): void {
    this.fuente$.next(null);
  }

  volverAlListado(): void {
    this.router.navigate([RUTA_LISTA_ADOPCIONES]);
  }

  /** Vuelve el form a los valores guardados. */
  descartar(): void {
    if (this.actual) this.cargarEnForm(this.actual);
  }

  guardar(): void {
    if (this.guardando || !this.actual) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.intentos++;
      return;
    }

    const valor = this.form.getRawValue();
    const actual = this.actual;
    // PUT total: plantilla, organismo y titular viajan tal cual; solo cambian vigencia y habilitada.
    // Una fecha sin tocar reenvía su hora original (`rangoDeVigencia`).
    const cambios: AdopcionFormValue = {
      plantillaId: actual.plantillaId,
      organismoId: actual.organismoId,
      organismoTitularId: actual.organismoTitularId,
      habilitada: valor.habilitada,
      ...rangoDeVigencia(this.form.controls.vigencia, actual),
    };

    this.guardando = true;
    this.errorMensaje = '';
    this.facade.update(actual.id, cambios)
      .pipe(
        finalize(() => { this.guardando = false; this.cdr.markForCheck(); }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (guardada) => {
          const texto = guardada.habilitada === actual.habilitada
            ? 'Cambios guardados'
            : guardada.habilitada ? 'Trámite del organismo habilitado' : 'Trámite del organismo deshabilitado';
          this.snackBar.open(texto, 'OK', { duration: 3000, panelClass: 'snackbar-success' });
          this.fuente$.next(guardada);
        },
        error: (err: unknown) => {
          this.errorMensaje = aplicarErrorDeGuardado(err, this.form, CONFLICTOS_ADOPCION, FALLBACK_ADOPCION);
        },
      });
  }

  deshabilitar(adopcion: AdopcionVM): void {
    this.dialog.open(ConfirmDialogComponent, {
      data: confirmDeshabilitar(adopcion, () => this.facade.deshabilitar(adopcion.id)),
      panelClass: 'custom-modal-panel',
    })
      .afterClosed()
      .pipe(filter(Boolean), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.snackBar.open('Trámite del organismo deshabilitado', 'OK', { duration: 3000, panelClass: 'snackbar-success' });
        // El form queda limpio: salir no tiene que preguntar por cambios sin guardar.
        this.form.markAsPristine();
        this.volverAlListado();
      });
  }

  /**
   * Lo consulta `unsavedChangesGuard` antes de dejar salir de la pantalla. Mientras guarda no
   * pregunta: el guardado no navega, y al terminar el form queda limpio.
   */
  tieneCambiosSinGuardar(): boolean {
    return !this.guardando && this.form.dirty;
  }

  private cargarEnForm(adopcion: AdopcionVM): void {
    this.actual = adopcion;
    this.errorMensaje = '';
    this.form.reset({
      vigencia: {
        vigenteDesde: inicioDelDia(adopcion.vigenteDesde),
        vigenteHasta: adopcion.vigenteHasta ? inicioDelDia(adopcion.vigenteHasta) : null,
      },
      habilitada: adopcion.habilitada,
    });
  }
}
