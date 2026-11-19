import { firstValueFrom } from 'rxjs';
import { API_CODES } from '../constants/api-codes.constants';
import { STATUS_POR_DEFECTO, errorDeNegocio, statusDeCodigo } from './mock-errors';

type ErrorSimulado = { status?: number; error?: { code?: number; message?: string } };

const fallo = (code: number, status?: number): Promise<ErrorSimulado> =>
  firstValueFrom(status === undefined ? errorDeNegocio(code, 'texto') : errorDeNegocio(code, 'texto', status))
    .then(() => ({}), (e: unknown) => e as ErrorSimulado);

/** Los mocks acompañan cada código con el HTTP status del backend real (`dev` @ `586b670`). */
describe('errorDeNegocio (mocks)', () => {
  const ESPERADO: [nombre: string, code: number, status: number][] = [
    ['duplicado 4072', API_CODES.ENTITY_CONFLICT, 409],
    ['solapamiento de adopción 4080', API_CODES.ADOPTION_OVERLAP, 409],
    ['solapamiento de asignación de rol 4081', API_CODES.ROLE_ASSIGNMENT_OVERLAP, 409],
    ['transición de publicación 4077', API_CODES.PUBLICATION_TRANSITION_INVALID, 409],
    ['edición concurrente 4091', API_CODES.CONCURRENT_MODIFICATION, 409],
    ['email/usuario 4002', API_CODES.USER_ALREADY_REGISTERED, 409],
    ['rol repetido 4061', API_CODES.ROLE_ALREADY_EXISTS, 409],
    ['permiso repetido 4062', API_CODES.PERMISSION_ALREADY_EXISTS, 409],
    ['sigla de organismo 4069', API_CODES.ORGANISM_ACRONYM_TAKEN, 409],
    ['evento de vida asignado 4076', API_CODES.LIFE_EVENT_ASSIGNED, 409],
    ['validación 4012', API_CODES.VALIDATION, 400],
    ['elemento inválido 4011', API_CODES.INVALID_ELEMENT, 400],
    ['sin permiso 4029', API_CODES.NO_PERMISSION, 403],
    ['no existe 4073', API_CODES.ENTITY_NOT_FOUND, 404],
    ['organismo inexistente 4058', API_CODES.ORGANISM_NOT_FOUND, 404],
    ['inesperado 5000', API_CODES.UNEXPECTED, 500],
  ];

  ESPERADO.forEach(([nombre, code, status]) => {
    it(`${nombre} → HTTP ${status}`, async () => {
      expect(statusDeCodigo(code)).toBe(status);
      expect(await fallo(code)).toEqual({ status, error: { code, message: 'texto' } });
    });
  });

  it('siempre lleva status: un código fuera de la tabla sale con el genérico', async () => {
    expect((await fallo(9999)).status).toBe(STATUS_POR_DEFECTO);
  });

  it('un status explícito gana sobre el de la tabla', async () => {
    expect((await fallo(API_CODES.ENTITY_CONFLICT, 400)).status).toBe(400);
  });
});
