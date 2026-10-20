import { ChangeDetectionStrategy, Component, Input, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BehaviorSubject, Observable, catchError, combineLatest, distinctUntilChanged, filter, map, of, startWith, switchMap } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { EstadoBadgeComponent } from '../../../../shared/components/estado-badge/estado-badge.component';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { CREAR_FICHA_ACCESS } from '@core/constants/policy-overrides.constants';
import { FichaLocalVM, FichasLocalesFacade } from '@features/fichas-locales';
import { NO_DISPONIBLE } from '../ficha-save-error';
import { RUTA_DETALLE_FICHA, RUTA_LISTA_FICHAS, RUTA_NUEVA_FICHA } from '../fichas.rutas';

type EstadoLista =
  | { tipo: 'cargando' }
  | { tipo: 'error' }
  /** La fuente no informa a qué adopción pertenece cada ficha (G-1): no hay lista que mostrar. */
  | { tipo: 'no-disponible' }
  | { tipo: 'ok'; fichas: FichaLocalVM[] };

/**
 * "Fichas por localidad" de un trámite del organismo (adopción), para su detalle: una fila por ficha
 * (localidad, estado, versión) y "Agregar localidad" (`CREAR_FICHA_ACCESS`). Componente hijo con su
 * propio facade (PLAN_TRAMITES_API.md §3): así el detalle de la adopción no inyecta dos facades y
 * `AdopcionesFacade` no depende de fichas (fichas ya depende de adopciones: sería un ciclo).
 * El padre lo muestra solo con `READ_VARIANT`. Si la fuente no dice a qué adopción pertenece cada ficha
 * (G-1), muestra un estado "no disponible" con link a la lista general en vez de un vacío engañoso.
 */
@Component({
  selector: 'app-fichas-de-adopcion',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncPipe, RouterLink, MatButtonModule, EstadoBadgeComponent, HasPermissionDirective],
  templateUrl: './fichas-de-adopcion.component.html',
  styleUrl: './fichas-de-adopcion.component.scss',
})
export class FichasDeAdopcionComponent {
  private readonly facade = inject(FichasLocalesFacade);
  private readonly adopcionId$ = new BehaviorSubject<string>('');
  private readonly recargar$ = new BehaviorSubject<void>(undefined);

  @Input({ required: true }) set adopcionId(valor: string) {
    this.adopcionId$.next(valor ?? '');
  }

  get adopcionId(): string {
    return this.adopcionId$.value;
  }

  /** Adopción deshabilitada: se puede agregar igual (el backend lo acepta), pero se avisa. */
  @Input() habilitada = true;

  readonly rutaDetalle = RUTA_DETALLE_FICHA;
  readonly rutaNueva = RUTA_NUEVA_FICHA;
  readonly rutaLista = RUTA_LISTA_FICHAS;
  readonly crearFicha = CREAR_FICHA_ACCESS;
  readonly noDisponible = NO_DISPONIBLE;

  readonly estado$: Observable<EstadoLista> = combineLatest([
    this.adopcionId$.pipe(filter(Boolean), distinctUntilChanged()),
    this.recargar$,
  ]).pipe(
    switchMap(([id]) => this.facade.getDeAdopcion(id).pipe(
      map(({ disponible, fichas }): EstadoLista => (disponible
        ? { tipo: 'ok', fichas: ordenar(fichas) }
        : { tipo: 'no-disponible' })),
      catchError(() => of<EstadoLista>({ tipo: 'error' })),
      startWith<EstadoLista>({ tipo: 'cargando' }),
    )),
  );

  reintentar(): void {
    this.recargar$.next();
  }
}

/** Activas primero; dentro de cada grupo, por localidad. */
function ordenar(fichas: FichaLocalVM[]): FichaLocalVM[] {
  return [...fichas].sort((a, b) => Number(b.activa) - Number(a.activa)
    || (a.localidadNombre ?? a.slug).localeCompare(b.localidadNombre ?? b.slug, 'es-AR', { sensitivity: 'base' }));
}
