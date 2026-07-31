import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, map, shareReplay, switchMap } from 'rxjs';
import { LocalidadesRepository } from '../repositories/localidades.repository';
import { DepartamentoVM, LocalidadVM } from '../models/localidad.vm';

/**
 * Facade de Geografía — datos maestros de REFERENCIA cacheados (sin ABM, §5.1).
 * `departamentos$` y `localidades$` se resuelven una sola vez y se comparten (`shareReplay`).
 * `localidadesPorDepartamento()` deriva del stream cacheado (sin llamada extra al backend).
 * Expone Observables (async pipe; NO signals). `reload()` invalida ambas cachés.
 */
@Injectable({ providedIn: 'root' })
export class LocalidadesFacade {
  private readonly reload$ = new BehaviorSubject<void>(undefined);

  readonly departamentos$: Observable<DepartamentoVM[]> = this.reload$.pipe(
    switchMap(() => this.repo.getDepartamentos()),
    shareReplay({ bufferSize: 1, refCount: false })
  );

  readonly localidades$: Observable<LocalidadVM[]> = this.reload$.pipe(
    switchMap(() => this.repo.getLocalidades()),
    shareReplay({ bufferSize: 1, refCount: false })
  );

  constructor(private repo: LocalidadesRepository) {}

  /** Localidades de un departamento, derivadas del stream cacheado. */
  localidadesPorDepartamento(departamentoId: string): Observable<LocalidadVM[]> {
    return this.localidades$.pipe(
      map((list) => list.filter((l) => l.departamentoId === departamentoId))
    );
  }

  /** Fuerza una recarga desde el backend (invalida las cachés). */
  reload(): void {
    this.reload$.next();
  }
}
