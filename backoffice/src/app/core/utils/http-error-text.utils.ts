import { API_CODES } from '../constants/api-codes.constants';
import { extractErrorCode } from '../models/api-response.model';

/** Qué clase de fallo es un error HTTP para quien lo lee, sin mirar el `message` del backend. */
export type TipoDeErrorHttp =
  | 'sin-conexion'
  | 'sesion-vencida'
  | 'sin-permiso'
  | 'inexistente'
  | 'conflicto'
  | 'datos-rechazados'
  | 'servidor'
  | 'otro';

/**
 * Dónde se cuenta el error: en el banner de un formulario (hay datos que revisar) o como resultado de una
 * acción sin formulario (confirmar, cargar, activar…), donde "revisá el formulario" no aplica.
 */
export type ContextoDeError = 'formulario' | 'accion';

export interface OpcionesDeTextoDeError {
  /** Por defecto `formulario`. */
  contexto?: ContextoDeError;
  /**
   * Tipos para los que se usa el texto compartido; el resto cae en el `fallback`. Para las pantallas donde un
   * 4xx ya tiene un significado propio que el `fallback` explica mejor (p. ej. un enlace de activación vencido).
   */
  solo?: readonly TipoDeErrorHttp[];
}

/** Códigos de negocio genéricos, para los errores que llegan sin `status` (mocks viejos, errores armados a mano). */
const TIPO_DE_CODIGO: Readonly<Record<number, TipoDeErrorHttp>> = {
  [API_CODES.JWT_INVALID_SIGNATURE]: 'sesion-vencida',
  [API_CODES.JWT_MALFORMED]: 'sesion-vencida',
  [API_CODES.JWT_EXPIRED]: 'sesion-vencida',
  [API_CODES.JWT_UNSUPPORTED]: 'sesion-vencida',
  [API_CODES.JWT_EMPTY_CLAIMS]: 'sesion-vencida',
  [API_CODES.RELOGIN_REQUIRED]: 'sesion-vencida',
  [API_CODES.REFRESH_INVALID]: 'sesion-vencida',
  [API_CODES.ACCESS_DENIED]: 'sin-permiso',
  [API_CODES.NO_PERMISSION]: 'sin-permiso',
  [API_CODES.ENTITY_NOT_FOUND]: 'inexistente',
  [API_CODES.ENTITY_CONFLICT]: 'conflicto',
  [API_CODES.CONCURRENT_MODIFICATION]: 'conflicto',
  [API_CODES.INVALID_ELEMENT]: 'datos-rechazados',
  [API_CODES.VALIDATION]: 'datos-rechazados',
  [API_CODES.UNEXPECTED]: 'servidor',
  [API_CODES.DB_ERROR]: 'servidor',
};

/**
 * Clasifica un error por su HTTP status; si no trae status, por su código de negocio. Nunca lee el `message`.
 * Lo que no es un error HTTP reconocible (un `Error` cualquiera, un status sin texto propio) es `otro`.
 */
export function tipoDeErrorHttp(err: unknown): TipoDeErrorHttp {
  const status = (err as { status?: unknown } | null)?.status;
  if (typeof status === 'number') {
    if (status === 0) return 'sin-conexion';
    if (status === 401) return 'sesion-vencida';
    if (status === 403) return 'sin-permiso';
    if (status === 404) return 'inexistente';
    if (status === 409) return 'conflicto';
    if (status === 400 || status === 422) return 'datos-rechazados';
    if (status >= 500) return 'servidor';
    return 'otro';
  }
  const code = extractErrorCode((err as { error?: unknown } | null)?.error);
  return (code !== null && TIPO_DE_CODIGO[code]) || 'otro';
}

/**
 * ÚNICA fuente de los textos para un error HTTP no previsto. Cada uno dice qué pasó y qué puede hacer la
 * persona; ninguno repite "No se pudo guardar" (el banner del formulario ya se titula así).
 */
