import { FichaBase, FichaLocal } from '../models/ficha-local.vm';
import { cambioDesdeLaBase, fichasOcupadas, opcionesDeLocalidad, quedoPublicadaEInactiva, trasDesactivar } from './ficha-guardado';

const ficha = (id: string, cambios: Partial<FichaLocal> = {}): FichaLocal => ({
  id, slug: `slug-${id}`, estado: 'BORRADOR', activa: true, version: 1,
  adopcionId: 'ad-1', localidadId: 'loc-1', url: null, requisitos: null, costos: null, ...cambios,
});

describe('fichasOcupadas', () => {
  const TODAS = [
    ficha('f-1', { localidadId: 'loc-1' }),
    ficha('f-2', { localidadId: 'loc-2', activa: false }),
    ficha('f-3', { adopcionId: 'ad-2', localidadId: 'loc-3', slug: 'Otro Trámite' }),
  ];

  it('en alta cuentan todas: localidades de la adopción y slugs de todo el alcance, canonicalizados', () => {
    expect(fichasOcupadas(TODAS, null, 'ad-1')).toEqual({
      localidadIds: ['loc-1', 'loc-2'],
      localidadIdsDesactivadas: ['loc-2'],
      slugs: ['slug-f-1', 'slug-f-2', 'otro-tramite'],
    });
  });

  it('en edición la propia ficha no cuenta', () => {
    const ocupadas = fichasOcupadas(TODAS, 'f-1', 'ad-1');
    expect(ocupadas.localidadIds).toEqual(['loc-2']);
    expect(ocupadas.slugs).toEqual(['slug-f-2', 'otro-tramite']);
  });

  it('una localidad con una ficha activa y otra desactivada no figura como desactivada', () => {
    const todas = [ficha('f-1', { activa: false }), ficha('f-2', { activa: true })];
    const ocupadas = fichasOcupadas(todas, null, 'ad-1');
    expect(ocupadas.localidadIds).toEqual(['loc-1']);
    expect(ocupadas.localidadIdsDesactivadas).toEqual([]);
  });

  it('sin adopción no hay localidades ocupadas, pero los slugs se validan igual', () => {
    const ocupadas = fichasOcupadas(TODAS, null, null);
    expect(ocupadas.localidadIds).toEqual([]);
    expect(ocupadas.localidadIdsDesactivadas).toEqual([]);
    expect(ocupadas.slugs.length).toBe(3);
  });
});

describe('opcionesDeLocalidad', () => {
  it('ordena por nombre sin distinguir tildes ni mayúsculas y deja solo los campos de la opción', () => {
    const localidades = [
      { id: 'l-2', nombre: 'Posadas', departamentoNombre: 'Capital', departamentoId: 'd-1' },
      { id: 'l-3', nombre: 'eldorado', departamentoNombre: 'Eldorado', departamentoId: 'd-2' },
      { id: 'l-1', nombre: 'Oberá', departamentoNombre: 'Oberá', departamentoId: 'd-3' },
    ];
    expect(opcionesDeLocalidad(localidades)).toEqual([
      { id: 'l-3', nombre: 'eldorado', departamentoNombre: 'Eldorado' },
      { id: 'l-1', nombre: 'Oberá', departamentoNombre: 'Oberá' },
      { id: 'l-2', nombre: 'Posadas', departamentoNombre: 'Capital' },
    ]);
  });

  it('no modifica la lista recibida', () => {
    const localidades = [
      { id: 'l-2', nombre: 'Posadas', departamentoNombre: 'Capital' },
      { id: 'l-1', nombre: 'Apóstoles', departamentoNombre: 'Apóstoles' },
    ];
    opcionesDeLocalidad(localidades);
    expect(localidades[0].id).toBe('l-2');
  });
});

describe('cambioDesdeLaBase', () => {
  const BASE: FichaBase = { version: 3, estado: 'BORRADOR', activa: true };

  it('misma versión, estado y `activa`: no cambió', () => {
    expect(cambioDesdeLaBase({ ...BASE }, BASE)).toBeFalse();
  });

  it('otra versión u otro estado: cambió', () => {
    expect(cambioDesdeLaBase({ ...BASE, version: 4 }, BASE)).toBeTrue();
    expect(cambioDesdeLaBase({ ...BASE, estado: 'EN_REVISION' }, BASE)).toBeTrue();
  });

  it('la desactivaron sin sumar versión ni cambiar el estado: cambió igual', () => {
    expect(cambioDesdeLaBase({ ...BASE, activa: false }, BASE)).toBeTrue();
  });
});

describe('quedoPublicadaEInactiva', () => {
  it('solo publicada e inactiva hay que completar con el `DELETE`', () => {
    expect(quedoPublicadaEInactiva({ estado: 'PUBLICADO', activa: false })).toBeTrue();
    expect(quedoPublicadaEInactiva({ estado: 'PUBLICADO', activa: true })).toBeFalse();
    expect(quedoPublicadaEInactiva({ estado: 'BORRADOR', activa: false })).toBeFalse();
    expect(quedoPublicadaEInactiva({ estado: 'DESPUBLICADO', activa: false })).toBeFalse();
  });
});

describe('trasDesactivar', () => {
  it('una publicada queda inactiva y despublicada', () => {
    expect(trasDesactivar(ficha('f-1', { estado: 'PUBLICADO' }))).toEqual(ficha('f-1', { estado: 'DESPUBLICADO', activa: false }));
  });

  it('cualquier otro estado se conserva; solo pasa a inactiva', () => {
    expect(trasDesactivar(ficha('f-1', { estado: 'EN_REVISION' }))).toEqual(ficha('f-1', { estado: 'EN_REVISION', activa: false }));
    expect(trasDesactivar(ficha('f-1', { estado: 'BORRADOR' }))).toEqual(ficha('f-1', { estado: 'BORRADOR', activa: false }));
  });

  it('no modifica la ficha recibida', () => {
    const original = ficha('f-1', { estado: 'PUBLICADO' });
    trasDesactivar(original);
    expect(original.activa).toBeTrue();
    expect(original.estado).toBe('PUBLICADO');
  });
});
