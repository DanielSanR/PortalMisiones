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
});
