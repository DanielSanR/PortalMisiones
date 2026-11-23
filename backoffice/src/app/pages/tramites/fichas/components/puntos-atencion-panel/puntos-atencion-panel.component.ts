import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, EventEmitter, Input, Output, ViewChild, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  BehaviorSubject, EMPTY, Observable, catchError, combineLatest, concat, distinctUntilChanged, filter, interval, map, of, scan,
  shareReplay, startWith, switchMap, take,
} from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ConfirmDialogData } from '@shared/components/confirm-dialog/confirm-dialog.component';
import { avisarError, avisarExito } from '@shared/utils/avisos';
import { confirmarBaja } from '@shared/utils/confirmar-baja';
import { RowAction, RowActionsComponent } from '@shared/components/row-actions';
import { HasPermissionDirective } from '@shared/directives/has-permission.directive';
import { PuntoAtencionVM, PuntosAtencionFacade } from '@features/puntos-atencion';
import { abrirFormDialog } from '@shared/utils/abrir-form-dialog';
import { dialogoDePunto } from './punto-dialogo';
import { formatearCoordenada, urlMapa } from './coordenadas';
import { puntoErrorDesactivar } from './punto-save-error';
import { TEXTO_PUNTOS_SIMULADOS, textoExito } from '@pages/tramites/fichas/ficha-textos';

/** Intentos (cada 50 ms) para esperar el re-render de la lista antes de devolver el foco. */
const PINTADOS_MAX = 40;

type EstadoPanel =
  | { tipo: 'cargando' }
  | { tipo: 'error' }
  | {
    tipo: 'ok';
    puntos: PuntoAtencionVM[];
    /** La lista incluye los desactivados (se pidieron con "Mostrar inactivos"). */
    conInactivos: boolean;
    inactivos: number;
    /** Se están pidiendo los inactivos: la lista que se ve sigue siendo la anterior. */
    cargandoInactivos: boolean;
    /** Falló la lectura CON inactivos: se muestran solo los activos y se ofrece reintentar. */
    errorInactivos: boolean;
  };

/** Paso de una lectura; `estado$` lo aplica sobre el estado anterior (para no perder la lista que ya se ve). */
type Lectura =
  | { fase: 'pidiendo-inactivos' }
  | { fase: 'error' }
  | { fase: 'ok'; puntos: PuntoAtencionVM[]; conInactivos: boolean; errorInactivos: boolean };

/**
 * Qué lectura corresponde ahora. `conInactivos` es lo que dice el interruptor; `fallo` = la última lectura con
 * inactivos falló (el interruptor volvió a apagado y el aviso sigue hasta que se reintente).
 */
interface PedidoInactivos {
  conInactivos: boolean;
  fallo: boolean;
}

function aplicar(previo: EstadoPanel, lectura: Lectura): EstadoPanel {
  switch (lectura.fase) {
    case 'pidiendo-inactivos':
      // Con una lista ya a la vista se la conserva y solo se avisa; al entrar sigue el "cargando" general.
      return previo.tipo === 'ok' ? { ...previo, cargandoInactivos: true, errorInactivos: false } : previo;
    case 'error':
      return { tipo: 'error' };
    default:
      return {
        tipo: 'ok',
        puntos: lectura.puntos,
        conInactivos: lectura.conInactivos,
        inactivos: lectura.puntos.filter((p) => !p.activo).length,
        cargandoInactivos: false,
        errorInactivos: lectura.errorInactivos,
      };
  }
}

