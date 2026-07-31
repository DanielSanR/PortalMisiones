import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { DestinatarioFormValue, DestinatarioVM } from '../models/destinatario.vm';

/** Fuente de datos de Destinatarios. Reads públicos; escrituras SUPERADMIN/ADMIN_BACKOFFICE (§5.4). */
export abstract class DestinatariosDataSource {
  abstract list(): Observable<DestinatarioVM[]>;
  abstract getById(id: string): Observable<DestinatarioVM>;
  abstract create(form: DestinatarioFormValue): Observable<DestinatarioVM>;
  abstract update(id: string, form: DestinatarioFormValue): Observable<DestinatarioVM>;
  abstract delete(id: string): Observable<void>;
}

export const DESTINATARIOS_DS = new InjectionToken<DestinatariosDataSource>('DESTINATARIOS_DS');
