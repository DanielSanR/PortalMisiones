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
import { ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { abrirConfirmacion } from '../../../../shared/utils/abrir-confirmacion';
import { EstadoBadgeComponent } from '../../../../shared/components/estado-badge/estado-badge.component';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { PageActionsDirective } from '../../../../shared/directives/page-actions.directive';
import { UnavailableDirective } from '../../../../shared/directives/unavailable.directive';
import { AccionWorkflow, EstadoFicha, FichaLocalVM, FichasLocalesFacade } from '@features/fichas-locales';
import { RUTA_DETALLE_ADOPCION } from '../../adopciones/adopciones.rutas';
import {
  ACCIONES_UI, AccionUI, MOTIVO_NO_VIGENTE, QUIEN_PUBLICA, TEXTO_FUENTE_SIMULADA, confirmAccion, confirmDesactivar, textoExito,
} from '../ficha-textos';
import {
  NO_DISPONIBLE, TEXTOS_FICHA_ERROR_CARGA, TEXTOS_FICHA_INEXISTENTE, TEXTO_FICHA_SIN_CONTENIDO, esFichaInexistente,
} from '../ficha-save-error';
import { FRAGMENTO_PUNTOS, RUTA_EDITAR_FICHA, RUTA_LISTA_FICHAS } from '../fichas.rutas';
import { PuntosAtencionPanelComponent } from '../puntos-atencion-panel/puntos-atencion-panel.component';

type EstadoDetalle =
  | { tipo: 'cargando' }
  | { tipo: 'error'; noExiste: boolean }
  | { tipo: 'ok'; ficha: FichaLocalVM };

interface AccionVista {
  accion: AccionWorkflow;
  ui: AccionUI;
  /** La única acción del header con botón primario (la primera no destructiva). */
  primaria: boolean;
}

/** Qué significa cada estado y cuál es el próximo paso. */
const AYUDA_ESTADO: Record<EstadoFicha, string> = {
  BORRADOR: `No se ve en el portal. Cuando esté lista, enviala a revisión: la publica ${QUIEN_PUBLICA}.`,
  EN_REVISION: `No se ve en el portal todavía. Espera que ${QUIEN_PUBLICA} la publique.`,
  PUBLICADO: 'Se ve en el portal. Lo que edites se publica al guardar.',
  DESPUBLICADO: 'No se ve en el portal. Se puede republicar sin pasar por revisión.',
};

/**
 * Detalle de una ficha por localidad, en el mismo lenguaje que su formulario: membrete + una tarjeta de dos
 * paneles (datos | puntos de atención) en modo lectura. Muestra los datos, requisitos y costos, el workflow de
 * publicación (botones según estado y permiso, nunca rol: D-3), "Desactivar" (en el membrete, como Plantilla),
 * "Vista previa pública" (solo `PUBLICADO`, activa y con el trámite del organismo vigente: es lo que exige la API
 * pública; si no está vigente se dice por qué no hay vista previa) y el panel de puntos de atención (componente hijo con su propio
 * facade, con cabecera propia). Con `#puntos-atencion` el foco va al título de ese panel. El resumen de
 * feedback se oculta hasta que exista la API (P-7).
 *
 * COMPATIBILIDAD TEMPORAL: si el servidor entrega la ficha sin su contenido (`sinContenido`, backend anterior a
 * `586b670`), se avisa, no se muestran datos vacíos como si fueran reales y "Editar" queda no disponible.
 */
@Component({
  selector: 'app-ficha-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe, RouterLink, MatButtonModule, MatSnackBarModule, EstadoBadgeComponent, HasPermissionDirective,
    PageActionsDirective, PuntosAtencionPanelComponent, UnavailableDirective,
  ],
  templateUrl: './ficha-detail.component.html',
  styleUrl: './ficha-detail.component.scss',
})
export class FichaDetailComponent {
  private readonly facade = inject(FichasLocalesFacade);
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
  readonly motivoNoVigente = MOTIVO_NO_VIGENTE;
  readonly textoSinContenido = TEXTO_FICHA_SIN_CONTENIDO;
  readonly fragmentoPuntos = FRAGMENTO_PUNTOS;
  /** La fuente es simulada: aviso persistente, nada de lo que se haga llega al servidor. */
  readonly fuenteSimulada = this.facade.fuenteSimulada;
  readonly textoFuenteSimulada = TEXTO_FUENTE_SIMULADA;

