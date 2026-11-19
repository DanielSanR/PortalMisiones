import { AuthMeResponseDTO, AuthUser } from '../models/auth.model';
import {
  ORGANISMO_SIN_NOMBRE, alcanceDeSesion, etiquetaDeOrganismo, hintDeOrganismoPropio, organismoDeSesion,
} from './session.utils';

const me = (extra: Partial<AuthMeResponseDTO> = {}): AuthMeResponseDTO => ({
  userId: 'u-1', email: 'ana@misiones.gob.ar', roles: ['ROLE_ADMIN_ORGANIZATION'], permissions: [], ...extra,
});

describe('alcanceDeSesion (GET /api/auth/me, backend 586b670)', () => {
  it('rol de organismo: scope + organismo completo', () => {
    expect(alcanceDeSesion(me({
      scope: 'organismo', organismId: 'org-uuid', organismName: 'Instituto de Previsión Social', organismAcronym: 'IPS',
    }))).toEqual({
      scope: 'organismo', organismoId: 'org-uuid', organismoNombre: 'Instituto de Previsión Social', organismoSigla: 'IPS',
    });
  });

  it('rol global: los tres campos del organismo llegan en null', () => {
    expect(alcanceDeSesion(me({ scope: 'global', organismId: null, organismName: null, organismAcronym: null })))
      .toEqual({ scope: 'global', organismoId: null, organismoNombre: null, organismoSigla: null });
  });

  it('backend anterior (sin los campos): nada informado, como antes de G-2', () => {
    expect(alcanceDeSesion(me())).toEqual({ scope: null, organismoId: null, organismoNombre: null, organismoSigla: null });
  });

  it('`/me` caído: mismo resultado que el backend anterior; el claim del JWT, si existiera, sigue valiendo', () => {
    expect(alcanceDeSesion(null)).toEqual({ scope: null, organismoId: null, organismoNombre: null, organismoSigla: null });
    expect(alcanceDeSesion(null, 'org-claim').organismoId).toBe('org-claim');
    expect(alcanceDeSesion(me(), 'org-claim').organismoId).toBe('org-claim');
  });

  it('un scope global nunca lleva organismo, aunque viniera uno (ni el del claim)', () => {
    expect(alcanceDeSesion(me({ scope: 'global', organismId: 'org-x', organismName: 'X' }), 'org-claim'))
      .toEqual({ scope: 'global', organismoId: null, organismoNombre: null, organismoSigla: null });
  });

  it('tolera mayúsculas, espacios y valores desconocidos en `scope`', () => {
    expect(alcanceDeSesion(me({ scope: ' ORGANISMO ', organismId: 'org-1' })).scope).toBe('organismo');
    expect(alcanceDeSesion(me({ scope: 'municipio' })).scope).toBeNull();
    // Organismo sin etiqueta de scope: el dato manda.
    expect(alcanceDeSesion(me({ organismId: 'org-1', organismName: 'IPS' })))
      .toEqual({ scope: 'organismo', organismoId: 'org-1', organismoNombre: 'IPS', organismoSigla: null });
  });

  it('textos vacíos cuentan como ausentes', () => {
    expect(alcanceDeSesion(me({ scope: 'organismo', organismId: 'org-1', organismName: '  ', organismAcronym: '' })))
      .toEqual({ scope: 'organismo', organismoId: 'org-1', organismoNombre: null, organismoSigla: null });
  });
});

describe('organismoDeSesion', () => {
  const usuario = (extra: Partial<AuthUser>): AuthUser => ({
    id: 'u-1', email: 'a@b.c', nombre: '', apellido: '', role: null, roles: [], roleCodes: [], permissions: [], ...extra,
  });

  it('sin sesión, sesión global o sin organismo: null', () => {
    expect(organismoDeSesion(null)).toBeNull();
    expect(organismoDeSesion(usuario({}))).toBeNull(); // sesión guardada por una versión anterior del front
    expect(organismoDeSesion(usuario({ scope: 'global', organismoId: null }))).toBeNull();
    expect(organismoDeSesion(usuario({ scope: 'global', organismoId: 'org-1' }))).toBeNull();
    expect(organismoDeSesion(usuario({ scope: 'organismo', organismoId: null }))).toBeNull();
  });

  it('sesión de organismo: id, nombre y sigla', () => {
    expect(organismoDeSesion(usuario({ scope: 'organismo', organismoId: 'org-1', organismoNombre: 'Rentas', organismoSigla: 'DGR' })))
      .toEqual({ id: 'org-1', nombre: 'Rentas', sigla: 'DGR' });
  });

  it('sin nombre usa la sigla; sin ninguno, un nombre genérico', () => {
    expect(organismoDeSesion(usuario({ scope: 'organismo', organismoId: 'org-1', organismoSigla: 'DGR' })))
      .toEqual({ id: 'org-1', nombre: 'DGR', sigla: 'DGR' });
    expect(organismoDeSesion(usuario({ scope: 'organismo', organismoId: 'org-1' })))
      .toEqual({ id: 'org-1', nombre: ORGANISMO_SIN_NOMBRE, sigla: null });
  });
});

describe('textos del organismo de la sesión', () => {
  it('nombre con sigla entre paréntesis, sin repetirla si ya es el nombre', () => {
    expect(etiquetaDeOrganismo({ id: 'o', nombre: 'Instituto de Previsión Social', sigla: 'IPS' })).toBe('Instituto de Previsión Social (IPS)');
    expect(etiquetaDeOrganismo({ id: 'o', nombre: 'IPS', sigla: 'IPS' })).toBe('IPS');
    expect(etiquetaDeOrganismo({ id: 'o', nombre: 'Rentas', sigla: null })).toBe('Rentas');
  });

  it('el hint arranca con "Tu cuenta pertenece a …"', () => {
    expect(hintDeOrganismoPropio({ id: 'o', nombre: 'Rentas', sigla: 'DGR' })).toBe('Tu cuenta pertenece a Rentas (DGR)');
  });
});
