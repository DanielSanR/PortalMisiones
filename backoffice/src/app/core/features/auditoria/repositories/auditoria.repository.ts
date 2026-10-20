import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { AUDITORIA_DS, AuditoriaDataSource } from '../datasources/auditoria.datasource';
import { AuditoriaPaginaVM, AuditoriaQuery, AuditoriaRegistroVM } from '../models/auditoria.vm';

/** Repositorio de auditoría. Inyecta el DataSource vía token. */
@Injectable({ providedIn: 'root' })
export class AuditoriaRepository {
  constructor(@Inject(AUDITORIA_DS) private ds: AuditoriaDataSource) {}

  list(query: AuditoriaQuery): Observable<AuditoriaPaginaVM> {
    return this.ds.list(query);
  }

  getById(id: number): Observable<AuditoriaRegistroVM> {
    return this.ds.getById(id);
  }
}
