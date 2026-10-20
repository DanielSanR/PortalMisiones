import { ChangeDetectionStrategy, Component, DestroyRef, Input, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  BehaviorSubject, Observable, catchError, combineLatest, defer, distinctUntilChanged, filter, map, of, shareReplay, startWith,
  switchMap,
} from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { RowAction, RowActionsComponent } from '../../../../shared/components/row-actions';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { PuntoAtencionVM, PuntosAtencionFacade } from '@features/puntos-atencion';
import { PuntoDialogComponent, PuntoDialogData } from './punto-dialog/punto-dialog.component';
import { formatearCoordenada, urlMapa } from './coordenadas';
import { conMensajeDePunto } from './punto-save-error';

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

  private readonly fichaId$ = new BehaviorSubject<string>('');
  private readonly recargar$ = new BehaviorSubject<void>(undefined);

  @Input({ required: true }) set fichaId(valor: string) {
    this.fichaId$.next(valor ?? '');
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
      busyText: 'Desactivando...',
      confirmAction: () => conMensajeDePunto(this.facade.desactivar(punto.id)),
    };
    this.dialog.open(ConfirmDialogComponent, { data, panelClass: 'custom-modal-panel' })
      .afterClosed()
      .pipe(filter(Boolean), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.snackBar.open('Punto de atención desactivado', 'OK', { duration: 3000, panelClass: 'snackbar-success' }));
  }

  private abrir(data: PuntoDialogData, exito: string): void {
    this.dialog.open<PuntoDialogComponent, PuntoDialogData, PuntoAtencionVM>(PuntoDialogComponent, {
      data,
      panelClass: 'custom-modal-panel',
      autoFocus: 'first-tabbable',
    })
      .afterClosed()
      .pipe(filter((guardado): guardado is PuntoAtencionVM => !!guardado), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.snackBar.open(exito, 'OK', { duration: 3000, panelClass: 'snackbar-success' }));
  }
}
