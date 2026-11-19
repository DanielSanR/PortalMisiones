import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { AuthTokenService } from '@core/services/auth-token.service';
import { PuntosAtencionRepository } from '../repositories/puntos-atencion.repository';
import { PuntosAtencionFiltro } from '../models/punto-atencion.dto';
import { PuntoAtencionVM } from '../models/punto-atencion.vm';
import { PuntosAtencionFacade } from './puntos-atencion.facade';

const punto = (id: string, fichaId: string, nombre: string, activo = true): PuntoAtencionVM => ({
  id, fichaId, nombre, direccion: 'Calle 1', contacto: null, horarios: null, latitud: -27.3, longitud: -55.8, activo,
});

const TODOS = [
  punto('p-1', 'f-1', 'Zeta'),
  punto('p-2', 'f-1', 'Alfa', false),
  punto('p-3', 'f-1', 'Beta'),
  punto('p-4', 'f-2', 'Otra ficha'),
];

describe('PuntosAtencionFacade · lectura por ficha', () => {
  let facade: PuntosAtencionFacade;
  let pedidos: Array<PuntosAtencionFiltro | undefined>;

  beforeEach(() => {
    pedidos = [];
    const repo = {
      fuenteSimulada: false,
      // Como el backend: con filtro por ficha, solo los activos; sin filtro, todos.
      list: (filtro?: PuntosAtencionFiltro) => {
        pedidos.push(filtro);
        return of(filtro?.fichaId ? TODOS.filter((p) => p.fichaId === filtro.fichaId && p.activo) : TODOS);
      },
      desactivar: () => of(undefined),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: PuntosAtencionRepository, useValue: repo },
        { provide: AuthTokenService, useValue: { getCurrentUser$: () => of({ id: 'u-1' }) } },
      ],
    });
    facade = TestBed.inject(PuntosAtencionFacade);
  });

  it('por defecto pide con el filtro de la ficha y devuelve solo sus activos, por nombre', async () => {
    const lista = await firstValueFrom(facade.getDeFicha('f-1'));
    expect(pedidos).toEqual([{ fichaId: 'f-1' }]);
    expect(lista.map((p) => p.nombre)).toEqual(['Beta', 'Zeta']);
  });

  it('aunque la fuente devolviera inactivos o de otra ficha, la lectura por defecto no los muestra', async () => {
    const repo = TestBed.inject(PuntosAtencionRepository) as unknown as { list: () => unknown };
    repo.list = () => of(TODOS);
    const lista = await firstValueFrom(facade.getDeFicha('f-1'));
    expect(lista.map((p) => p.id)).toEqual(['p-3', 'p-1']);
  });

  it('con los inactivos pide el listado completo (sin filtro) y filtra la ficha acá: activos primero', async () => {
    const lista = await firstValueFrom(facade.getDeFicha('f-1', true));
    expect(pedidos).toEqual([undefined]);
    expect(lista.map((p) => p.nombre)).toEqual(['Beta', 'Zeta', 'Alfa']);
    expect(lista[2].activo).toBeFalse();
  });

  it('el listado completo se cachea; un ABM o refrescar() lo invalidan', async () => {
    await firstValueFrom(facade.getDeFicha('f-1', true));
    await firstValueFrom(facade.getDeFicha('f-2', true));
    expect(pedidos.length).toBe(1);

    await firstValueFrom(facade.desactivar('p-1'));
    await firstValueFrom(facade.getDeFicha('f-1', true));
    expect(pedidos.length).toBe(2);

    facade.refrescar();
    await firstValueFrom(facade.getDeFicha('f-1', true));
    expect(pedidos.length).toBe(3);
  });
});
