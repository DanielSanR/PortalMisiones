import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { AuditoriaRepository } from '../repositories/auditoria.repository';
import { AuditoriaPaginaVM, AuditoriaQuery, AuditoriaRegistroVM } from '../models/auditoria.vm';

const PAGINA_VACIA: AuditoriaPaginaVM = { registros: [], total: 0 };

/**
 * Facade de Auditoría (feature bloqueada por backend; corre en mock). Expone Observables
 * (async pipe; NO signals). Depende solo del repositorio. La paginación es server-side:
 * `pagina$` refleja la última página cargada.
 */
@Injectable({ providedIn: 'root' })
export class AuditoriaFacade {
  private readonly _pagina$ = new BehaviorSubject<AuditoriaPaginaVM>(PAGINA_VACIA);
  readonly pagina$ = this._pagina$.asObservable();

  constructor(private auditoria: AuditoriaRepository) {}

  loadPagina(query: AuditoriaQuery): Observable<AuditoriaPaginaVM> {
    return this.auditoria.list(query).pipe(tap((pagina) => this._pagina$.next(pagina)));
  }

  getById(id: number): Observable<AuditoriaRegistroVM> {
    return this.auditoria.getById(id);
  }
}
