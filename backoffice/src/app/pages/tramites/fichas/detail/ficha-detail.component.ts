import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  BehaviorSubject, Observable, catchError, combineLatest, distinctUntilChanged, map, of, shareReplay, startWith, switchMap, take,
  tap,
} from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { EstadoBadgeComponent } from '../../../../shared/components/estado-badge/estado-badge.component';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { PageActionsDirective } from '../../../../shared/directives/page-actions.directive';
import { AuthTokenService } from '@core/services/auth-token.service';
import { PUBLICACION_POLICY } from '@core/constants/policy-overrides.constants';
import { AccionWorkflow, EstadoFicha, FichaLocalVM, FichasLocalesFacade, accionesDisponibles } from '@features/fichas-locales';
import { RUTA_DETALLE_ADOPCION } from '../../adopciones/adopciones.rutas';
import { ACCIONES_UI, AccionUI, QUIEN_PUBLICA, confirmAccion, confirmDesactivar } from '../ficha-textos';
import {
  NO_DISPONIBLE, TEXTOS_FICHA_ERROR_CARGA, TEXTOS_FICHA_INEXISTENTE, esFichaInexistente,
} from '../ficha-save-error';
import { RUTA_EDITAR_FICHA, RUTA_LISTA_FICHAS } from '../fichas.rutas';
import { PuntosAtencionPanelComponent } from '../puntos-atencion-panel/puntos-atencion-panel.component';

type EstadoDetalle =
  | { tipo: 'cargando' }
  | { tipo: 'error'; noExiste: boolean }
  | { tipo: 'ok'; ficha: FichaLocalVM };

interface AccionVista {
  accion: AccionWorkflow;
  ui: AccionUI;
}

/** Qué significa cada estado y cuál es el próximo paso. */
const AYUDA_ESTADO: Record<EstadoFicha, string> = {
  BORRADOR: `No se ve en el portal. Cuando esté lista, enviala a revisión: la publica ${QUIEN_PUBLICA}.`,
  EN_REVISION: `No se ve en el portal todavía. Espera que ${QUIEN_PUBLICA} la publique.`,
  PUBLICADO: 'Se ve en el portal. Lo que edites se publica al guardar.',
  DESPUBLICADO: 'No se ve en el portal. Se puede republicar sin pasar por revisión.',
};

/**
 * Detalle de una ficha por localidad: datos, requisitos y costos, el workflow de publicación (botones
 * según estado y permiso, nunca rol: D-3), "Desactivar", "Vista previa pública" (solo `PUBLICADO`) y el
 * panel de puntos de atención (componente hijo con su propio facade). El resumen de feedback se oculta
 * hasta que exista la API (P-7).
 */
@Component({
  selector: 'app-ficha-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe, RouterLink, MatButtonModule, MatSnackBarModule, EstadoBadgeComponent, HasPermissionDirective,
    PageActionsDirective, PuntosAtencionPanelComponent,
  ],
  templateUrl: './ficha-detail.component.html',
  styleUrl: './ficha-detail.component.scss',
})
export class FichaDetailComponent {
  private readonly facade = inject(FichasLocalesFacade);
  private readonly auth = inject(AuthTokenService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  readonly noDisponible = NO_DISPONIBLE;
  readonly textosInexistente = TEXTOS_FICHA_INEXISTENTE;
  readonly textosErrorCarga = TEXTOS_FICHA_ERROR_CARGA;
  readonly rutaAdopcion = RUTA_DETALLE_ADOPCION;
  readonly rutaEditar = RUTA_EDITAR_FICHA;
  readonly ayudaEstado = AYUDA_ESTADO;

  /**
   * `null` = leer del backend; una ficha = la que devolvió la última acción (se muestra sin volver a
   * pedirla y sin pasar por "cargando").
   */
  private readonly fuente$ = new BehaviorSubject<FichaLocalVM | null>(null);

  /** Compartido: lo leen el contenido y las acciones del header. Sigue a `paramMap`. */
  readonly estado$: Observable<EstadoDetalle> = this.route.paramMap.pipe(
    map((params) => params.get('id') ?? ''),
    distinctUntilChanged(),
    switchMap((id) => {
      // Otra ficha (o volver a esta): lo que dejó una acción anterior no sirve, se relee.
      this.fuente$.next(null);
      return this.fuente$.pipe(
        switchMap((actual) => actual?.id === id
          ? of<EstadoDetalle>({ tipo: 'ok', ficha: actual })
          : this.facade.getDetalle(id).pipe(
            map((ficha): EstadoDetalle => ({ tipo: 'ok', ficha })),
            catchError((err: unknown) => of<EstadoDetalle>({ tipo: 'error', noExiste: esFichaInexistente(err) })),
            startWith<EstadoDetalle>({ tipo: 'cargando' }),
          )),
      );
    }),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  /** Acciones del workflow para el estado actual y los permisos de la sesión (reactivo a ambos). */
  readonly acciones$: Observable<AccionVista[]> = combineLatest([this.estado$, this.auth.getCurrentUser$()]).pipe(
    map(([estado]) => estado.tipo !== 'ok'
      ? []
      : accionesDisponibles(estado.ficha.estado, (p) => this.auth.can(p), {
        activa: estado.ficha.activa,
        permitirEnviarYPublicar: PUBLICACION_POLICY.permitirEnviarYPublicar,
      }).map((accion) => ({ accion, ui: ACCIONES_UI[accion] }))),
  );

  /** Dirección pública de la ficha publicada (`null` si la fuente no tiene: mock). */
  urlPublica(ficha: FichaLocalVM): string | null {
    return this.facade.urlPublica(ficha.slug);
  }

  reintentar(): void {
    this.fuente$.next(null);
  }

  volverAlListado(): void {
    this.router.navigate([RUTA_LISTA_FICHAS]);
  }

  ejecutar(ficha: FichaLocalVM, accion: AccionWorkflow): void {
    let resultado: FichaLocalVM | null = null;
    let fallo = false;
    const data = confirmAccion(ficha, accion, () => this.facade.ejecutar(ficha.id, accion).pipe(
      tap({ next: (actualizada) => { resultado = actualizada; }, error: () => { fallo = true; } }),
    ));
    this.confirmar(data, () => {
      this.snackBar.open(ACCIONES_UI[accion].exito, 'OK', { duration: 3000, panelClass: 'snackbar-success' });
      this.fuente$.next(resultado);
    }, () => {
      // Canceló después de un error: la ficha pudo cambiar (o quedar a mitad de un atajo de dos pasos).
      if (fallo) this.fuente$.next(null);
    });
  }

  desactivar(ficha: FichaLocalVM): void {
    this.confirmar(confirmDesactivar(ficha, () => this.facade.desactivar(ficha.id)), () => {
      this.snackBar.open('Ficha desactivada', 'OK', { duration: 3000, panelClass: 'snackbar-success' });
      // Se relee: el backend decide el estado final (despublica si estaba publicada).
      this.fuente$.next(null);
    });
  }

  private confirmar(data: ConfirmDialogData, alConfirmar: () => void, alCancelar?: () => void): void {
    // Un doble clic no abre dos confirmaciones.
    if (this.dialog.openDialogs.length) return;
    this.dialog.open(ConfirmDialogComponent, { data, panelClass: 'custom-modal-panel' })
      .afterClosed()
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe((ok) => (ok ? alConfirmar() : alCancelar?.()));
  }
}
