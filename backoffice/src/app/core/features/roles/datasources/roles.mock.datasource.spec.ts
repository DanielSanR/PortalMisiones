import { firstValueFrom } from 'rxjs';
import { AuthTokenService } from '@core/services/auth-token.service';
import { UserRole } from '@core/enums/user-role.enum';
import { RolesMockDataSource } from './roles.mock.datasource';

function dsCon(roles: UserRole[]): RolesMockDataSource {
  return new RolesMockDataSource({ getUserRoles: () => roles } as AuthTokenService);
}

async function codigosAsignables(roles: UserRole[]): Promise<string[]> {
  return (await firstValueFrom(dsCon(roles).listAllowed())).map((r) => r.codigo);
}

describe('RolesMockDataSource', () => {
  it('MANAGER es un rol global, como en el backend', async () => {
    const manager = (await firstValueFrom(dsCon([UserRole.SUPERADMIN]).list())).find((r) => r.codigo === 'MANAGER');
    expect(manager?.scopeTipo).toBe('global');
  });

  it('un rol que no existe falla como el backend: 404 con código 4059', async () => {
    const err = await firstValueFrom(dsCon([UserRole.SUPERADMIN]).getById('no-existe'))
      .then(() => null, (e: unknown) => e as { status?: number; error?: { code?: number } });

    expect(err?.status).toBe(404);
    expect(err?.error?.code).toBe(4059);
  });

  it('listAllowed: SUPERADMIN recibe todos los roles', async () => {
    expect(await codigosAsignables([UserRole.SUPERADMIN]))
      .toEqual(['SUPERADMIN', 'ADMIN_BACKOFFICE', 'ADMIN_ORGANIZATION', 'AGENT', 'MANAGER', 'USER']);
  });

  it('listAllowed: ADMIN_BACKOFFICE recibe los asignables por backoffice', async () => {
    expect(await codigosAsignables([UserRole.ADMIN_BACKOFFICE])).toEqual(['ADMIN_ORGANIZATION', 'AGENT', 'USER']);
  });

  it('listAllowed: ADMIN_ORGANIZATION recibe los asignables por el admin de organismo', async () => {
    expect(await codigosAsignables([UserRole.ADMIN_ORGANIZATION])).toEqual(['ADMIN_ORGANIZATION', 'AGENT', 'MANAGER']);
  });

  it('delete es una baja lógica: el rol queda desactivado y se sigue listando', async () => {
    const ds = dsCon([UserRole.SUPERADMIN]);
    await firstValueFrom(ds.delete('rol-4'));
    const agente = (await firstValueFrom(ds.list())).find((r) => r.id === 'rol-4');
    expect(agente?.activo).toBeFalse();
    await expectAsync(firstValueFrom(ds.delete('no-existe'))).toBeRejected();
  });

  it('activate reactiva un rol dado de baja como el PUT real: reemplaza el rol con lo que llega, permisos incluidos', async () => {
    const ds = dsCon([UserRole.SUPERADMIN]);
    await firstValueFrom(ds.delete('rol-4'));
    const inactivo = (await firstValueFrom(ds.list())).find((r) => r.id === 'rol-4')!;
    const permiso = { id: 'p-1', codigo: 'READ_USER', descripcion: 'Ver usuarios' };

    const activado = await firstValueFrom(ds.activate({ ...inactivo, permisos: [permiso] }));

    expect(activado.activo).toBeTrue();
    const enLista = (await firstValueFrom(ds.list())).find((r) => r.id === 'rol-4');
    expect(enLista?.activo).toBeTrue();
    expect(enLista?.codigo).toBe('AGENT');
    expect(enLista?.permisos).toEqual([permiso]);
  });

  it('getById + activate (lo que hace el facade) conserva lo que otro administrador cambió después de listar', async () => {
    const ds = dsCon([UserRole.SUPERADMIN]);
    await firstValueFrom(ds.delete('rol-4'));
    const filaVieja = (await firstValueFrom(ds.list())).find((r) => r.id === 'rol-4')!;
    // Otro administrador edita el rol inactivo mientras la lista sigue abierta.
    await firstValueFrom(ds.update('rol-4', {
      codigo: 'AGENT', descripcion: 'Operador (revisado)', scopeTipo: 'organismo', asignablePorOrgAdmin: true,
      asignablePorBackoffice: true, active: false, permissionsIds: [],
    }));

    await firstValueFrom(ds.activate(await firstValueFrom(ds.getById('rol-4'))));

    const enLista = (await firstValueFrom(ds.list())).find((r) => r.id === 'rol-4')!;
    expect(enLista.activo).toBeTrue();
    expect(enLista.descripcion).toBe('Operador (revisado)');
    expect(filaVieja.descripcion).not.toBe('Operador (revisado)');
  });

  it('activate de un rol que no existe falla como el backend: 404 con código 4059', async () => {
    const ds = dsCon([UserRole.SUPERADMIN]);
    const inexistente = { ...(await firstValueFrom(ds.list()))[0], id: 'no-existe' };

    const err = await firstValueFrom(ds.activate(inexistente))
      .then(() => null, (e: unknown) => e as { status?: number; error?: { code?: number } });

    expect(err?.status).toBe(404);
    expect(err?.error?.code).toBe(4059);
  });
});
