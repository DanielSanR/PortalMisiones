import { FormGroup } from '@angular/forms';
import { Observable, catchError, throwError } from 'rxjs';
import { API_CODES } from '@core/constants/api-codes.constants';
import { extractErrorCode, extractErrorMessage } from '@core/models/api-response.model';
import { ConflictoDeCampo, aplicarErrorDeGuardado } from '@core/utils/save-error.utils';
import { FichaSinContenidoError } from '@features/fichas-locales';

/**
 * Texto prudente para el `5000` de las ACCIONES sobre la ficha (workflow, desactivar). El backend (`dev` @
 * `586b670`) distingue transición inválida (`4077`), inexistente (`4073`) y escritura simultánea (`4091`);
 * un `5000` acá es un error no previsto.
 */
export const TEXTO_5000_FICHA = 'Puede que la ficha haya cambiado de estado; recargá e intentá de nuevo.';

/**
 * Duplicado al crear o editar. `OrganismProcedureLocationService` no valida la unicidad antes de guardar: un
 * duplicado de (adopción, localidad) o de (slug, adopción) —`V2.27`, que cuenta las fichas desactivadas— llega
 * como el 500 `5000` genérico, sin decir cuál de los dos fue. Por eso el texto nombra los dos. El form lo valida
 * antes, pero no ve fichas creadas después de abrirlo ni fuera del alcance del usuario.
 */
export const TEXTO_5000_GUARDADO =
  'Puede que esa localidad ya tenga una ficha de este trámite (activa o desactivada) o que el slug ya esté en uso: '
  + 'revisalo en Fichas por localidad. Si no es eso, recargá e intentá de nuevo.';

/**
 * 409 `4091`: dos escrituras de la misma ficha al MISMO tiempo (el `@Version` de la entidad). El PUT no viaja
 * con versión, así que el backend NO detecta un formulario abierto hace rato que pisa lo que otro guardó: eso
 * lo mitiga el facade releyendo la ficha antes de guardar (`FichaCambiadaError`; el form se rebasa y lo avisa).
 * Este texto no promete más que lo que el backend hace.
 */
export const TEXTO_EDICION_CONCURRENTE =
  'Otra persona guardó la ficha en el mismo momento y tu cambio no se aplicó. Recargá para ver cómo quedó y volvé a intentar.';

/**
 * COMPATIBILIDAD TEMPORAL (backend anterior a `586b670`): la ficha llegó sin su contenido. Mismo texto en el
 * detalle, en el form de edición y en el listado del trámite del organismo.
 */
export const TEXTO_FICHA_SIN_CONTENIDO =
  'El servidor todavía no entrega el contenido de la ficha; no se puede editar hasta que se actualice.';

/** Lo mismo, en el listado de fichas de un trámite del organismo: no se sabe cuáles son suyas. */
export const TEXTO_FICHAS_SIN_ADOPCION =
  'El servidor todavía no dice a qué trámite del organismo pertenece cada ficha; no se pueden listar acá hasta que se actualice. '
  + 'Mientras tanto, buscalas en Fichas por localidad.';

/** El PUT se guardó pero falló el `DELETE` que la despublica (`DespublicacionFallidaError`). */
export const TEXTO_DESPUBLICACION_FALLIDA =
  'Los cambios se guardaron, pero no se pudo despublicar la ficha: sigue figurando como publicada aunque está desactivada. '
  + 'Volvé a guardar para reintentar; si sigue, avisá a Soporte.';

/**
 * 404 `4073` con la etiqueta `OrganismProcedure` al crear o editar: la adopción no existe, quedó fuera del
 * alcance o —lo más común— NO está vigente (deshabilitada, todavía no empezó o ya venció). El backend responde
 * lo mismo en los tres casos.
 */
export const TEXTO_ADOPCION_NO_VIGENTE =
  'El trámite del organismo ya no está vigente (lo deshabilitaron, todavía no empezó a regir o ya venció), '
  + 'así que no se le pueden crear ni editar fichas. Revisá su vigencia en Trámites del organismo.';

