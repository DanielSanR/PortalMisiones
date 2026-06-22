import { Injectable } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '@env/environment';
import { ResponseDTO } from '@core/models/api-response.model';
import { SKIP_ERROR_INTERCEPTOR } from '@core/interceptors/http-error.interceptor';
import { UsuarioService } from '@core/services/usuario.service';
import { UsuariosDataSource } from './usuarios.datasource';
import { toUsuarioVM, mockUsuarioToVM } from '../mappers/usuarios.mapper';
import { CreateUserRequest, UserResponseDTO } from '../models/usuario.dto';
import { UsuarioFormValue, UsuarioVM } from '../models/usuario.vm';
import { UserRole } from '@core/enums/user-role.enum';

/**
 * DataSource híbrido de usuarios (backend parcial, BACKEND_API_SPEC.md §3 + §7):
 *  - `create` → REAL `POST /api/user` (el form provee el UUID del rol y profileDto).
 *  - `list`/`getById`/`update`/`toggleActive` → MOCK (el backend no expone `GET /api/user`
 *    ni update genérico). Cuando el backend los exponga, se reemplazan por HTTP real.
 */
@Injectable()
export class UsuariosHttpDataSource extends UsuariosDataSource {
  private readonly apiUrl = `${environment.apiBaseUrl}/api/user`;

  constructor(
    private http: HttpClient,
    private usuariosMock: UsuarioService
  ) {
    super();
  }

  /** REAL: POST /api/user. `form.rol` = UUID del rol. organizationId se omite (organismos aún sin API). */
  create(form: UsuarioFormValue): Observable<UsuarioVM> {
    const body: CreateUserRequest = {
      email: form.email,
      password: form.password,
      role: form.rol,
      profileDto: { firstName: form.nombre, lastName: form.apellido },
    };
    return this.http
      .post<ResponseDTO<UserResponseDTO>>(this.apiUrl, body, {
        // El form muestra el error inline; se salta el diálogo de error global.
        context: new HttpContext().set(SKIP_ERROR_INTERCEPTOR, true),
      })
      .pipe(map((res) => toUsuarioVM(res.data)));
  }

  // ── Operaciones aún no expuestas por el backend → delegan al mock ──
  list(): Observable<UsuarioVM[]> {
    return this.usuariosMock.getAll().pipe(map((res) => res.data.map(mockUsuarioToVM)));
  }

  getById(id: string): Observable<UsuarioVM> {
    return this.usuariosMock.getById(id).pipe(map(mockUsuarioToVM));
  }

  update(id: string, form: UsuarioFormValue): Observable<UsuarioVM> {
    return this.usuariosMock
      .update(id, {
        nombre: form.nombre,
        apellido: form.apellido,
        rol: form.rol as UserRole,
        organismoId: form.organismoId ?? undefined,
        localidadId: form.localidadId ?? undefined,
      })
      .pipe(map(mockUsuarioToVM));
  }

  toggleActive(id: string): Observable<UsuarioVM> {
    return this.usuariosMock.toggleActive(id).pipe(map(mockUsuarioToVM));
  }

  /** REAL: PUT /api/user/{id}/status-account. */
  setAccountStatus(id: string, active: boolean): Observable<void> {
    return this.http
      .put<unknown>(
        `${this.apiUrl}/${id}/status-account`,
        { accountActive: active },
        { context: new HttpContext().set(SKIP_ERROR_INTERCEPTOR, true) }
      )
      .pipe(map(() => void 0));
  }
}
