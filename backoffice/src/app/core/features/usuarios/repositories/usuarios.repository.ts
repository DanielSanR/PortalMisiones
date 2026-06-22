import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { USUARIOS_DS, UsuariosDataSource } from '../datasources/usuarios.datasource';
import { UsuarioFormValue, UsuarioVM } from '../models/usuario.vm';

/**
 * Repositorio de usuarios: expone VMs source-agnostic. Inyecta el DataSource vía token
 * (nunca una clase concreta) → respeta la dirección de dependencias y permite swap mock↔real.
 */
@Injectable({ providedIn: 'root' })
export class UsuariosRepository {
  constructor(@Inject(USUARIOS_DS) private ds: UsuariosDataSource) {}

  list(): Observable<UsuarioVM[]> {
    return this.ds.list();
  }

  getById(id: string): Observable<UsuarioVM> {
    return this.ds.getById(id);
  }

  create(form: UsuarioFormValue): Observable<UsuarioVM> {
    return this.ds.create(form);
  }

  update(id: string, form: UsuarioFormValue): Observable<UsuarioVM> {
    return this.ds.update(id, form);
  }

  toggleActive(id: string): Observable<UsuarioVM> {
    return this.ds.toggleActive(id);
  }

  setAccountStatus(id: string, active: boolean): Observable<void> {
    return this.ds.setAccountStatus(id, active);
  }
}
