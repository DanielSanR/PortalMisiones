import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, firstValueFrom, of } from 'rxjs';
import { AuthTokenService } from '@core/services/auth-token.service';
import { AdopcionesRepository } from '@features/adopciones';
import { PlantillasRepository } from '@features/plantillas';
import { OrganismosRepository } from '@features/organismos';
import { LocalidadVM, LocalidadesRepository } from '@features/localidades';
import { FichasLocalesRepository } from '../repositories/fichas-locales.repository';
import { FichaLocal } from '../models/ficha-local.vm';
import { FichasLocalesFacade } from './fichas-locales.facade';

const LOCALIDADES: LocalidadVM[] = [
  { id: 'loc-posadas', nombre: 'Posadas', departamentoId: 'd-1', departamentoNombre: 'Capital' },
  { id: 'loc-garupa', nombre: 'Garupá', departamentoId: 'd-1', departamentoNombre: 'Capital' },
];

/** Ficha con la forma completa (mock / backend con G-1). */
function ficha(id: string, adopcionId: string, localidadId: string, activa = true): FichaLocal {
  return {
    id, slug: `slug-${id}`, estado: 'BORRADOR', activa, version: 1,
    adopcionId, localidadId, url: null, requisitos: 'DNI', costos: null, contenidoCompleto: true,
    plantillaId: null, plantillaTitulo: null, organismoId: null, organismoNombre: null, localidadNombre: null,
  };
}

/** Ficha con el response mínimo del backend de hoy (G-1): sin adopción ni localidad. */
function fichaMinima(id: string): FichaLocal {
  return {
    ...ficha(id, '', ''), adopcionId: null, localidadId: null, requisitos: null, contenidoCompleto: false,
  };
}

function facadeCon(lista: FichaLocal[]): FichasLocalesFacade {
  const auth = {
    getCurrentUser$: () => new BehaviorSubject({ id: 'u-1' }).asObservable(),
    // Sin permisos de catálogos: el facade no pide adopciones, plantillas ni organismos.
    can: () => false,
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: FichasLocalesRepository, useValue: { list: () => of(lista) } },
      { provide: AdopcionesRepository, useValue: {} },
      { provide: PlantillasRepository, useValue: {} },
      { provide: OrganismosRepository, useValue: {} },
      { provide: LocalidadesRepository, useValue: { getLocalidades: () => of(LOCALIDADES) } },
      { provide: AuthTokenService, useValue: auth },
    ],
  });
  return TestBed.inject(FichasLocalesFacade);
}

describe('FichasLocalesFacade · fichas de una adopción (G-1)', () => {
  it('con la forma completa filtra por adopción y resuelve la localidad', async () => {
    const facade = facadeCon([ficha('f-1', 'op-1', 'loc-posadas'), ficha('f-2', 'op-2', 'loc-garupa')]);
    const resultado = await firstValueFrom(facade.getDeAdopcion('op-1'));
    expect(resultado.disponible).toBeTrue();
    expect(resultado.fichas.map((f) => f.id)).toEqual(['f-1']);
    expect(resultado.fichas[0].localidadNombre).toBe('Posadas');
  });

  it('con la forma completa, una adopción sin fichas es un vacío real', async () => {
    const resultado = await firstValueFrom(facadeCon([ficha('f-1', 'op-1', 'loc-posadas')]).getDeAdopcion('op-9'));
    expect(resultado).toEqual({ disponible: true, fichas: [] });
  });

  it('con el response mínimo no afirma que no haya fichas: no disponible', async () => {
    const resultado = await firstValueFrom(facadeCon([fichaMinima('f-1'), fichaMinima('f-2')]).getDeAdopcion('op-1'));
    expect(resultado).toEqual({ disponible: false, fichas: [] });
  });

  it('sin ninguna ficha en el alcance, el vacío es real aunque la fuente sea mínima', async () => {
    const resultado = await firstValueFrom(facadeCon([]).getDeAdopcion('op-1'));
    expect(resultado.disponible).toBeTrue();
  });
});

describe('FichasLocalesFacade · datos del form de alta (duplicados de localidad)', () => {
  it('con la forma completa marca las localidades con ficha activa de la adopción', async () => {
    const facade = facadeCon([
      ficha('f-1', 'op-1', 'loc-posadas'),
      ficha('f-2', 'op-1', 'loc-garupa', false),
      ficha('f-3', 'op-2', 'loc-garupa'),
    ]);
    const datos = await firstValueFrom(facade.getFormData(null, 'op-1'));
    expect(datos.ocupadas.localidadesVerificables).toBeTrue();
    expect(datos.ocupadas.localidadIds).toEqual(['loc-posadas']);
  });

  it('con el response mínimo avisa que no se puede validar (no las da por libres)', async () => {
    const datos = await firstValueFrom(facadeCon([fichaMinima('f-1')]).getFormData(null, 'op-1'));
    expect(datos.ocupadas.localidadesVerificables).toBeFalse();
    expect(datos.ocupadas.localidadIds).toEqual([]);
    // Los slugs sí vienen en el response mínimo: se siguen validando.
    expect(datos.ocupadas.slugs).toEqual(['slug-f-1']);
  });
});
