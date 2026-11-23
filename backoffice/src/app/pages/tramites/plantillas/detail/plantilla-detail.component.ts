import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { BehaviorSubject, Observable, combineLatest, map, shareReplay, switchMap } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { confirmarBaja } from '@shared/utils/confirmar-baja';
import { Carga, conCarga } from '@shared/utils/carga';
import { EstadoCargaComponent } from '@shared/components/estado-carga/estado-carga.component';
import { HasPermissionDirective } from '@shared/directives/has-permission.directive';
import { PageActionsDirective } from '@shared/directives/page-actions.directive';
import { PlantillaRef, PlantillaVM, PlantillasFacade } from '@features/plantillas';
import { RUTA_EDITAR_PLANTILLA, RUTA_LISTA_PLANTILLAS } from '../plantillas.rutas';
import { RUTA_LISTA_ADOPCIONES } from '@pages/tramites/adopciones/adopciones.rutas';
import { TEXTOS_PLANTILLA_INEXISTENTE, esPlantillaInexistente } from '../plantilla-save-error';
import { AdopcionesDePlantillaComponent } from '@pages/tramites/adopciones/components/de-plantilla/adopciones-de-plantilla.component';
import { MembreteComponent, MembreteDato } from '@shared/components/membrete/membrete.component';
import { membreteDePlantilla } from '../plantilla-textos';
import { DatoRecomendado, datosRecomendados } from '../plantilla-recomendados-textos';
import { NO_DISPONIBLE } from '@core/constants/textos.constants';

/** Grupo de referencias de catálogo que se muestra como chips. */
interface GrupoDeRefs {
  label: string;
  refs: PlantillaRef[];
  vacio: string;
}

/** La plantilla ya resuelta, con lo que el detalle deriva de ella. */
interface DetalleDePlantilla {
  plantilla: PlantillaVM;
  /** Línea meta del membrete: slug · modalidad · categoría principal. */
  membrete: MembreteDato[];
  grupos: GrupoDeRefs[];
  recomendados: DatoRecomendado[];
  recomendadosListos: number;
}

type EstadoDetalle = Carga<DetalleDePlantilla>;

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
    MembreteComponent, EstadoCargaComponent,
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

  readonly noDisponible = NO_DISPONIBLE;
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
        map((plantilla): DetalleDePlantilla => {
          const recomendados = datosRecomendados({
            resumen: plantilla.resumen,
            tieneModalidad: !!plantilla.modalidad,
            tieneCategoriaPrincipal: !!plantilla.categoriaPrincipal,
          });
          return {
            plantilla, grupos: gruposDe(plantilla), recomendados, membrete: membreteDe(plantilla),
            recomendadosListos: recomendados.filter((d) => d.completo).length,
          };
        }),
        conCarga(esPlantillaInexistente),
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
    confirmarBaja({
      dialog: this.dialog,
      snackBar: this.snackBar,
      destroyRef: this.destroyRef,
      confirmacion: {
        title: '¿Desactivar la plantilla?',
        message: `La plantilla ${plantilla.titulo} deja de listarse y no se va a poder adoptar. `
          + 'Por ahora no hay forma de verla ni reactivarla desde el listado.',
        highlight: plantilla.titulo,
        danger: true,
        confirmText: 'Sí, desactivar',
        busyText: 'Desactivando…',
        confirmAction: () => this.facade.desactivar(plantilla.id),
      },
      aviso: 'Plantilla desactivada',
      alConfirmar: () => this.volverAlListado(),
    });
  }
}

function membreteDe(p: PlantillaVM): MembreteDato[] {
  return membreteDePlantilla({
    slug: p.slug,
    modalidad: p.modalidad ? (p.modalidad.nombre ?? NO_DISPONIBLE) : '',
    principal: p.categoriaPrincipal ? (p.categoriaPrincipal.nombre ?? NO_DISPONIBLE) : '',
  });
}

function gruposDe(p: PlantillaVM): GrupoDeRefs[] {
  return [
    { label: 'Categorías', refs: p.categorias, vacio: 'Sin categorías asignadas.' },
    { label: 'Etiquetas', refs: p.etiquetas, vacio: 'Sin etiquetas asignadas.' },
    { label: 'Destinatarios', refs: p.destinatarios, vacio: 'Sin destinatarios asignados.' },
    { label: 'Eventos de vida', refs: p.eventosDeVida, vacio: 'Sin eventos de vida asignados.' },
  ];
}
