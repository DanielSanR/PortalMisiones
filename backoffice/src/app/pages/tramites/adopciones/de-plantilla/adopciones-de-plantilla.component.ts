import { ChangeDetectionStrategy, Component, Input, inject } from '@angular/core';
import { AsyncPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BehaviorSubject, Observable, catchError, combineLatest, distinctUntilChanged, filter, map, of, startWith, switchMap } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { AdopcionVM, AdopcionesFacade } from '@features/adopciones';
import { VigenciaBadgeComponent } from '../vigencia-badge/vigencia-badge.component';
import { NO_DISPONIBLE } from '../adopcion-save-error';
import { RUTA_DETALLE_ADOPCION } from '../adopciones.rutas';

type EstadoLista =
  | { tipo: 'cargando' }
  | { tipo: 'error' }
  | { tipo: 'ok'; adopciones: AdopcionVM[] };

/**
 * "Organismos que la adoptaron": las adopciones habilitadas de una plantilla, para el detalle de la
 * plantilla. Componente hijo con su propio facade (PLAN_TRAMITES_API.md §3): así el detalle de
 * plantilla no inyecta dos facades y `PlantillasFacade` no depende de adopciones (adopciones ya
 * depende de plantillas: sería un ciclo). El padre lo muestra solo con `READ_ADOPTION`.
 */
@Component({
  selector: 'app-adopciones-de-plantilla',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncPipe, DatePipe, RouterLink, MatButtonModule, VigenciaBadgeComponent],
  templateUrl: './adopciones-de-plantilla.component.html',
  styleUrl: './adopciones-de-plantilla.component.scss',
})
export class AdopcionesDePlantillaComponent {
  private readonly facade = inject(AdopcionesFacade);
  private readonly plantillaId$ = new BehaviorSubject<string>('');
  private readonly recargar$ = new BehaviorSubject<void>(undefined);

  @Input({ required: true }) set plantillaId(valor: string) {
    this.plantillaId$.next(valor ?? '');
  }

  readonly rutaDetalle = RUTA_DETALLE_ADOPCION;
  readonly noDisponible = NO_DISPONIBLE;

  readonly estado$: Observable<EstadoLista> = combineLatest([
    this.plantillaId$.pipe(filter(Boolean), distinctUntilChanged()),
    this.recargar$,
  ]).pipe(
    switchMap(([id]) => this.facade.getDePlantilla(id).pipe(
      map((adopciones): EstadoLista => ({ tipo: 'ok', adopciones: ordenar(adopciones) })),
      catchError(() => of<EstadoLista>({ tipo: 'error' })),
      startWith<EstadoLista>({ tipo: 'cargando' }),
    )),
  );

  reintentar(): void {
    this.recargar$.next();
  }
}

/** Por organismo y, dentro de cada uno, por inicio de vigencia. */
function ordenar(adopciones: AdopcionVM[]): AdopcionVM[] {
  return [...adopciones].sort((a, b) =>
    (a.organismoNombre ?? '').localeCompare(b.organismoNombre ?? '', 'es-AR', { sensitivity: 'base' })
    || a.vigenteDesde.getTime() - b.vigenteDesde.getTime());
}