/** 404 `4073` con la etiqueta `Location`. */
export const TEXTO_LOCALIDAD_INEXISTENTE = 'La localidad elegida ya no existe. Recargá y elegí otra.';

/** 404 `4073` de la ficha misma (edición). */
export const TEXTO_FICHA_INEXISTENTE = 'La ficha ya no existe o quedó fuera de tu alcance. Volvé al listado.';

/** Errores de guardado de una ficha con texto propio (`OrganismProcedureLocationService`). Van al banner. */
export const CONFLICTOS_FICHA: ConflictoDeCampo[] = [
  {
    // UNIQUE de `V2.27`: el servicio no lo convierte en 409 `4072`, llega como 500 `5000`.
    code: API_CODES.UNEXPECTED,
    mensaje: TEXTO_5000_GUARDADO,
  },
  {
    // 400 `4012`: falta `organismProcedureId`, `locationId`, `slug` o `active`. El form ya los exige.
    code: API_CODES.VALIDATION,
    mensaje: 'Revisá los campos obligatorios: trámite del organismo, localidad y slug.',
  },
  {
    // Dos guardados simultáneos (`@Version`, G-8). No cubre un formulario viejo: ver `TEXTO_EDICION_CONCURRENTE`.
    code: API_CODES.CONCURRENT_MODIFICATION,
    mensaje: TEXTO_EDICION_CONCURRENTE,
  },
  {
    // 404 `4073` sin etiqueta reconocible (ver `mensajeErrorGuardado`, que distingue adopción, localidad y ficha).
    code: API_CODES.ENTITY_NOT_FOUND,
    mensaje: 'La ficha, el trámite del organismo o la localidad ya no existe o quedó fuera de tu alcance. Recargá e intentá de nuevo.',
  },
  {
    // 409 `4072` es el código de duplicado de los demás recursos. Hoy las fichas no lo mandan (su UNIQUE llega
    // como `5000`, arriba), pero si el backend lo alinea no se sabría cuál de los dos UNIQUE fue: va al banner.
    code: API_CODES.ENTITY_CONFLICT,
    mensaje: 'Esa localidad ya tiene una ficha de este trámite (activa o desactivada) o el slug ya está en uso. '
      + 'Revisalo en Fichas por localidad.',
  },
];

export const FALLBACK_FICHA = 'No se pudo guardar la ficha. Intentá de nuevo.';

/** Qué entidad dice el backend que no existe en un 404 `4073` ("El objeto <Etiqueta> con el identificador … no existe."). */
export type EntidadInexistente = 'adopcion' | 'localidad' | 'ficha';

/**
 * Lee la etiqueta del `4073` (`OrganismProcedure`, `Location`, `OrganismProcedureLocation`). Es la única señal
 * que da el backend para distinguirlas (mismo status y mismo código): se usa solo para elegir el texto propio,
 * nunca se muestra. `null` si no es un `4073` o la etiqueta no se reconoce.
 */
export function entidadInexistente(err: unknown): EntidadInexistente | null {
  const status = (err as { status?: number } | null)?.status;
  const body = (err as { error?: unknown } | null)?.error;
  if (status !== 404 && extractErrorCode(body) !== API_CODES.ENTITY_NOT_FOUND) return null;
  const mensaje = extractErrorMessage(body) ?? '';
  // `\b` a ambos lados: "OrganismProcedure" y "Location" no deben coincidir dentro de "OrganismProcedureLocation".
  if (/\bOrganismProcedure\b/.test(mensaje)) return 'adopcion';
  if (/\bOrganismProcedureLocation\b/.test(mensaje)) return 'ficha';
  if (/\bLocation\b/.test(mensaje)) return 'localidad';
  return null;
}

