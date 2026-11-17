import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, EventEmitter, Input, Output, ViewChild, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  BehaviorSubject, Observable, catchError, combineLatest, defer, distinctUntilChanged, filter, interval, map, of, shareReplay,
  startWith, switchMap, take,
} from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { abrirConfirmacion } from '../../../../shared/utils/abrir-confirmacion';
import { RowAction, RowActionsComponent } from '../../../../shared/components/row-actions';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { PuntoAtencionVM, PuntosAtencionFacade } from '@features/puntos-atencion';
import { PuntoDialogComponent, PuntoDialogData } from './punto-dialog/punto-dialog.component';
import { formatearCoordenada, urlMapa } from './coordenadas';
import { conMensajeDePunto } from './punto-save-error';
import { TEXTO_PUNTOS_SIMULADOS, textoExito } from '../ficha-textos';

/** Intentos (cada 50 ms) para esperar el re-render de la lista antes de devolver el foco. */
const PINTADOS_MAX = 40;

type EstadoPanel =
  | { tipo: 'cargando' }
  | { tipo: 'error' }
  | { tipo: 'ok'; puntos: PuntoAtencionVM[]; inactivos: number };

/**
 * Puntos de atención de una ficha por localidad (PLAN_TRAMITES_API.md §4.4). Componente hijo con su
 * propio facade (§3): así el detalle y el form de la ficha no inyectan dos facades.
 *
 * - Cards; los desactivados (el backend los lista) se ocultan salvo con "Mostrar inactivos".
 * - Alta y edición en diálogo; desactivar con confirmación.
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
   * "Cargando" solo al entrar (o al reintentar): después de un ABM la lista se reemplaza sin parpadear.
   */
  readonly estado$: Observable<EstadoPanel> = combineLatest([
    this.fichaId$.pipe(filter(Boolean), distinctUntilChanged()),
    this.recargar$,
  ]).pipe(
    switchMap(([id]) => {
      // Al entrar, cambiar de ficha o reintentar se lee de nuevo (la caché es de la pantalla, no eterna).
      this.facade.refrescar();
      return this.facade.cambios$.pipe(
        switchMap(() => this.facade.getDeFicha(id).pipe(
          map((puntos): EstadoPanel => ({ tipo: 'ok', puntos, inactivos: puntos.filter((p) => !p.activo).length })),
          catchError(() => of<EstadoPanel>({ tipo: 'error' })),
        )),
        startWith<EstadoPanel>({ tipo: 'cargando' }),
      );
    }),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  readonly visibles$: Observable<PuntoAtencionVM[]> = combineLatest([
    this.estado$,
    defer(() => this.inactivosCtrl.valueChanges.pipe(startWith(this.inactivosCtrl.value))),
  ]).pipe(
    map(([estado, inactivos]) => (estado.tipo === 'ok' ? estado.puntos.filter((p) => inactivos || p.activo) : [])),
  );

  reintentar(): void {
    this.recargar$.next();
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
    this.abrir({ fichaId: this.fichaId$.value, punto: null }, 'Punto de atención agregado');
  }

  editar(punto: PuntoAtencionVM): void {
    this.abrir({ fichaId: punto.fichaId, punto }, 'Punto de atención actualizado');
  }

  desactivar(punto: PuntoAtencionVM): void {
    const data: ConfirmDialogData = {
      title: '¿Desactivar el punto de atención?',
      message: `${punto.nombre} deja de mostrarse en la ficha del portal. Podés reactivarlo editándolo.`,
      highlight: punto.nombre,
      danger: true,
      confirmText: 'Sí, desactivar',
      busyText: 'Desactivando…',
      confirmAction: () => conMensajeDePunto(this.facade.desactivar(punto.id)),
    };
    abrirConfirmacion(this.dialog, { data, panelClass: 'custom-modal-panel' })
      .pipe(filter(Boolean), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.snackBar.open(textoExito('Punto de atención desactivado', this.fuenteSimulada), 'OK', { duration: 3000, panelClass: 'snackbar-success' }));
  }

  private abrir(data: PuntoDialogData, exito: string): void {
    // Con un diálogo ya abierto no se abre otro encima (doble clic): cada uno podría crear su punto.
    if (this.dialog.openDialogs.length) return;
    this.dialog.open<PuntoDialogComponent, PuntoDialogData, PuntoAtencionVM>(PuntoDialogComponent, {
      data,
      panelClass: 'custom-modal-panel',
      autoFocus: '#punto-nombre',
    })
      .afterClosed()
      .pipe(filter((guardado): guardado is PuntoAtencionVM => !!guardado), takeUntilDestroyed(this.destroyRef))
      .subscribe((guardado) => {
        this.snackBar.open(textoExito(exito, this.fuenteSimulada), 'OK', { duration: 3000, panelClass: 'snackbar-success' });
        this.devolverFoco(guardado.id);
      });
  }

  /**
   * Tras guardar, la lista se vuelve a leer y re-renderiza: el botón que abrió el diálogo ya no es el
   * mismo nodo y Material devuelve el foco a `body`. Se espera a que la tarjeta del punto guardado
   * exista y se enfoca su acción principal; si no hay (sin permiso de edición), el botón "Agregar punto".
   */
  private devolverFoco(puntoId: string): void {
    const buscar = (): HTMLElement | null => {
      const host: HTMLElement = this.host.nativeElement;
      const tarjeta = Array.from(host.querySelectorAll<HTMLElement>('[data-punto-id]'))
        .find((el) => el.dataset['puntoId'] === puntoId);
      return tarjeta?.querySelector<HTMLElement>('.puntos-card__acciones .row-action')
        ?? host.querySelector<HTMLElement>('.puntos-barra__agregar, .puntos-agregar');
    };
    interval(50).pipe(
      take(PINTADOS_MAX),
      map(buscar),
      filter((el): el is HTMLElement => !!el),
      take(1),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe((el) => el.focus());
  }
}