/**
 * Puntos de atención de una ficha por localidad (PLAN_TRAMITES_API.md §4.4). Componente hijo con su
 * propio facade (§3): así el detalle y el form de la ficha no inyectan dos facades.
 *
 * - Cards de los puntos activos (los filtra el backend por ficha). Los desactivados no vienen en esa lectura:
 *   se piden aparte recién con "Mostrar inactivos", que es desde donde se reactivan (editándolos).
 *   Si esa lectura falla (pide el listado completo del alcance: es más pesada y puede fallar aunque la de la ficha
 *   ande), el panel NO se cae: quedan los activos, el interruptor vuelve a apagado y un aviso ofrece reintentar.
 *   Lo que se pide sale de `pedidoInactivos$` (no del control): así el interruptor, la región viva y las relecturas
 *   posteriores (tras agregar o editar un punto) dicen siempre lo mismo.
 *   La barra con el interruptor está siempre, también en error.
 * - Alta y edición en diálogo; desactivar con confirmación. Después de cada una el foco vuelve a un lugar con
 *   sentido (la tarjeta del punto, o "Agregar punto de atención" / el interruptor si la tarjeta ya no está).
 * - "Ver en mapa": OpenStreetMap con las coordenadas (P-8, sin dependencias).
 * - Gating por `*_ATTENTION_POINT` (el padre lo muestra solo con `READ_ATTENTION_POINT`).
 * - Tras cada ABM el facade invalida su caché y avisa por `cambios$`: el panel vuelve a leer.
 * - `cabecera`: dibuja su propio encabezado (título, total y "Agregar punto de atención"), para el detalle de la
 *   ficha, donde es un panel de primer nivel. `enfocarTitulo` lleva el foco (y el scroll) al título al mostrarse:
 *   lo usa la lista de fichas con `#puntos-atencion`. En el form la cabecera es de la pantalla.
 */
@Component({
  selector: 'app-puntos-atencion-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe, ReactiveFormsModule, MatButtonModule, MatSlideToggleModule, MatSnackBarModule, HasPermissionDirective,
    RowActionsComponent,
  ],
  templateUrl: './puntos-atencion-panel.component.html',
  styleUrl: './puntos-atencion-panel.component.scss',
})
export class PuntosAtencionPanelComponent {
  private readonly facade = inject(PuntosAtencionFacade);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  private readonly fichaId$ = new BehaviorSubject<string>('');
  private readonly recargar$ = new BehaviorSubject<void>(undefined);

  @Input({ required: true }) set fichaId(valor: string) {
    this.fichaId$.next(valor ?? '');
  }

  /** Nombre de la localidad de la ficha: el diálogo del punto la usa para ubicar la dirección y centrar el mapa. */
  @Input() localidad: string | null = null;

  /** Dibuja el encabezado del panel (título, total, "Agregar punto de atención"). */
  @Input() cabecera = false;
  /** `id` del título (el `aria-labelledby` de la sección que lo contiene). */
  @Input() tituloId = 'puntos-atencion-titulo';
  /**
   * Pide mover el foco al título cuando se dibuja (requiere `cabecera`). El panel no recuerda si ya lo hizo: lo
   * decide el padre, que apaga este flag al recibir `tituloEnfocado` (así un panel recreado no vuelve a robar el foco).
   */
  @Input() enfocarTitulo = false;
  /** El título ya recibió el foco por `enfocarTitulo`. */
  @Output() readonly tituloEnfocado = new EventEmitter<void>();

  /** La fuente es simulada: aviso persistente en el panel. */
  readonly fuenteSimulada = this.facade.fuenteSimulada;
  readonly textoPuntosSimulados = TEXTO_PUNTOS_SIMULADOS;

  /** El título aparece recién cuando llega el primer estado: ahí se le da el foco. */
  @ViewChild('titulo') set titulo(ref: ElementRef<HTMLElement> | undefined) {
    if (!ref || !this.enfocarTitulo) return;
    ref.nativeElement.focus();
    // Diferido: se emite durante la detección de cambios y el padre cambia el binding de `enfocarTitulo`.
    queueMicrotask(() => this.tituloEnfocado.emit());
  }

  readonly inactivosCtrl = new FormControl(false, { nonNullable: true });

  /**
   * Origen de la lectura: lo alimenta el interruptor y también el camino de error (que lo vuelve a `false`). No se
   * lee `inactivosCtrl.valueChanges` directo: un `setValue(false, { emitEvent: false })` dejaría el `true` anterior
   * vivo en el `combineLatest` y la próxima relectura (tras un ABM) volvería a pedir inactivos con el interruptor apagado.
   */
  private readonly pedidoInactivos$ = new BehaviorSubject<PedidoInactivos>({ conInactivos: false, fallo: false });

  constructor() {
    this.inactivosCtrl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((conInactivos) => this.pedidoInactivos$.next({ conInactivos, fallo: false }));
  }

