import { firstValueFrom, of, throwError } from 'rxjs';
import { UsuarioService } from '@core/services/usuario.service';
import { Usuario } from '@core/models/usuario.model';
import { UserRole } from '@core/enums/user-role.enum';
import { AsignacionRolFormValue } from '../models/usuario.vm';
import { UsuariosMockDataSource } from './usuarios.mock.datasource';

/** Agente del organismo `org-1`, dado de alta el 2026-02-01: su rol rige desde ese día y sin fin. */
const AGENTE: Usuario = {
  id: 'usr-4', email: 'agente@misiones.gob.ar', nombre: 'Laura', apellido: 'Martínez', rol: UserRole.AGENT,
  organismoId: 'org-1', localidadId: null, activo: true, createdAt: '2026-02-01T00:00:00Z',
};

/** Un período anterior al alta del usuario: lo único que no se superpone con su rol vigente. */
const ANTES_DEL_ALTA: AsignacionRolFormValue = {
  rolId: 'rol-4', organismoId: 'org-1', vigenteDesde: '2025-01-01', vigenteHasta: '2025-06-30',
};

/** Código de negocio de un error del mock (`{ error: { code } }`). */
async function codigoDeError(promesa: Promise<unknown>): Promise<number | null> {
  try {
    await promesa;
    return null;
  } catch (err) {
    return (err as { error?: { code?: number } }).error?.code ?? null;
  }
}

describe('UsuariosMockDataSource · asignarRol', () => {
  let servicio: jasmine.SpyObj<UsuarioService>;
  let ds: UsuariosMockDataSource;

  const asignar = (form: Partial<AsignacionRolFormValue>, id = AGENTE.id): Promise<unknown> =>
    firstValueFrom(ds.asignarRol(id, { ...ANTES_DEL_ALTA, ...form }));

  beforeEach(() => {
    servicio = jasmine.createSpyObj<UsuarioService>('UsuarioService', ['getById']);
    servicio.getById.and.returnValue(of(AGENTE));
    ds = new UsuariosMockDataSource(servicio);
  });

  it('un usuario con rol vigente no admite otro que se superponga → 4081', async () => {
    // Sin fechas: desde hoy y sin fin.
    expect(await codigoDeError(asignar({ vigenteDesde: null, vigenteHasta: null }))).toBe(4081);
    expect(await codigoDeError(asignar({ vigenteDesde: '2025-01-01', vigenteHasta: null }))).toBe(4081);
    // Bordes inclusive: terminar el mismo día en que empieza la vigente también se superpone.
    expect(await codigoDeError(asignar({ vigenteHasta: '2026-02-01' }))).toBe(4081);
  });

  it('un período que no se superpone se asigna y el rol vigente no cambia', async () => {
    const usuario = await firstValueFrom(ds.asignarRol(AGENTE.id, ANTES_DEL_ALTA));
    expect(usuario.id).toBe(AGENTE.id);
    expect(usuario.rol).toBe(UserRole.AGENT);
    // La asignación quedó registrada: repetir el período ahora se superpone con ella.
    expect(await codigoDeError(asignar({ vigenteDesde: '2025-06-30', vigenteHasta: '2025-12-31' }))).toBe(4081);
    expect(await codigoDeError(asignar({ vigenteDesde: '2025-07-01', vigenteHasta: '2025-12-31' }))).toBeNull();
  });

  it('el fin tiene que ser posterior al inicio → 4011', async () => {
    expect(await codigoDeError(asignar({ vigenteDesde: '2025-03-01', vigenteHasta: '2025-03-01' }))).toBe(4011);
    expect(await codigoDeError(asignar({ vigenteDesde: '2025-03-01', vigenteHasta: '2025-02-01' }))).toBe(4011);
  });

  it('rol global con organismo, o rol de organismo sin organismo → 4029', async () => {
    expect(await codigoDeError(asignar({ rolId: 'rol-5', organismoId: 'org-1' }))).toBe(4029); // MANAGER es global
    expect(await codigoDeError(asignar({ rolId: 'rol-4', organismoId: null }))).toBe(4029);
    expect(await codigoDeError(asignar({ rolId: 'rol-5', organismoId: null }))).toBeNull();
  });

  it('rol inexistente → 4018; usuario inexistente → 4019; usuario inactivo → 4002', async () => {
    expect(await codigoDeError(asignar({ rolId: 'no-existe' }))).toBe(4018);

    servicio.getById.and.returnValue(of({ ...AGENTE, activo: false }));
    expect(await codigoDeError(asignar({}))).toBe(4002);

    servicio.getById.and.returnValue(throwError(() => ({ status: 404, error: { message: 'No encontrado' } })));
    expect(await codigoDeError(asignar({}, 'no-existe'))).toBe(4019);
  });

  it('valida en el orden del backend: el período inválido gana a la superposición', async () => {
    expect(await codigoDeError(asignar({ vigenteDesde: '2026-06-01', vigenteHasta: '2026-05-01' }))).toBe(4011);
  });
});
