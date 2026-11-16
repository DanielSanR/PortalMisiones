import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BehaviorSubject, Observable, catchError, combineLatest, filter, map, of, shareReplay, startWith, switchMap } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { abrirConfirmacion } from '../../../../shared/utils/abrir-confirmacion';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { PageActionsDirective } from '../../../../shared/directives/page-actions.directive';
import { PlantillaRef, PlantillaVM, PlantillasFacade } from '@features/plantillas';
import { RUTA_EDITAR_PLANTILLA, RUTA_LISTA_PLANTILLAS } from '../plantillas.rutas';
import { RUTA_LISTA_ADOPCIONES } from '../../adopciones/adopciones.rutas';
import { TEXTOS_PLANTILLA_INEXISTENTE, esPlantillaInexistente } from '../plantilla-save-error';
import { AdopcionesDePlantillaComponent } from '../../adopciones/de-plantilla/adopciones-de-plantilla.component';
import { PlantillaMembreteComponent } from '../membrete/plantilla-membrete.component';
import { DatoRecomendado, datosRecomendados } from '../plantilla-recomendados';

/** Grupo de referencias de catálogo que se muestra como chips. */
interface GrupoDeRefs {
  label: string;
  refs: PlantillaRef[];
  vacio: string;
}

type EstadoDetalle =
  | { tipo: 'cargando' }
  | { tipo: 'error'; noExiste: boolean }
  | { tipo: 'ok'; plantilla: PlantillaVM; grupos: GrupoDeRefs[]; recomendados: DatoRecomendado[]; recomendadosListos: number };

/**
 * Detalle de una plantilla provincial (activa o no: `GET /{id}` devuelve también las inactivas).
 * La sección "Organismos que la adoptaron" (solo con `READ_ADOPTION`) es un componente hijo del
 * feature adopciones con su propio facade: este componente sigue inyectando solo `PlantillasFacade`.
 */
@Component({
  selector: 'app-plantilla-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe, RouterLink, MatButtonModule, MatSnackBarModule, HasPermissionDirective, PageActionsDirective, AdopcionesDePlantillaComponent,
    PlantillaMembreteComponent,
  ],
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
  readonly rutaAdopciones = RUTA_LISTA_ADOPCIONES;
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
        map((plantilla): EstadoDetalle => {
          const recomendados = datosRecomendados({
            resumen: plantilla.resumen,
            tieneModalidad: !!plantilla.modalidad,
            tieneCategoriaPrincipal: !!plantilla.categoriaPrincipal,
          });
          return {
            tipo: 'ok', plantilla, grupos: gruposDe(plantilla), recomendados,
            recomendadosListos: recomendados.filter((d) => d.completo).length,
          };
        }),
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
    abrirConfirmacion(this.dialog, {
      data: {
        title: '¿Desactivar la plantilla?',
        message: `La plantilla ${plantilla.titulo} deja de listarse y no se va a poder adoptar. `
          + 'Por ahora no hay forma de verla ni reactivarla desde el listado.',
        highlight: plantilla.titulo,
        danger: true,
        confirmText: 'Sí, desactivar',
        busyText: 'Desactivando…',
        confirmAction: () => this.facade.desactivar(plantilla.id),
      },
      panelClass: 'custom-modal-panel',
    })
      .pipe(filter(Boolean), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.snackBar.open('Plantilla desactivada', 'OK', { duration: 3000, panelClass: 'snackbar-success' });
        this.volverAlListado();
      });
  }
}

function gruposDe(p: PlantillaVM): GrupoDeRefs[] {
  return [
    { label: 'Categorías', refs: p.categorias, vacio: 'Sin categorías asignadas.' },
    { label: 'Etiquetas', refs: p.etiquetas, vacio: 'Sin etiquetas asignadas.' },
    { label: 'Destinatarios', refs: p.destinatarios, vacio: 'Sin destinatarios asignados.' },
    { label: 'Eventos de vida', refs: p.eventosDeVida, vacio: 'Sin eventos de vida asignados.' },
  ];
}