  /**
   * "Cargando" solo al entrar (o al reintentar): después de un ABM, o al prender/apagar "Mostrar inactivos", la
   * lista se reemplaza sin parpadear (y el interruptor no pierde el foco). Mientras se piden los inactivos se
   * sigue viendo la lista anterior (`cargandoInactivos`).
   */
  readonly estado$: Observable<EstadoPanel> = combineLatest([
    this.fichaId$.pipe(filter(Boolean), distinctUntilChanged()),
    this.recargar$,
  ]).pipe(
    switchMap(([id]) => {
      // Al entrar, cambiar de ficha o reintentar se lee de nuevo (la caché es de la pantalla, no eterna).
      this.facade.refrescar();
      return combineLatest([this.facade.cambios$, this.pedidoInactivos$]).pipe(
        switchMap(([, pedido]) => (pedido.conInactivos ? this.leerConInactivos(id) : this.leerActivos(id, pedido.fallo))),
        scan(aplicar, { tipo: 'cargando' } as EstadoPanel),
        startWith<EstadoPanel>({ tipo: 'cargando' }),
      );
    }),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  /** Los activos de la ficha (la lectura liviana). `errorInactivos`: se llegó acá porque falló la de inactivos. */
  private leerActivos(id: string, errorInactivos: boolean): Observable<Lectura> {
    return this.facade.getDeFicha(id, false).pipe(
      map((puntos): Lectura => ({ fase: 'ok', puntos, conInactivos: false, errorInactivos })),
      catchError(() => of<Lectura>({ fase: 'error' })),
    );
  }

  /**
   * Activos e inactivos. Si falla, no se pierde el panel: se apaga el interruptor y el origen pasa a "solo activos,
   * con fallo", que es lo que dispara la lectura de activos con el aviso (esta lectura termina acá). Desde ahí toda
   * relectura (un ABM, "Reintentar" del error general) pide solo activos y conserva el aviso; volver a prender el
   * interruptor, o "Reintentar" del aviso, pide los inactivos de nuevo.
   */
  private leerConInactivos(id: string): Observable<Lectura> {
    return concat(
      of<Lectura>({ fase: 'pidiendo-inactivos' }),
      this.facade.getDeFicha(id, true).pipe(
        map((puntos): Lectura => ({ fase: 'ok', puntos, conInactivos: true, errorInactivos: false })),
        catchError(() => {
          this.inactivosCtrl.setValue(false, { emitEvent: false });
          this.pedidoInactivos$.next({ conInactivos: false, fallo: true });
          return EMPTY;
        }),
      ),
    );
  }

  reintentar(): void {
    this.recargar$.next();
  }

  /** Aviso "No pudimos cargar los puntos inactivos": vuelve a pedirlos (prende el interruptor). */
  reintentarInactivos(): void {
    this.inactivosCtrl.setValue(true);
  }

  activos(puntos: PuntoAtencionVM[]): number {
    return puntos.filter((p) => p.activo).length;
  }

  mapa(punto: PuntoAtencionVM): string | null {
    return punto.latitud !== null && punto.longitud !== null ? urlMapa(punto.latitud, punto.longitud) : null;
  }

  coordenadas(punto: PuntoAtencionVM): string {
    return `${formatearCoordenada(punto.latitud)}; ${formatearCoordenada(punto.longitud)}`;
  }

  /** Acción principal de la card (con permiso `UPDATE_ATTENTION_POINT`). */
  accionEditar(punto: PuntoAtencionVM): RowAction {
    return {
      label: 'Editar',
      icon: 'pencil-simple',
      permission: 'UPDATE_ATTENTION_POINT',
      ariaLabel: `Editar ${punto.nombre}`,
      run: () => this.editar(punto),
    };
  }

  /** Resto de acciones (menú ⋮): desactivar, solo si el punto está activo y con `DELETE_ATTENTION_POINT`. */
  accionesDe(punto: PuntoAtencionVM): RowAction[] {
    return punto.activo
      ? [{
        label: 'Desactivar',
        icon: 'prohibit',
        permission: 'DELETE_ATTENTION_POINT',
        danger: true,
        ariaLabel: `Desactivar ${punto.nombre}`,
        run: () => this.desactivar(punto),
      }]
      : [];
  }

  agregar(): void {
    void this.abrir(this.fichaId$.value, null, 'Punto de atención agregado');
  }

  editar(punto: PuntoAtencionVM): void {
    void this.abrir(punto.fichaId, punto, 'Punto de atención actualizado');
  }

  desactivar(punto: PuntoAtencionVM): void {
    const confirmacion: ConfirmDialogData = {
      title: '¿Desactivar el punto de atención?',
      message: `${punto.nombre} deja de mostrarse en la ficha del portal. Para reactivarlo, prendé "Mostrar inactivos" y editalo.`,
      highlight: punto.nombre,
      danger: true,
      confirmText: 'Sí, desactivar',
      busyText: 'Desactivando…',
      confirmAction: () => this.facade.desactivar(punto.id),
      errorDeAccion: puntoErrorDesactivar,
    };
    confirmarBaja({
      dialog: this.dialog,
      snackBar: this.snackBar,
      destroyRef: this.destroyRef,
      confirmacion,
      aviso: textoExito('Punto de atención desactivado', this.fuenteSimulada),
      // El menú ⋮ que abrió la confirmación desaparece con la relectura: sin esto el foco queda en `body` (WCAG 2.4.3).
      alConfirmar: () => this.devolverFoco(punto.id, true),
    });
  }

  /** El formulario se está abriendo (su código se baja en diferido): un segundo clic no abre otro. */
  private abriendo = false;

  private async abrir(fichaId: string, punto: PuntoAtencionVM | null, exito: string): Promise<void> {
    // Con un diálogo ya abierto no se abre otro encima (doble clic): cada uno podría crear su punto.
    if (this.abriendo || this.dialog.openDialogs.length) return;
    this.abriendo = true;
    try {
      const ref = await abrirFormDialog(this.dialog, dialogoDePunto(this.facade, fichaId, punto, this.localidad));
      ref.afterClosed()
        .pipe(filter((guardado): guardado is PuntoAtencionVM => !!guardado), takeUntilDestroyed(this.destroyRef))
        .subscribe((guardado) => {
          avisarExito(this.snackBar, textoExito(exito, this.fuenteSimulada));
          this.devolverFoco(guardado.id);
        });
    } catch {
      avisarError(this.snackBar, 'No pudimos abrir el formulario. Intentá de nuevo.');
    } finally {
      this.abriendo = false;
    }
  }

  /**
   * Tras guardar o desactivar, la lista se vuelve a leer y re-renderiza: el botón que abrió el diálogo ya no es el
   * mismo nodo (o ya no está) y Material devuelve el foco a `body`. Se espera a que la lista esté al día y se
   * enfoca la acción principal de la tarjeta del punto; si la tarjeta no está (se desactivó y no se muestran los
   * inactivos) o no tiene acción (sin permiso de edición), "Agregar punto de atención"; y si tampoco (sin
   * permiso de alta), el interruptor "Mostrar inactivos", que está siempre.
   *
   * `desactivado`: la tarjeta todavía activa es la de ANTES de la relectura; se sigue esperando hasta que
   * desaparezca o figure inactiva. Si la espera se agota, se enfoca lo mejor que haya.
   */
  private devolverFoco(puntoId: string, desactivado = false): void {
    const host: HTMLElement = this.host.nativeElement;
    const tarjeta = (): HTMLElement | undefined => Array.from(host.querySelectorAll<HTMLElement>('[data-punto-id]'))
      .find((el) => el.dataset['puntoId'] === puntoId);
    const destino = (): HTMLElement | null => tarjeta()?.querySelector<HTMLElement>('.puntos-card__acciones .row-action')
      ?? host.querySelector<HTMLElement>('.puntos-barra__agregar, .puntos-agregar')
      ?? host.querySelector<HTMLElement>('.puntos-barra mat-slide-toggle button');
    const listaAlDia = (): boolean => !desactivado || !tarjeta() || tarjeta()!.classList.contains('is-inactivo');

    interval(50).pipe(
      take(PINTADOS_MAX),
      // El último intento ya no espera: enfoca lo que haya.
      map((intento) => (listaAlDia() || intento === PINTADOS_MAX - 1 ? destino() : null)),
      filter((el): el is HTMLElement => !!el),
      take(1),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe((el) => el.focus());
  }
}
