import { Observable, catchError, throwError } from 'rxjs';
import { API_CODES } from '@core/constants/api-codes.constants';
import { extractErrorCode, extractErrorMessage } from '@core/models/api-response.model';
import { ConflictoDeCampo } from '@core/utils/save-error.utils';

/**
 * Texto prudente para el `5000` de las ACCIONES sobre la ficha (decisión de §8, R-2/G-4). Staging todavía
 * responde 500 a casi todo; el backend de `dev` ya distingue transición inválida (`4077`), inexistente
 * (`4073`) y edición concurrente (`4091`), y el `5000` queda para campos obligatorios faltantes (G-1) y
 * para los UNIQUE de `V2.27` (ver `TEXTO_5000_GUARDADO`).
 */
export const TEXTO_5000_FICHA = 'Puede que la ficha haya cambiado de estado; recargá e intentá de nuevo.';

/**
 * `5000` al crear o editar. El backend no valida la unicidad antes de guardar: un duplicado de
 * (adopción, localidad) o de (slug, adopción) —`V2.27`, que cuenta las fichas desactivadas— llega como
 * este 500 genérico, sin código propio. Por eso el texto nombra primero el duplicado posible. El form lo
 * valida antes, pero no ve fichas creadas después de abrirlo ni fuera del alcance del usuario.
 */
export const TEXTO_5000_GUARDADO =
  'Puede que esa localidad ya tenga una ficha de este trámite (activa o desactivada) o que el slug ya esté en uso: '
  + 'revisalo en Fichas por localidad. Si no es eso, puede que la ficha haya cambiado, o que el trámite del organismo '
  + 'o la localidad ya no estén disponibles: recargá e intentá de nuevo.';

/** `4091`: otro usuario guardó la ficha antes. */
export const TEXTO_EDICION_CONCURRENTE = 'Otro usuario modificó la ficha mientras la editabas. Recargá para ver los cambios.';

/** Errores de guardado de una ficha con texto propio (`OrganismProcedureLocationService`). Van al banner. */
export const CONFLICTOS_FICHA: ConflictoDeCampo[] = [
  {
    code: API_CODES.UNEXPECTED,
    mensaje: TEXTO_5000_GUARDADO,
  },
  {
    // Hoy el backend no valida el DTO (G-1); cuando lo haga, un campo obligatorio faltante será `4012`.
    code: API_CODES.VALIDATION,
    mensaje: 'Revisá los campos obligatorios: localidad y slug.',
  },
  {
    // Otro usuario guardó la ficha mientras se editaba (`@Version`, G-8).
    code: API_CODES.CONCURRENT_MODIFICATION,
    mensaje: TEXTO_EDICION_CONCURRENTE,
  },
  {
    // "No existe o fuera del alcance" (G-4; en staging todavía llega como `5000`).
    code: API_CODES.ENTITY_NOT_FOUND,
    mensaje: 'La ficha, el trámite del organismo o la localidad ya no existe o quedó fuera de tu alcance. Recargá e intentá de nuevo.',
  },
  {
    // G-9 propone un `409`/`4072` para slug repetido. Hoy el UNIQUE de `V2.27` llega como `5000` (arriba).
    code: API_CODES.ENTITY_CONFLICT,
    control: 'slug',
    mensaje: 'Ya hay otra ficha con ese slug. Elegí otro.',
  },
];

export const FALLBACK_FICHA = 'No se pudo guardar la ficha. Intentá de nuevo.';

/**
 * Texto del error de una acción sobre la ficha (workflow o desactivar), ya traducido. Sin permiso →
 * lo dice; `5000` → el texto prudente; el resto, lo que mande el backend.
 */
export function mensajeErrorAccion(err: unknown): string {
  const status = (err as { status?: number } | null)?.status;
  const body = (err as { error?: unknown } | null)?.error;
  const code = extractErrorCode(body);
  if (status === 403 || code === API_CODES.NO_PERMISSION) return 'No tenés permiso para hacer esto con la ficha.';
  if (code === API_CODES.PUBLICATION_TRANSITION_INVALID) {
    return 'La ficha cambió de estado y esta acción ya no corresponde. Recargá para ver su estado actual.';
  }
  if (code === API_CODES.CONCURRENT_MODIFICATION) return TEXTO_EDICION_CONCURRENTE;
  if (code === API_CODES.UNEXPECTED || status === 500) return `No se pudo completar la acción. ${TEXTO_5000_FICHA}`;
  if (status === 404 || code === API_CODES.ENTITY_NOT_FOUND) return 'La ficha ya no existe o quedó fuera de tu alcance.';
  return extractErrorMessage(body) || 'No se pudo completar la acción. Intentá de nuevo.';
}

/**
 * Envuelve una acción para el `ConfirmDialogComponent`, que muestra `error.message` tal cual: así ve
 * el texto prudente y no "Ocurrió un error inesperado. Contacte al administrador.".
 */
export function conMensajeDeAccion<T>(accion$: Observable<T>): Observable<T> {
  return accion$.pipe(catchError((err: unknown) => throwError(() => ({ error: { message: mensajeErrorAccion(err) } }))));
}

/**
 * ¿El error de una lectura dice que la ficha no existe? Hoy el backend responde `5000` también para
 * eso (G-4), así que solo se reconoce el 404/`4073` futuro; el resto cae en el error genérico.
 */
export function esFichaInexistente(err: unknown): boolean {
  const status = (err as { status?: number } | null)?.status;
  const code = extractErrorCode((err as { error?: unknown } | null)?.error);
  return status === 404 || code === API_CODES.ENTITY_NOT_FOUND;
}

export const TEXTOS_FICHA_INEXISTENTE = {
  titulo: 'Esa ficha no existe',
  texto: 'Puede que el enlace esté mal escrito o que la ficha no sea de tu organismo. Buscala en el listado.',
} as const;

/** Error de carga genérico: el backend no distingue "no existe" de otros errores (G-4). */
export const TEXTOS_FICHA_ERROR_CARGA = {
  titulo: 'No pudimos cargar la ficha',
  texto: 'Puede que no exista, que no sea de tu organismo o que haya un problema de conexión. Intentá de nuevo; si sigue, avisá a Soporte.',
} as const;

/** Texto de "no se pudo resolver el nombre" (sin permiso para leerlo, o sin G-1). */
export const NO_DISPONIBLE = 'No disponible';
