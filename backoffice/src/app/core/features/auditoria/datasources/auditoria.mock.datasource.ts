import { Injectable } from '@angular/core';
import { Observable, delay, of, switchMap, throwError, timer } from 'rxjs';
import { AuditoriaDataSource } from './auditoria.datasource';
import { MOCK_AUDITORIA_REGISTROS } from './auditoria.mock-data';
import { toAuditoriaPaginaVM, toAuditoriaRegistroVM } from '../mappers/auditoria.mapper';
import { AuditoriaRegistroDTO } from '../models/auditoria.dto';
import { AuditoriaPaginaVM, AuditoriaQuery, AuditoriaRegistroVM } from '../models/auditoria.vm';

const DELAY = 200;

/**
 * Implementación mock en memoria: filtra por búsqueda (trámite o usuario) y acción, ordena por
 * fecha desc y pagina (1-based), igual que lo hacía la ruta `/api/auditoria` del interceptor.
 */
@Injectable()
export class AuditoriaMockDataSource extends AuditoriaDataSource {
  private readonly data: AuditoriaRegistroDTO[] = [...MOCK_AUDITORIA_REGISTROS];

  list(query: AuditoriaQuery): Observable<AuditoriaPaginaVM> {
    let filtrados = [...this.data];

    if (query.search) {
      const q = query.search.toLowerCase();
      filtrados = filtrados.filter(
        (a) => a.tramiteTitulo?.toLowerCase().includes(q) || a.usuarioNombre?.toLowerCase().includes(q),
      );
    }
    if (query.accion) filtrados = filtrados.filter((a) => a.accion === query.accion);

    filtrados.sort((a, b) => b.fechaAccion.localeCompare(a.fechaAccion));

    const page = query.page || 1;
    const pageSize = query.pageSize || 10;
    const data = filtrados.slice((page - 1) * pageSize, page * pageSize);
    return of(toAuditoriaPaginaVM({ data, total: filtrados.length })).pipe(delay(DELAY));
  }

  getById(id: number): Observable<AuditoriaRegistroVM> {
    const registro = this.data.find((a) => a.id === id);
    if (registro) return of(toAuditoriaRegistroVM(registro)).pipe(delay(DELAY));
    // `delay` no demora un error: la latencia se simula con un timer previo.
    return timer(DELAY).pipe(
      switchMap(() => throwError(() => ({ status: 404, error: { message: 'El registro de auditoría no existe' } }))),
    );
  }
}
