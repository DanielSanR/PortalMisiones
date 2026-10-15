import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { UsuarioService } from '@core/services/usuario.service';
import { OrganismosRepository } from '@features/organismos';
import { RolesRepository } from '@features/roles';
import { USUARIOS_DS, UsuariosDataSource } from '../datasources/usuarios.datasource';
import { UsuariosHttpDataSource } from '../datasources/usuarios.http.datasource';
import { UsuariosMockDataSource } from '../datasources/usuarios.mock.datasource';
import { UsuariosFacade } from './usuarios.facade';

function facadeCon(ds: UsuariosDataSource): UsuariosFacade {
  TestBed.configureTestingModule({
    providers: [
      { provide: USUARIOS_DS, useValue: ds },
      { provide: OrganismosRepository, useValue: {} },
      { provide: RolesRepository, useValue: {} },
    ],
  });
  return TestBed.inject(UsuariosFacade);
}

describe('UsuariosFacade · acciones de cuenta (BO-17)', () => {
  const http = jasmine.createSpyObj<HttpClient>('HttpClient', ['get', 'post', 'put', 'patch', 'delete']);
  const servicioMock = jasmine.createSpyObj<UsuarioService>('UsuarioService', ['getById', 'changeEmail', 'delete']);

  it('con la fuente real (listado mock) no se ofrecen', () => {
    expect(facadeCon(new UsuariosHttpDataSource(http, servicioMock)).accionesDeCuentaDisponibles).toBeFalse();
  });

  it('con el mock se ofrecen (dev/QA)', () => {
    expect(facadeCon(new UsuariosMockDataSource(servicioMock)).accionesDeCuentaDisponibles).toBeTrue();
  });

  it('la fuente real falla explícitamente si igual se llaman, sin tocar el mock ni el backend', async () => {
    const facade = facadeCon(new UsuariosHttpDataSource(http, servicioMock));
    await expectAsync(firstValueFrom(facade.changePassword('u-1', 'Nueva123!'))).toBeRejectedWithError(/BO-17/);
    await expectAsync(firstValueFrom(facade.changeEmail('u-1', 'a@b.com'))).toBeRejectedWithError(/BO-17/);
    await expectAsync(firstValueFrom(facade.deleteDefinitive('u-1'))).toBeRejectedWithError(/BO-17/);
    expect(servicioMock.getById).not.toHaveBeenCalled();
    expect(servicioMock.changeEmail).not.toHaveBeenCalled();
    expect(servicioMock.delete).not.toHaveBeenCalled();
    expect(http.put).not.toHaveBeenCalled();
    expect(http.patch).not.toHaveBeenCalled();
    expect(http.delete).not.toHaveBeenCalled();
  });
});
