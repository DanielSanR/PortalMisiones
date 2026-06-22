import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, forkJoin, of, tap } from 'rxjs';
import { UsuariosRepository } from '../repositories/usuarios.repository';
import { UsuarioFormData, UsuarioFormValue, UsuarioVM } from '../models/usuario.vm';
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

  constructor(
    private usuarios: UsuariosRepository,
    private organismos: OrganismosRepository,
    private roles: RolesRepository
  ) {}

  /** Carga la lista y la publica en el stream de estado. */
  loadUsuarios(): Observable<UsuarioVM[]> {
    return this.usuarios.list().pipe(tap((list) => this._usuarios$.next(list)));
  }

  /** Resuelve en una sola llamada todo lo que necesita el formulario (organismos + usuario en edición). */
  getFormData(id: string | null): Observable<UsuarioFormData> {
    return forkJoin({
      organismos: this.organismos.getOptions(),
      rolesAllowed: this.roles.listAllowed(),
      usuario: id ? this.usuarios.getById(id) : of(null),
    });
  }

  create(form: UsuarioFormValue): Observable<UsuarioVM> {
    return this.usuarios.create(form);
  }

  update(id: string, form: UsuarioFormValue): Observable<UsuarioVM> {
    return this.usuarios.update(id, form);
  }

  /** Cambia el estado y refleja el cambio en el stream de la lista. */
  toggleActive(id: string): Observable<UsuarioVM> {
    return this.usuarios.toggleActive(id).pipe(
      tap((updated) =>
        this._usuarios$.next(this._usuarios$.value.map((u) => (u.id === id ? updated : u)))
      )
    );
  }

  /** Activa/desactiva la cuenta (REAL: status-account). */
  setAccountStatus(id: string, active: boolean): Observable<void> {
    return this.usuarios.setAccountStatus(id, active);
  }
}
