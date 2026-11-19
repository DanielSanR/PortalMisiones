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
 * Dos lecturas, porque el backend filtra por ficha pero entonces devuelve SOLO los activos:
 * - Lo normal (los puntos activos de una ficha): `?organismProcedureLocationId=`, sin caché.
 * - Con los desactivados (para verlos y reactivarlos editándolos): no hay filtro que los traiga, así que
 *   se pide el listado completo del alcance, UNA vez (`shareReplay(1)`), y se filtra por `fichaId` acá.
 *   Solo se paga cuando alguien pide ver los desactivados.
 * Cada alta, edición o desactivación invalida la caché y avisa por `cambios$`, para que el panel vuelva a
 * leer. Un cambio de sesión también la invalida (`AuthTokenService` solo se usa para eso: es
 * infraestructura de sesión, no autorización).
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

  /** ¿Los datos son simulados (no se guardan en el servidor)? Lo decide la fuente. */
  get fuenteSimulada(): boolean {
    return this.puntos.fuenteSimulada;
  }

  /**
   * Puntos de una ficha, ordenados: activos primero, después por nombre. Por defecto solo los activos (los
   * filtra el backend); con `incluirInactivos` también los desactivados (listado completo, filtrado acá).
   */
  getDeFicha(fichaId: string, incluirInactivos = false): Observable<PuntoAtencionVM[]> {
    const puntos$ = incluirInactivos
      ? this.todos().pipe(map((lista) => lista.filter((p) => p.fichaId === fichaId)))
      // El filtro del backend ya devuelve solo activos; se vuelve a filtrar para no depender de eso.
      : this.puntos.list({ fichaId }).pipe(map((lista) => lista.filter((p) => p.fichaId === fichaId && p.activo)));
    return puntos$.pipe(
      map((lista) => [...lista].sort((a, b) => Number(b.activo) - Number(a.activo)
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

  /** Borrado lógico (`active=false`): el punto deja de venir en el listado de la ficha (solo con los desactivados). */
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