export const TEXTOS_DE_ERROR_HTTP: Readonly<Record<Exclude<TipoDeErrorHttp, 'otro'>, Record<ContextoDeError, string>>> = {
  'sin-conexion': {
    formulario: 'No hay conexión con el servidor. Revisá tu conexión a internet e intentá de nuevo.',
    accion: 'No hay conexión con el servidor. Revisá tu conexión a internet e intentá de nuevo.',
  },
  'sesion-vencida': {
    formulario: 'Tu sesión venció. Volvé a iniciar sesión e intentá de nuevo.',
    accion: 'Tu sesión venció. Volvé a iniciar sesión e intentá de nuevo.',
  },
  'sin-permiso': {
    formulario: 'No tenés permiso para hacer esto. Si creés que deberías tenerlo, pedíselo a un administrador.',
    accion: 'No tenés permiso para hacer esto. Si creés que deberías tenerlo, pedíselo a un administrador.',
  },
  // En un formulario el 404 también llega cuando lo que ya no existe es algo ELEGIDO en un selector (un
  // organismo, un rol, un tipo): el texto no puede dar por desaparecido lo que se está editando.
  inexistente: {
    formulario: 'Lo que estás guardando, o algo que elegiste en el formulario, ya no existe o quedó fuera de tu alcance. '
      + 'Recargá la página para ver las opciones actuales y volvé a intentar.',
    accion: 'El registro ya no existe o quedó fuera de tu alcance. Recargá la página para ver el estado actual.',
  },
  conflicto: {
    formulario: 'Lo que querés guardar choca con el estado actual del registro: puede que alguien lo haya cambiado '
      + 'o que ya exista otro igual. Recargá la página y volvé a intentar.',
    // Sin formulario (eliminar, desactivar…) lo más probable es que el registro esté EN USO: recargar no lo
    // resuelve, así que no puede ser el único consejo. El texto vale para los dos casos.
    accion: 'No se pudo completar la acción en el estado actual del registro. Si otros datos lo están usando, '
      + 'primero quitá o reasigná lo que depende de él; si alguien lo cambió recién, recargá la página y volvé a intentar.',
  },
  'datos-rechazados': {
    formulario: 'El servidor no aceptó los datos enviados. Revisá el formulario e intentá de nuevo.',
    accion: 'El servidor rechazó la acción tal como está el registro. Si otros datos lo están usando, '
      + 'primero quitá o reasigná lo que depende de él; si alguien lo cambió recién, recargá la página y volvé a intentar.',
  },
  servidor: {
    formulario: 'El servidor tuvo un error y no pudo completar la operación. Esperá un momento e intentá de nuevo; si sigue, avisá a Soporte.',
    accion: 'El servidor tuvo un error y no pudo completar la operación. Esperá un momento e intentá de nuevo; si sigue, avisá a Soporte.',
  },
};

/**
 * Texto propio para un error HTTP no previsto: sin conexión, sesión vencida, sin permiso, registro
 * inexistente, conflicto, datos rechazados o error del servidor; para el resto, el `fallback` de quien llama.
 *
 * REGLA: el `message` del backend NO se muestra nunca. A veces habla de otra cosa (un `4029` que dice "no tiene
 * permisos para crear usuarios" al desactivar una cuenta), viene en otro tono o expone detalles internos. Quien
 * necesite un texto más preciso para un código de negocio lo declara antes (`ConflictoDeCampo`,
 * `errorDeAccion`) y deja esto para lo que no previó.
 */
export function textoDeErrorHttp(err: unknown, fallback: string, opciones: OpcionesDeTextoDeError = {}): string {
  const tipo = tipoDeErrorHttp(err);
  if (tipo === 'otro' || (opciones.solo && !opciones.solo.includes(tipo))) return fallback;
  return TEXTOS_DE_ERROR_HTTP[tipo][opciones.contexto ?? 'formulario'];
}

/**
 * Arma el `errorDeAccion` de una confirmación a partir de los rechazos de negocio que tienen un motivo
 * preciso: código de negocio → texto propio (qué pasó y qué hacer). Para cualquier otro error devuelve `null`
 * y la confirmación sigue con el texto compartido. Decide por el código, nunca por el `message`.
 */
export function errorDeAccionPorCodigo(textos: Readonly<Record<number, string>>): (err: unknown) => string | null {
  return (err) => {
    const code = extractErrorCode((err as { error?: unknown } | null)?.error);
    return (code !== null && textos[code]) || null;
  };
}
