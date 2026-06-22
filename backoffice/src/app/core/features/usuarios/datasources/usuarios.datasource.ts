import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { UsuarioFormValue, UsuarioVM } from '../models/usuario.vm';

/**
 * Fuente de datos de usuarios. Interface source-agnostic: cada implementación (HTTP o mock)
 * adapta su origen al ViewModel. La elección la resuelve el token vía `provideDataSource`.
 */
export abstract class UsuariosDataSource {
  abstract list(): Observable<UsuarioVM[]>;
  abstract getById(id: string): Observable<UsuarioVM>;
  abstract create(form: UsuarioFormValue): Observable<UsuarioVM>;
  abstract update(id: string, form: UsuarioFormValue): Observable<UsuarioVM>;
  abstract toggleActive(id: string): Observable<UsuarioVM>;
  /** Activa/desactiva la cuenta (REAL: PUT /api/user/{id}/status-account). */
  abstract setAccountStatus(id: string, active: boolean): Observable<void>;
}

export const USUARIOS_DS = new InjectionToken<UsuariosDataSource>('USUARIOS_DS');