/**
 * Texto del error de GUARDAR una ficha (alta o edición), ya traducido; marca el campo si corresponde.
 * - 404 de la adopción → "ya no está vigente…" (nunca el `message` crudo del backend).
 * - 404 de la localidad o de la ficha → su texto.
 * - 403 → sin permiso.
 * - El resto, por código (`CONFLICTOS_FICHA`); sin código conocido, el texto genérico propio.
 */
export function mensajeErrorGuardado(err: unknown, form: FormGroup | undefined): string {
  if (err instanceof FichaSinContenidoError) return TEXTO_FICHA_SIN_CONTENIDO;
  const status = (err as { status?: number } | null)?.status;
  const code = extractErrorCode((err as { error?: unknown } | null)?.error);
  if (status === 403 || code === API_CODES.NO_PERMISSION) return 'No tenés permiso para guardar esta ficha.';
  switch (entidadInexistente(err)) {
    case 'adopcion': return TEXTO_ADOPCION_NO_VIGENTE;
    case 'localidad': return TEXTO_LOCALIDAD_INEXISTENTE;
    case 'ficha': return TEXTO_FICHA_INEXISTENTE;
    default:
  }
  // Sin código de negocio conocido no se muestra el `message` del backend (viene en otro registro, a veces en inglés).
  if (!CONFLICTOS_FICHA.some((c) => c.code === code)) return FALLBACK_FICHA;
  return aplicarErrorDeGuardado(err, form, CONFLICTOS_FICHA, FALLBACK_FICHA);
}

export const FALLBACK_ACCION = 'No se pudo completar la acción. Intentá de nuevo; si sigue, avisá a Soporte.';

/**
 * Texto del error de una acción sobre la ficha (workflow o desactivar), ya traducido. SIEMPRE un texto propio:
 * el `message` del backend no se muestra nunca (viene en otro registro, a veces en inglés o como clave cruda).
 * Se decide primero por código de negocio y después por status.
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
  if (status === 404 || code === API_CODES.ENTITY_NOT_FOUND) return 'La ficha ya no existe o quedó fuera de tu alcance.';
  // Las acciones no llevan cuerpo: un `4012` o un `4072` acá es que la ficha ya no admite la acción tal como está.
  if (code === API_CODES.VALIDATION) return 'El servidor no aceptó la acción con los datos actuales de la ficha. Recargá e intentá de nuevo.';
  if (code === API_CODES.ENTITY_CONFLICT) {
    return 'La acción choca con otra ficha del mismo trámite (misma localidad o mismo slug). Revisalo en Fichas por localidad.';
  }
  if (code === API_CODES.UNEXPECTED || (typeof status === 'number' && status >= 500)) {
    return `No se pudo completar la acción. ${TEXTO_5000_FICHA}`;
  }
  if (status === 0) return 'No se pudo completar la acción: no hay conexión con el servidor. Revisá tu conexión e intentá de nuevo.';
  return FALLBACK_ACCION;
}

/**
 * Envuelve una acción para el `ConfirmDialogComponent`, que muestra `error.message` tal cual: así ve
 * el texto prudente y no "Ocurrió un error inesperado. Contacte al administrador.".
 */
export function conMensajeDeAccion<T>(accion$: Observable<T>): Observable<T> {
  return accion$.pipe(catchError((err: unknown) => throwError(() => ({ error: { message: mensajeErrorAccion(err) } }))));
}

/**
 * ¿El error de una lectura dice que lo pedido no existe (o está fuera del alcance)? 404 `4073`; el resto
 * cae en el error genérico, con "Reintentar".
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

/** Error de carga que no es un 404: conexión, 5xx u otro. */
export const TEXTOS_FICHA_ERROR_CARGA = {
  titulo: 'No pudimos cargar la ficha',
  texto: 'Puede que no exista, que no sea de tu organismo o que haya un problema de conexión. Intentá de nuevo; si sigue, avisá a Soporte.',
} as const;

/** Texto de "no se pudo resolver el nombre" (sin permiso para leerlo, o el id ya no está). */
export const NO_DISPONIBLE = 'No disponible';