  /**
   * `#puntos-atencion`: el panel de puntos recibe el foco al dibujarse, UNA sola vez por navegación. Se prende
   * cuando cambia la ficha o el fragmento y se apaga en cuanto el panel avisa que enfocó (`puntosEnfocados`):
   * así el panel puede recrearse (tras "Desactivar" o "Reintentar") sin robar el foco que devuelve un diálogo.
   */
  private readonly _enfocarPuntos$ = new BehaviorSubject<boolean>(false);
  readonly enfocarPuntos$: Observable<boolean> = this._enfocarPuntos$.asObservable();

  constructor() {
    combineLatest([this.route.paramMap.pipe(map((params) => params.get('id'))), this.route.fragment])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([, fragmento]) => this._enfocarPuntos$.next(fragmento === FRAGMENTO_PUNTOS));
  }

  /** El panel de puntos ya tomó el foco: no se le vuelve a pedir en esta navegación. */
  puntosEnfocados(): void {
    this._enfocarPuntos$.next(false);
  }

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
  readonly acciones$: Observable<AccionVista[]> = combineLatest([this.estado$, this.facade.accionesWorkflow$]).pipe(
    map(([estado, accionesWorkflow]) => {
      if (estado.tipo !== 'ok') return [];
      const vistas = accionesWorkflow(estado.ficha).map((accion) => ({ accion, ui: ACCIONES_UI[accion] }));
      const primaria = vistas.find((v) => !v.ui.danger);
      return vistas.map((v): AccionVista => ({ ...v, primaria: v === primaria }));
    }),
  );

  /**
   * Qué significa el estado de la ficha. Una PUBLICADA cuyo trámite del organismo no está vigente NO se ve en el
   * portal (la API pública exige la adopción vigente): decir "Se ve en el portal" sería falso.
   */
  ayuda(ficha: FichaLocalVM): string {
    if (ficha.estado === 'PUBLICADO' && ficha.activa && ficha.adopcionNoVigente) {
      return `Está publicada, pero hoy no se ve en el portal: el trámite del organismo ${MOTIVO_NO_VIGENTE[ficha.adopcionNoVigente]}.`;
    }
    return AYUDA_ESTADO[ficha.estado];
  }

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
      this.snackBar.open(textoExito(ACCIONES_UI[accion].exito, this.fuenteSimulada), 'OK', { duration: 3000, panelClass: 'snackbar-success' });
      this.fuente$.next(resultado);
    }, () => {
      // Canceló después de un error: la ficha pudo cambiar (o quedar a mitad de un atajo de dos pasos).
      if (fallo) this.fuente$.next(null);
    });
  }

  desactivar(ficha: FichaLocalVM): void {
    this.confirmar(confirmDesactivar(ficha, () => this.facade.desactivar(ficha.id)), () => {
      this.snackBar.open(textoExito('Ficha desactivada', this.fuenteSimulada), 'OK', { duration: 3000, panelClass: 'snackbar-success' });
      // Se relee: el backend decide el estado final (despublica si estaba publicada).
      this.fuente$.next(null);
    });
  }

  private confirmar(data: ConfirmDialogData, alConfirmar: () => void, alCancelar?: () => void): void {
    abrirConfirmacion(this.dialog, { data, panelClass: 'custom-modal-panel' })
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe((ok) => (ok ? alConfirmar() : alCancelar?.()));
  }
}
