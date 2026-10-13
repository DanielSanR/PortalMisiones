import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BehaviorSubject, Observable, catchError, combineLatest, filter, map, of, shareReplay, startWith, switchMap } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { PageActionsDirective } from '../../../../shared/directives/page-actions.directive';
import { PlantillaRef, PlantillaVM, PlantillasFacade } from '@features/plantillas';
import { RUTA_EDITAR_PLANTILLA, RUTA_LISTA_PLANTILLAS } from '../plantillas.rutas';
import { TEXTOS_PLANTILLA_INEXISTENTE, esPlantillaInexistente } from '../plantilla-save-error';

/** Grupo de referencias de catálogo que se muestra como chips. */
interface GrupoDeRefs {
  label: string;
  icono: string;
  refs: PlantillaRef[];
  vacio: string;
}

type EstadoDetalle =
  | { tipo: 'cargando' }
  | { tipo: 'error'; noExiste: boolean }
  | { tipo: 'ok'; plantilla: PlantillaVM; grupos: GrupoDeRefs[] };

/**
 * Detalle de una plantilla provincial (activa o no: `GET /{id}` devuelve también las inactivas).
 * La pestaña "Organismos que la adoptaron" llega con la fase 2 (adopciones).
 */
@Component({
  selector: 'app-plantilla-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncPipe, MatButtonModule, MatSnackBarModule, HasPermissionDirective, PageActionsDirective],
  templateUrl: './plantilla-detail.component.html',
  styleUrl: './plantilla-detail.component.scss',
})
export class PlantillaDetailComponent {
  private readonly facade = inject(PlantillasFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  readonly noDisponible = 'No disponible';
  readonly textosInexistente = TEXTOS_PLANTILLA_INEXISTENTE;
  /** Id de la plantilla mostrada (lo actualiza `estado$` al cambiar el `:id`). */
  private id = '';
  private readonly recargar$ = new BehaviorSubject<void>(undefined);

  /**
   * Compartido: lo leen el contenido y las acciones del header (dos `async`, una sola llamada).
   * Sigue a `paramMap`: si el router reutiliza el componente con otro `:id`, recarga.
   */
  readonly estado$: Observable<EstadoDetalle> = combineLatest([
    this.route.paramMap.pipe(map((params) => params.get('id') ?? '')),
    this.recargar$,
  ]).pipe(
    switchMap(([id]) => {
      this.id = id;
      return this.facade.getDetalle(id).pipe(
        map((plantilla): EstadoDetalle => ({ tipo: 'ok', plantilla, grupos: gruposDe(plantilla) })),
        catchError((err: unknown) => of<EstadoDetalle>({ tipo: 'error', noExiste: esPlantillaInexistente(err) })),
        startWith<EstadoDetalle>({ tipo: 'cargando' }),
      );
    }),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  reintentar(): void {
    this.recargar$.next();
  }

  volverAlListado(): void {
    this.router.navigate([RUTA_LISTA_PLANTILLAS]);
  }

  editar(): void {
    this.router.navigate([RUTA_EDITAR_PLANTILLA, this.id]);
  }

  desactivar(plantilla: PlantillaVM): void {
    this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: '¿Desactivar la plantilla?',
        message: `La plantilla ${plantilla.titulo} deja de listarse y no se va a poder adoptar. `
          + 'Por ahora no hay forma de verla ni reactivarla desde el listado.',
        highlight: plantilla.titulo,
        danger: true,
        confirmText: 'Sí, desactivar',
        busyText: 'Desactivando...',
        confirmAction: () => this.facade.desactivar(plantilla.id),
      },
      panelClass: 'custom-modal-panel',
    })
      .afterClosed()
      .pipe(filter(Boolean), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.snackBar.open('Plantilla desactivada', 'OK', { duration: 3000, panelClass: 'snackbar-success' });
        this.volverAlListado();
      });
  }
}

function gruposDe(p: PlantillaVM): GrupoDeRefs[] {
  return [
    { label: 'Categorías', icono: 'folders', refs: p.categorias, vacio: 'Sin categorías' },
    { label: 'Etiquetas', icono: 'tag', refs: p.etiquetas, vacio: 'Sin etiquetas' },
    { label: 'Destinatarios', icono: 'user-focus', refs: p.destinatarios, vacio: 'Sin destinatarios' },
    { label: 'Eventos de vida', icono: 'bookmarks-simple', refs: p.eventosDeVida, vacio: 'Sin eventos de vida' },
  ];
}
