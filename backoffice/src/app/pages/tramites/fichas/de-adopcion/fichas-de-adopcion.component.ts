import { ChangeDetectionStrategy, Component, Input, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BehaviorSubject, Observable, catchError, combineLatest, distinctUntilChanged, filter, map, of, startWith, switchMap } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { EstadoBadgeComponent } from '../../../../shared/components/estado-badge/estado-badge.component';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { CREAR_FICHA_ACCESS } from '@core/constants/policy-overrides.constants';
import { FichaLocalVM, FichasLocalesFacade, MotivoNoVigente } from '@features/fichas-locales';
import { UnavailableDirective } from '../../../../shared/directives/unavailable.directive';
import { MOTIVO_NO_VIGENTE, TEXTO_FUENTE_SIMULADA } from '../ficha-textos';
import { TEXTO_FICHAS_SIN_ADOPCION } from '../ficha-save-error';
import { RUTA_DETALLE_FICHA, RUTA_NUEVA_FICHA } from '../fichas.rutas';

type EstadoLista =
  | { tipo: 'cargando' }
  | { tipo: 'error' }
  /** `motivoNoVigente`: por qué hoy no se le pueden agregar fichas (`null` = se puede, o no se pudo saber). */
  | { tipo: 'ok'; fichas: FichaLocalVM[]; motivoNoVigente: MotivoNoVigente | null; sinContenido: boolean };

/**
 * "Fichas por localidad" de un trámite del organismo (adopción), para su detalle: una fila por ficha
 * (localidad, estado, versión) y "Agregar ficha por localidad" (`CREAR_FICHA_ACCESS`). Componente hijo con su
 * propio facade (PLAN_TRAMITES_API.md §3): así el detalle de la adopción no inyecta dos facades y
 * `AdopcionesFacade` no depende de fichas (fichas ya depende de adopciones: sería un ciclo).
 * El padre lo muestra solo con `READ_VARIANT`. Las fichas las filtra la fuente por adopción.
 *
 * El backend solo acepta crear fichas de una adopción VIGENTE (habilitada, ya empezó a regir y no venció; si no,
 * 404): cuando no lo está, "Agregar ficha por localidad" queda visible pero no disponible, con el motivo
 * (`appUnavailable`), y un aviso lo explica.
 *
 * COMPATIBILIDAD TEMPORAL: con un backend anterior a `586b670` las fichas llegan sin decir de qué adopción son
 * (`sinContenido`): no se listan y se avisa, en vez de mostrar "Todavía no se ofrece en ninguna localidad".
 */
@Component({
  selector: 'app-fichas-de-adopcion',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncPipe, RouterLink, MatButtonModule, EstadoBadgeComponent, HasPermissionDirective, UnavailableDirective],
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

  /**
   * Lo que el padre sabe de la adopción. Si está deshabilitada no se le pueden agregar fichas; que además esté
   * dentro de su vigencia lo resuelve este componente con el facade (`motivoNoVigente`).
   */
  @Input() habilitada = true;

  readonly rutaDetalle = RUTA_DETALLE_FICHA;
  readonly rutaNueva = RUTA_NUEVA_FICHA;
  readonly crearFicha = CREAR_FICHA_ACCESS;
  readonly fuenteSimulada = this.facade.fuenteSimulada;
  readonly textoFuenteSimulada = TEXTO_FUENTE_SIMULADA;
  readonly textoSinContenido = TEXTO_FICHAS_SIN_ADOPCION;

  readonly estado$: Observable<EstadoLista> = combineLatest([
    this.adopcionId$.pipe(filter(Boolean), distinctUntilChanged()),
    this.recargar$,
  ]).pipe(
    switchMap(([id]) => this.facade.getDeAdopcion(id).pipe(
      map(({ fichas, motivoNoVigente, sinContenido }): EstadoLista => ({
        tipo: 'ok', fichas: ordenar(fichas), motivoNoVigente, sinContenido,
      })),
      catchError(() => of<EstadoLista>({ tipo: 'error' })),
      startWith<EstadoLista>({ tipo: 'cargando' }),
    )),
  );

  /**
   * Por qué no se pueden agregar fichas ahora, o `null`. Lo que leyó el facade manda; si no pudo leer la adopción,
   * queda lo que dice el padre (`habilitada`).
   */
  motivo(leido: MotivoNoVigente | null): MotivoNoVigente | null {
    return leido ?? (this.habilitada ? null : 'deshabilitada');
  }

  /** Motivo del botón no disponible (tooltip + lector de pantalla). */
  motivoBoton(motivo: MotivoNoVigente): string {
    return `No se pueden agregar fichas: el trámite del organismo ${MOTIVO_NO_VIGENTE[motivo]}.`;
  }

  /** Aviso sobre la lista: qué pasa con las fichas de un trámite del organismo que no está vigente. */
  aviso(motivo: MotivoNoVigente): string {
    return `El trámite del organismo ${MOTIVO_NO_VIGENTE[motivo]}: no se le pueden agregar ni editar fichas, `
      + 'y las que tiene no se ven en el portal aunque estén publicadas.';
  }

  reintentar(): void {
    this.recargar$.next();
  }
}

/** Activas primero; dentro de cada grupo, por localidad. */
function ordenar(fichas: FichaLocalVM[]): FichaLocalVM[] {
  return [...fichas].sort((a, b) => Number(b.activa) - Number(a.activa)
    || (a.localidadNombre ?? a.slug).localeCompare(b.localidadNombre ?? b.slug, 'es-AR', { sensitivity: 'base' }));
}
