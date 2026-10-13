import { Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BehaviorSubject, Observable, catchError, distinctUntilChanged, map, shareReplay, skip, tap, throwError } from 'rxjs';
import { AuthTokenService } from '@core/services/auth-token.service';
import { PuntosAtencionRepository } from '../repositories/puntos-atencion.repository';
import { PuntoAtencionFormValue, PuntoAtencionVM } from '../models/punto-atencion.vm';

/**
 * Facade de puntos de atención (`/api/attention-point`, real o mock según `featureOverrides`). Solo
 * depende de su repositorio. Expone Observables (async pipe; NO signals).
 *
 * El backend no filtra por ficha: el listado completo del alcance se pide UNA vez, se cachea con
 * `shareReplay(1)` y se filtra por `fichaId` en el cliente. Cada alta, edición o desactivación invalida
 * la caché y avisa por `cambios$`, para que el panel vuelva a leer. Un cambio de sesión también la
 * invalida (`AuthTokenService` solo se usa para eso: es infraestructura de sesión, no autorización).
 */
@Injectable({ providedIn: 'root' })
export class PuntosAtencionFacade {
  private cache$: Observable<PuntoAtencionVM[]> | null = null;
  private readonly _cambios$ = new BehaviorSubject<void>(undefined);
  /** Emite al suscribirse y después de cada ABM: el panel lo combina para recargar. */
  readonly cambios$ = this._cambios$.asObservable();

  constructor(
    private puntos: PuntosAtencionRepository,
    private auth: AuthTokenService,
  ) {
    // Singleton `root`: la suscripción vive lo mismo que la app.
    this.auth.getCurrentUser$()
      .pipe(map((usuario) => usuario?.id ?? null), distinctUntilChanged(), skip(1), takeUntilDestroyed())
      .subscribe(() => this.invalidar());
  }

  /** Puntos (activos e inactivos) de una ficha, ordenados: activos primero, después por nombre. */
  getDeFicha(fichaId: string): Observable<PuntoAtencionVM[]> {
    return this.todos().pipe(
      map((lista) => lista
        .filter((p) => p.fichaId === fichaId)
        .sort((a, b) => Number(b.activo) - Number(a.activo)
          || a.nombre.localeCompare(b.nombre, 'es-AR', { sensitivity: 'base' }))),
    );
  }

  /**
   * Descarta la caché sin avisar: el panel lo llama al montarse (o al cambiar de ficha / reintentar)
   * para no mostrar puntos que otro usuario cambió mientras tanto. Dentro de una misma pantalla la
   * caché sigue sirviendo.
   */
  refrescar(): void {
    this.cache$ = null;
  }

  create(form: PuntoAtencionFormValue): Observable<PuntoAtencionVM> {
    return this.puntos.create(form).pipe(tap(() => this.huboCambios()));
  }

  update(id: string, form: PuntoAtencionFormValue): Observable<PuntoAtencionVM> {
    return this.puntos.update(id, form).pipe(tap(() => this.huboCambios()));
  }

  /** Borrado lógico (`active=false`): el punto sigue listándose como inactivo. */
  desactivar(id: string): Observable<void> {
    return this.puntos.desactivar(id).pipe(tap(() => this.huboCambios()));
  }

  private todos(): Observable<PuntoAtencionVM[]> {
    if (!this.cache$) {
      const cache$: Observable<PuntoAtencionVM[]> = this.puntos.list().pipe(
        catchError((err: unknown) => {
          // Un error no se cachea: el próximo pedido (Reintentar) vuelve a leer.
          if (this.cache$ === cache$) this.cache$ = null;
          return throwError(() => err);
        }),
        shareReplay(1),
      );
      this.cache$ = cache$;
    }
    return this.cache$;
  }

  private huboCambios(): void {
    this.cache$ = null;
    this._cambios$.next();
  }

  private invalidar(): void {
    this.cache$ = null;
  }
}
