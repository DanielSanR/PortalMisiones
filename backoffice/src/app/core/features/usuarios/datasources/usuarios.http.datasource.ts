import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, throwError } from 'rxjs';
import { environment } from '@env/environment';
import { ResponseDTO } from '@core/models/api-response.model';
import { sinDialogoGlobal } from '@core/interceptors/http-error.interceptor';
import { UsuariosDataSource } from './usuarios.datasource';
import { toCreateUserRequest, toUsuarioVM } from '../mappers/usuarios.mapper';
import {
  ChangeEmailRequest, ChangePasswordRequest, StatusAccountRequest, UserResponseDTO,
} from '../models/usuario.dto';
import { UsuarioFormValue, UsuarioVM } from '../models/usuario.vm';

/**
 * DataSource real de usuarios (`/api/user`, backend `dev` @ `b6f505b`):
 *  - `list` → `GET /api/user` (`READ_USER`; AO recibe solo los de su organismo, PPDT-5.2).
 *  - `getById` → `GET /api/user/{id}`. `create` → `POST /api/user`.
 *  - Estado de la cuenta (explícito, nunca un toggle), email y contraseña → endpoints reales por usuario.
 *  - `update` → NO DISPONIBLE: el backend no tiene edición de perfil/rol (`PUT /api/user/{id}` es la baja
 *    lógica). `soportaEdicion = false`, la lista no ofrece "Editar".
 *  - `deleteDefinitive` → NO DISPONIBLE hasta G-13 (hoy siempre 500 por la FK de `user_role_assignments`).
 * ⚠️ G-13: el response trae `role: null` y sin nombre/organismo; el mapper los deja vacíos.
 */
@Injectable()
export class UsuariosHttpDataSource extends UsuariosDataSource {
  readonly soportaAccionesDeCuenta = true;
  readonly soportaEdicion = false;
  readonly soportaBorradoDefinitivo = false;

  private readonly apiUrl = `${environment.apiBaseUrl}/api/user`;

  constructor(private http: HttpClient) {
    super();
  }

  list(): Observable<UsuarioVM[]> {
    return this.http
      .get<ResponseDTO<UserResponseDTO[]>>(this.apiUrl)
      .pipe(map((res) => (res.data ?? []).map(toUsuarioVM)));
  }

  getById(id: string): Observable<UsuarioVM> {
    return this.http
      .get<ResponseDTO<UserResponseDTO>>(this.urlDe(id))
      .pipe(map((res) => toUsuarioVM(res.data)));
  }

  /**
   * REAL: POST /api/user (`CreateUserRequest`, backend `dev` @ `b6f505b`). `form.rol` = UUID del rol.
   * `form.organismoId` viaja como `organizationId`: el backend lo exige si el rol es de scope
   * `organismo` (si falta → 403 `4029`) y, si quien crea es ADMIN_ORGANIZATION, lo pisa con el suyo.
   * Para un rol `global` el form manda `null` y el campo se omite: el backend NO lo rechaza y dejaría
   * la asignación del rol global atada a ese organismo.
   */
  create(form: UsuarioFormValue): Observable<UsuarioVM> {
    const body = toCreateUserRequest(form, form.rol);
    return this.http
      // El form muestra el error inline; se salta el diálogo de error global.
      .post<ResponseDTO<UserResponseDTO>>(this.apiUrl, body, sinDialogoGlobal())
      .pipe(map((res) => toUsuarioVM(res.data)));
  }

  update(_id: string, _form: UsuarioFormValue): Observable<UsuarioVM> {
    return noDisponible('editar el usuario', 'el backend no tiene edición de perfil ni de rol');
  }

  setAccountStatus(id: string, active: boolean): Observable<void> {
    const body: StatusAccountRequest = { accountActive: active };
    return this.http
      .put<unknown>(`${this.urlDe(id)}/status-account`, body, sinDialogoGlobal())
      .pipe(map(() => void 0));
  }

  changePassword(id: string, newPassword: string): Observable<void> {
    const body: ChangePasswordRequest = { newPassword };
    return this.http
      .put<unknown>(`${this.urlDe(id)}/change-password`, body, sinDialogoGlobal())
      .pipe(map(() => void 0));
  }

  changeEmail(id: string, newEmail: string): Observable<void> {
    const body: ChangeEmailRequest = { newEmail };
    return this.http
      .patch<unknown>(`${this.urlDe(id)}/change-email`, body, sinDialogoGlobal())
      .pipe(map(() => void 0));
  }

  deleteDefinitive(_id: string): Observable<void> {
    return noDisponible('eliminar el usuario', 'el backend todavía no permite el borrado definitivo (G-13)');
  }

  private urlDe(id: string): string {
    return `${this.apiUrl}/${encodeURIComponent(id)}`;
  }
}

/** Error explícito (nunca un éxito falso) para una operación que el backend no ofrece. */
function noDisponible(accion: string, motivo: string): Observable<never> {
  return throwError(() => new Error(`No se puede ${accion}: ${motivo}.`));
}
