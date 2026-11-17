import { Injectable } from '@angular/core';
import { Observable, catchError, map, of, switchMap } from 'rxjs';
import { UsuariosDataSource } from './usuarios.datasource';
import { mockUsuarioToVM } from '../mappers/usuarios.mapper';
import { AsignacionRolFormValue, UsuarioFormValue, UsuarioVM } from '../models/usuario.vm';
import { UsuarioService } from '@core/services/usuario.service';
import { UserRole } from '@core/enums/user-role.enum';
import { API_CODES } from '@core/constants/api-codes.constants';
import { errorDeNegocio } from '@core/mocks/mock-errors';
import { Usuario } from '@core/models/usuario.model';
import { RoleScopeType } from '@core/models/role.model';
import { hoy } from '@core/utils/fecha.utils';

/**
 * Roles que el mock sabe asignar, por el id del seed de roles (`rol-N`) con su scope real (`V2.17`).
 * Copia mínima a propósito: este datasource no puede leer el de roles (prohibido `datasource → datasource`).
 */
const ROLES_ASIGNABLES: Record<string, { codigo: UserRole; scope: RoleScopeType }> = {
  'rol-1': { codigo: UserRole.SUPERADMIN, scope: 'global' },
  'rol-2': { codigo: UserRole.ADMIN_BACKOFFICE, scope: 'global' },
  'rol-3': { codigo: UserRole.ADMIN_ORGANIZATION, scope: 'organismo' },
  'rol-4': { codigo: UserRole.AGENT, scope: 'organismo' },
  'rol-5': { codigo: UserRole.MANAGER, scope: 'global' },
  'rol-6': { codigo: UserRole.USER, scope: 'global' },
};

/**
 * Textos reales de `messages.properties`. Los de `4002` y `4018` no describen lo que pasó en este flujo
 * (el backend reusa los códigos): se dejan tal cual para que la pantalla tenga que traducirlos.
 */
const TEXTOS_ASIGNACION = {
  [API_CODES.USER_NOT_REGISTERED]: 'El usuario no está registrado. Por favor regístrese.',
  [API_CODES.USER_ALREADY_REGISTERED]: 'El usuario ya está registrado. Por favor, intente con otro email/cuit.',
  [API_CODES.PASSWORD_MISMATCH_OR_ROLE]: 'Las contraseñas no coinciden.',
  [API_CODES.NO_PERMISSION]: 'El usuario no tiene permisos para realizar esta acción.',
  [API_CODES.INVALID_ELEMENT]: 'Verifique el elemento enviado para realizar la búsqueda, inserción o eliminación.',
  [API_CODES.ROLE_ASSIGNMENT_OVERLAP]: 'El usuario ya tiene una asignación de rol vigente que se superpone con el período solicitado.',
} as const;

/** Asignación de rol en memoria. Fechas de día completo `YYYY-MM-DD`: se comparan como texto. */
interface AsignacionMock {
  rol: UserRole;
  organismoId: string | null;
  desde: string;
  /** `null` = sin fin. */
  hasta: string | null;
}

/** Hoy en hora local como `YYYY-MM-DD` (el `LocalDate.now()` del backend). */
function hoyISO(): string {
  const d = hoy();
  const dosDigitos = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dosDigitos(d.getMonth() + 1)}-${dosDigitos(d.getDate())}`;
}

/** Implementación mock: envuelve el `UsuarioService` (mockApiInterceptor) y mapea a VM. */
@Injectable()
export class UsuariosMockDataSource extends UsuariosDataSource {
  /** El mock simula todo (dev/QA). */
  readonly soportaAccionesDeCuenta = true;
  readonly soportaEdicion = true;
  readonly soportaBorradoDefinitivo = true;

  /** Asignaciones de rol por usuario. Se siembran al primer uso con el rol que el usuario ya tiene. */
  private readonly asignaciones = new Map<string, AsignacionMock[]>();

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

  /**
   * Mismas reglas y mismo orden que `UserService.assignRole`: usuario (`4019`), cuenta activa (`4002`),
   * rol (`4018`), scope contra organismo (`4029`), período (`4011`) y superposición (`4081`). Como todo
   * usuario del mock ya tiene un rol sin fin, en la práctica responde `4081` salvo que el período pedido
   * termine antes de su alta: igual que el real, que todavía no permite cerrar la asignación vigente.
   * No valida que el organismo exista (`4058`) ni qué puede asignar quien opera: no conoce otros datasources.
   */
  asignarRol(id: string, form: AsignacionRolFormValue): Observable<UsuarioVM> {
    return this.usuarios.getById(id).pipe(
      catchError(() => this.errorDeAsignacion(API_CODES.USER_NOT_REGISTERED)),
      switchMap((usuario) => {
        if (!usuario.activo) return this.errorDeAsignacion(API_CODES.USER_ALREADY_REGISTERED);

        const rol = ROLES_ASIGNABLES[form.rolId];
        if (!rol) return this.errorDeAsignacion(API_CODES.PASSWORD_MISMATCH_OR_ROLE);

        const organismoId = form.organismoId || null;
        // Un rol global no lleva organismo; uno de organismo lo exige.
        if ((rol.scope === 'global') !== (organismoId === null)) return this.errorDeAsignacion(API_CODES.NO_PERMISSION);

        const desde = form.vigenteDesde || hoyISO();
        const hasta = form.vigenteHasta || null;
        if (hasta !== null && hasta <= desde) return this.errorDeAsignacion(API_CODES.INVALID_ELEMENT);

        // Misma consulta que `findOverlappingAssignments` (bordes inclusive).
        const actuales = this.asignacionesDe(usuario);
        const seSuperpone = actuales.some((a) => (hasta === null || a.desde <= hasta) && (a.hasta === null || a.hasta >= desde));
        if (seSuperpone) return this.errorDeAsignacion(API_CODES.ROLE_ASSIGNMENT_OVERLAP);

        this.asignaciones.set(usuario.id, [...actuales, { rol: rol.codigo, organismoId, desde, hasta }]);
        // El rol vigente no cambia: la asignación con la que nació el usuario no tiene fin y cubre hoy,
        // así que la nueva (que no se superpone) solo puede ser de un período anterior.
        return of(mockUsuarioToVM(usuario));
      }),
    );
  }

  /** Idempotente, como el backend: solo invierte si el estado actual no es el pedido. */
  setAccountStatus(id: string, active: boolean): Observable<void> {
    return this.usuarios.getById(id).pipe(
      switchMap((u) => (u.activo === active ? of(u) : this.usuarios.toggleActive(id))),
      map(() => void 0),
    );
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

  /** El rol con el que el usuario figura en el mock es su asignación vigente: desde su alta y sin fin. */
  private asignacionesDe(usuario: Usuario): AsignacionMock[] {
    return this.asignaciones.get(usuario.id)
      ?? [{ rol: usuario.rol, organismoId: usuario.organismoId, desde: usuario.createdAt.slice(0, 10), hasta: null }];
  }

  private errorDeAsignacion(code: keyof typeof TEXTOS_ASIGNACION): Observable<never> {
    return errorDeNegocio(code, TEXTOS_ASIGNACION[code]);
  }
}
