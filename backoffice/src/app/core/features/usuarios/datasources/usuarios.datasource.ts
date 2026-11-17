import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { AsignacionRolFormValue, UsuarioFormValue, UsuarioVM } from '../models/usuario.vm';

/**
 * Fuente de datos de usuarios. Interface source-agnostic: cada implementación (HTTP o mock)
 * adapta su origen al ViewModel. La elección la resuelve el token vía `provideDataSource`.
 */
export abstract class UsuariosDataSource {
  /**
   * Capacidades de la fuente: qué operaciones puede ejecutar de verdad. Si una es `false`, la UI no la
   * ofrece y llamarla falla con un error explícito (nunca un éxito falso).
   * - `soportaAccionesDeCuenta`: activar/desactivar, `changePassword`, `changeEmail`.
   * - `soportaEdicion`: `update` (nombre, apellido, rol, organismo).
   * - `soportaBorradoDefinitivo`: `deleteDefinitive`.
   */
  abstract readonly soportaAccionesDeCuenta: boolean;
  abstract readonly soportaEdicion: boolean;
  abstract readonly soportaBorradoDefinitivo: boolean;
  abstract list(): Observable<UsuarioVM[]>;
  abstract getById(id: string): Observable<UsuarioVM>;
  abstract create(form: UsuarioFormValue): Observable<UsuarioVM>;
  abstract update(id: string, form: UsuarioFormValue): Observable<UsuarioVM>;
  /**
   * REAL: POST /api/user/{id}/role-assignments (`CREATE_USER`). Agrega una asignación de rol; no cierra la
   * vigente (el backend todavía no lo permite). Errores de negocio: `4019` usuario inexistente, `4002`
   * usuario inactivo, `4018` rol inexistente, `4058` organismo inexistente, `4029` rol y organismo que no
   * se corresponden (o sin permiso), `4011` fin no posterior al inicio, `4081` período superpuesto.
   */
  abstract asignarRol(id: string, form: AsignacionRolFormValue): Observable<UsuarioVM>;
  /** Activa/desactiva la cuenta (REAL: PUT /api/user/{id}/status-account). */
  abstract setAccountStatus(id: string, active: boolean): Observable<void>;
  /** REAL: PUT /api/user/{id}/change-password (`UPDATE_USER`). Requiere `soportaAccionesDeCuenta`. */
  abstract changePassword(id: string, newPassword: string): Observable<void>;
  /** REAL: PATCH /api/user/{id}/change-email (`UPDATE_USER`). En minúsculas. Requiere `soportaAccionesDeCuenta`. */
  abstract changeEmail(id: string, newEmail: string): Observable<void>;
  /** REAL: DELETE /api/user/{id}/admin (`DELETE_USER`). Borrado físico, irreversible. Requiere `soportaBorradoDefinitivo`. */
  abstract deleteDefinitive(id: string): Observable<void>;
}

export const USUARIOS_DS = new InjectionToken<UsuariosDataSource>('USUARIOS_DS');
