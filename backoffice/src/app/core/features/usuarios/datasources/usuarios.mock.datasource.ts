import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { UsuariosDataSource } from './usuarios.datasource';
import { mockUsuarioToVM } from '../mappers/usuarios.mapper';
import { UsuarioFormValue, UsuarioVM } from '../models/usuario.vm';
import { UsuarioService } from '@core/services/usuario.service';
import { UserRole } from '@core/enums/user-role.enum';

/** Implementación mock: envuelve el `UsuarioService` (mockApiInterceptor) y mapea a VM. */
@Injectable()
export class UsuariosMockDataSource extends UsuariosDataSource {
  constructor(private usuarios: UsuarioService) {
    super();
  }

  list(): Observable<UsuarioVM[]> {
    return this.usuarios.getAll().pipe(map((res) => res.data.map(mockUsuarioToVM)));
  }

  getById(id: string): Observable<UsuarioVM> {
    return this.usuarios.getById(id).pipe(map(mockUsuarioToVM));
  }

  create(form: UsuarioFormValue): Observable<UsuarioVM> {
    return this.usuarios
      .create({
        nombre: form.nombre,
        apellido: form.apellido,
        email: form.email,
        password: form.password,
        rol: form.rol as UserRole,
        organismoId: form.organismoId ?? undefined,
      })
      .pipe(map(mockUsuarioToVM));
  }

  update(id: string, form: UsuarioFormValue): Observable<UsuarioVM> {
    return this.usuarios
      .update(id, {
        nombre: form.nombre,
        apellido: form.apellido,
        rol: form.rol as UserRole,
        organismoId: form.organismoId ?? undefined,
      })
      .pipe(map(mockUsuarioToVM));
  }

  toggleActive(id: string): Observable<UsuarioVM> {
    return this.usuarios.toggleActive(id).pipe(map(mockUsuarioToVM));
  }

  setAccountStatus(id: string, _active: boolean): Observable<void> {
    return this.usuarios.toggleActive(id).pipe(map(() => void 0));
  }

  // La contraseña no vive en el mock: basta con validar que el usuario exista.
  changePassword(id: string, _newPassword: string): Observable<void> {
    return this.usuarios.getById(id).pipe(map(() => void 0));
  }

  changeEmail(id: string, newEmail: string): Observable<void> {
    return this.usuarios.changeEmail(id, newEmail.toLowerCase()).pipe(map(() => void 0));
  }

  deleteDefinitive(id: string): Observable<void> {
    return this.usuarios.delete(id);
  }
}
