import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { AuditoriaPaginaVM, AuditoriaQuery, AuditoriaRegistroVM } from '../models/auditoria.vm';

/**
 * Fuente de datos de auditoría. BLOQUEADA por backend: hoy solo existe la impl mock.
 * Cuando el backend exponga el endpoint, se agrega `*.http.datasource.ts` y se cambia el override.
 */
export abstract class AuditoriaDataSource {
  abstract list(query: AuditoriaQuery): Observable<AuditoriaPaginaVM>;
  abstract getById(id: number): Observable<AuditoriaRegistroVM>;
}

export const AUDITORIA_DS = new InjectionToken<AuditoriaDataSource>('AUDITORIA_DS');
