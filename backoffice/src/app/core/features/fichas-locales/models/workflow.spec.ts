import { EstadoFicha } from './ficha-local.vm';
import { AccionWorkflow, accionesDisponibles, transicionPermitida } from './workflow';

const TODOS = (): boolean => true;
const con = (...permisos: string[]) => (p: string): boolean => permisos.includes(p);

describe('workflow de fichas', () => {
  describe('accionesDisponibles (tabla de §4.2)', () => {
    const casos: [EstadoFicha, AccionWorkflow][] = [
      ['BORRADOR', 'enviar-a-revision'],
      ['EN_REVISION', 'publicar'],
      ['PUBLICADO', 'despublicar'],
      ['DESPUBLICADO', 'republicar'],
    ];

    for (const [estado, accion] of casos) {
      it(`${estado} ofrece ${accion} con todos los permisos`, () => {
        expect(accionesDisponibles(estado, TODOS)).toEqual([accion]);
      });
    }

    it('enviar a revisión exige UPDATE_VARIANT; publicar/despublicar/republicar, PUBLISH_VARIANT', () => {
      const agente = con('UPDATE_VARIANT');
      expect(accionesDisponibles('BORRADOR', agente)).toEqual(['enviar-a-revision']);
      expect(accionesDisponibles('EN_REVISION', agente)).toEqual([]);
      expect(accionesDisponibles('PUBLICADO', agente)).toEqual([]);
      expect(accionesDisponibles('DESPUBLICADO', agente)).toEqual([]);

      const publicador = con('PUBLISH_VARIANT');
      expect(accionesDisponibles('BORRADOR', publicador)).toEqual([]);
      expect(accionesDisponibles('EN_REVISION', publicador)).toEqual(['publicar']);
      expect(accionesDisponibles('PUBLICADO', publicador)).toEqual(['despublicar']);
      expect(accionesDisponibles('DESPUBLICADO', publicador)).toEqual(['republicar']);
    });

    it('sin permisos (MANAGER) no ofrece nada', () => {
      for (const estado of ['BORRADOR', 'EN_REVISION', 'PUBLICADO', 'DESPUBLICADO'] as EstadoFicha[]) {
        expect(accionesDisponibles(estado, con('READ_VARIANT'))).toEqual([]);
      }
    });

    it('una ficha desactivada no ofrece workflow', () => {
      expect(accionesDisponibles('BORRADOR', TODOS, { activa: false })).toEqual([]);
      expect(accionesDisponibles('PUBLICADO', TODOS, { activa: false })).toEqual([]);
    });

    it('"Enviar y publicar" solo con la política encendida y los dos permisos (P-3)', () => {
      expect(accionesDisponibles('BORRADOR', TODOS, { permitirEnviarYPublicar: false })).toEqual(['enviar-a-revision']);
      expect(accionesDisponibles('BORRADOR', TODOS, { permitirEnviarYPublicar: true }))
        .toEqual(['enviar-a-revision', 'enviar-y-publicar']);
      expect(accionesDisponibles('BORRADOR', con('UPDATE_VARIANT'), { permitirEnviarYPublicar: true }))
        .toEqual(['enviar-a-revision']);
      expect(accionesDisponibles('EN_REVISION', TODOS, { permitirEnviarYPublicar: true })).toEqual(['publicar']);
    });
  });

  describe('transicionPermitida (isAllowedTransition del backend)', () => {
    it('acepta las del mapa y rechaza el resto', () => {
      expect(transicionPermitida('BORRADOR', 'EN_REVISION')).toBeTrue();
      expect(transicionPermitida('BORRADOR', 'DESPUBLICADO')).toBeTrue();
      expect(transicionPermitida('BORRADOR', 'PUBLICADO')).toBeFalse();
      expect(transicionPermitida('EN_REVISION', 'PUBLICADO')).toBeTrue();
      expect(transicionPermitida('EN_REVISION', 'DESPUBLICADO')).toBeFalse();
      expect(transicionPermitida('PUBLICADO', 'DESPUBLICADO')).toBeTrue();
      expect(transicionPermitida('PUBLICADO', 'PUBLICADO')).toBeFalse();
      expect(transicionPermitida('DESPUBLICADO', 'PUBLICADO')).toBeTrue();
      expect(transicionPermitida('DESPUBLICADO', 'EN_REVISION')).toBeFalse();
    });
  });
});
