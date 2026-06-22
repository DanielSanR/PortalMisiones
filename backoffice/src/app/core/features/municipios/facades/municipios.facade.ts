import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, shareReplay, switchMap } from 'rxjs';
import { MunicipiosRepository } from '../repositories/municipios.repository';
import { MunicipioVM } from '../models/municipio.vm';

/**
 * Facade de Municipios — datos de REFERENCIA cacheados. `municipios$` se resuelve una sola vez
 * y se comparte (`shareReplay`) entre todos los consumidores (selects de localidad). `reload()`
 * invalida la caché. Expone Observables (async pipe; NO signals).
 */
@Injectable({ providedIn: 'root' })
export class MunicipiosFacade {
  private readonly reload$ = new BehaviorSubject<void>(undefined);

  /** Stream cacheado: una sola llamada al backend, compartida; persiste sin suscriptores. */
  readonly municipios$: Observable<MunicipioVM[]> = this.reload$.pipe(
    switchMap(() => this.municipios.getAll()),
    shareReplay({ bufferSize: 1, refCount: false })
  );

  constructor(private municipios: MunicipiosRepository) {}

  /** Fuerza una recarga desde el backend (invalida la caché). */
  reload(): void {
    this.reload$.next();
  }
}
