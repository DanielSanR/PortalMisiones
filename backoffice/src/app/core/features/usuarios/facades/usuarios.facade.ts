import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, distinctUntilChanged, forkJoin, map, of, tap } from 'rxjs';
import { AuthTokenService } from '@core/services/auth-token.service';
import { UserRole } from '@core/enums/user-role.enum';
import { etiquetaDeOrganismo, hintDeOrganismoPropio, organismoDeSesion } from '@core/utils/session.utils';
import { UsuariosRepository } from '../repositories/usuarios.repository';
import {
  AsignacionRolFormValue, SesionUsuariosVM, UsuarioFormData, UsuarioFormValue, UsuarioOrganismoFijo, UsuarioVM,
} from '../models/usuario.vm';
import { OrganismosRepository } from '@features/organismos';
import { RolesRepository } from '@features/roles';

/**
 * Facade de Usuarios: estado de la lista + orquestación del formulario. Expone Observables
 * (consumir con `async` pipe; NO usar signals). Depende sólo de repositorios (nunca de otros
 * facades ni de servicios). La coordinación con organismos es vía su Repository (patrón sancionado).
 */
@Injectable({ providedIn: 'root' })
export class UsuariosFacade {
  private readonly _usuarios$ = new BehaviorSubject<UsuarioVM[]>([]);
  readonly usuarios$ = this._usuarios$.asObservable();

  /**
   * Quién opera la pantalla, derivado de la sesión, para que el componente no inyecte `AuthTokenService`
   * (infraestructura de sesión, no `facade → facade`). Emite al suscribirse y cuando cambia alguno de sus
   * datos (otro usuario, otro rol).
   */
  readonly sesion$: Observable<SesionUsuariosVM>;

  constructor(
    private usuarios: UsuariosRepository,
    private organismos: OrganismosRepository,
    private roles: RolesRepository,
    private auth: AuthTokenService,
  ) {
    this.sesion$ = auth.getCurrentUser$().pipe(
      map((usuario): SesionUsuariosVM => ({
        usuarioId: usuario?.id ?? null,
        email: usuario?.email ?? null,
        esSuperAdmin: usuario?.role === UserRole.SUPERADMIN,
        rol: usuario?.role ?? null,
        organismoId: organismoDeSesion(usuario)?.id ?? null,
      })),
      distinctUntilChanged((a, b) =>
        a.usuarioId === b.usuarioId && a.email === b.email
        && a.esSuperAdmin === b.esSuperAdmin && a.rol === b.rol && a.organismoId === b.organismoId),
    );
  }

  /**
   * ¿Qué se puede ofrecer en la fila? Lo decide la fuente de datos, sin que la pantalla sepa si es mock
   * o real. Con el backend real: acciones de cuenta sí; edición no (no hay endpoint) y borrado
   * definitivo no hasta G-13.
   */
  get accionesDeCuentaDisponibles(): boolean {
    return this.usuarios.soportaAccionesDeCuenta;
  }

  get edicionDisponible(): boolean {
    return this.usuarios.soportaEdicion;
  }

  get borradoDefinitivoDisponible(): boolean {
    return this.usuarios.soportaBorradoDefinitivo;
  }

  /** Carga la lista y la publica en el stream de estado. */
  loadUsuarios(): Observable<UsuarioVM[]> {
    return this.usuarios.list().pipe(tap((list) => this._usuarios$.next(list)));
  }

  /**
   * Resuelve en una sola llamada lo que necesita el formulario (organismos + roles + usuario en edición).
   * Solo lo consumen las rutas usuarios/nuevo y usuarios/editar, que exigen un rol admin
   * (`/api/role/allowed`) y, para el organismo, `READ_ORGANISM` o un organismo propio en la sesión — ver
   * `PERMISSION_PREREQUISITES` / `EDITAR_USUARIO_ACCESS` —, así que no hace falta degradar nada.
   *
   * Excepción documentada de sesión (igual que `AdopcionesFacade`/`EtiquetasFacade`): con una sesión de
   * organismo NO se pide `/api/organism` (ese rol puede no tener `READ_ORGANISM` y el 403 abriría el
   * diálogo global); la única opción se arma con el organismo que trae `/api/auth/me`.
   */
  getFormData(id: string | null): Observable<UsuarioFormData> {
    const organismoFijo = this.organismoFijo();
    return forkJoin({
      organismos: organismoFijo
        ? of([{ id: organismoFijo.id, nombre: organismoFijo.nombre }])
        : this.organismos.getOptions(),
      rolesAllowed: this.roles.listAllowed(),
      usuario: id ? this.usuarios.getById(id) : of(null),
    }).pipe(map((datos) => ({ ...datos, organismoFijo })));
  }

  /** Organismo de la sesión como única opción del form, o `null` si la sesión no está atada a uno. */
  private organismoFijo(): UsuarioOrganismoFijo | null {
    const organismo = this.auth.getUserOrganismo();
    if (!organismo) return null;
    return {
      id: organismo.id,
      nombre: etiquetaDeOrganismo(organismo),
      motivo: `${hintDeOrganismoPropio(organismo)}: los usuarios que crees quedan en ese organismo.`,
    };
  }

  create(form: UsuarioFormValue): Observable<UsuarioVM> {
    return this.usuarios.create(form);
  }

  update(id: string, form: UsuarioFormValue): Observable<UsuarioVM> {
    return this.usuarios.update(id, form);
  }

  /**
   * Asigna un rol a un usuario existente. Todavía sin pantalla: el backend no permite cerrar la asignación
   * vigente, así que con un rol en curso responde `4081`. En la fila solo se refleja el rol que la fuente
   * informa como vigente; el resto de la fila se conserva (la respuesta real no trae nombre ni organismo).
   */
  asignarRol(id: string, form: AsignacionRolFormValue): Observable<UsuarioVM> {
    return this.usuarios.asignarRol(id, form).pipe(
      tap((actualizado) =>
        this._usuarios$.next(this._usuarios$.value.map((u) => (u.id === id ? { ...u, rol: actualizado.rol ?? u.rol } : u)))
      )
    );
  }

  /**
   * Deja la cuenta en el estado pedido (no la invierte: con la lista desactualizada o dos admins a la vez,
   * "Desactivar" nunca termina activando) y lo refleja en la fila.
   */
  setAccountStatus(id: string, active: boolean): Observable<void> {
    return this.usuarios.setAccountStatus(id, active).pipe(
      tap(() =>
        this._usuarios$.next(this._usuarios$.value.map((u) => (u.id === id ? { ...u, activo: active } : u)))
      )
    );
  }

  changePassword(id: string, newPassword: string): Observable<void> {
    return this.usuarios.changePassword(id, newPassword);
  }

  /** Cambia el email y lo refleja en la fila (en minúsculas, como lo persiste el backend). */
  changeEmail(id: string, newEmail: string): Observable<void> {
    const email = newEmail.trim().toLowerCase();
    return this.usuarios.changeEmail(id, email).pipe(
      tap(() =>
        this._usuarios$.next(this._usuarios$.value.map((u) => (u.id === id ? { ...u, email } : u)))
      )
    );
  }

  /** Borrado físico: saca la fila del stream al confirmarse. */
  deleteDefinitive(id: string): Observable<void> {
    return this.usuarios.deleteDefinitive(id).pipe(
      tap(() => this._usuarios$.next(this._usuarios$.value.filter((u) => u.id !== id)))
    );
  }
}
