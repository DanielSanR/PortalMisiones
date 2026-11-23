import { API_CODES } from '@core/constants/api-codes.constants';
import { extractErrorCode } from '@core/models/api-response.model';
import { errorDeAccionPorCodigo } from '@core/utils/http-error-text.utils';
import { ConflictoDeCampo } from '@core/utils/save-error.utils';

/** Qué se está guardando: decide a quién se refieren los códigos que el backend reusa (`4058`, `4071`). */
export interface ContextoDeGuardadoDeOrganismo {
  /** Alta (`POST`): el organismo todavía no existe, así que un `4058` solo puede ser el superior elegido. */
  esAlta: boolean;
  /** Se eligió un organismo superior. Sin él, un `4071` solo puede ser el tipo. */
  tieneSuperior: boolean;
}

/**
 * Rechazos de `OrganismService.createOrganism` / `updateOrganism` con texto propio, marcados en su campo
 * cuando se sabe cuál es (alta y ficha en modo editar). Los nombres de `control` son los del formulario.
 *
 * El backend reusa dos códigos sin decir a qué se refiere:
 * - `4071` (409, "la entidad relacionada no se encuentra activa"): el TIPO o el SUPERIOR elegido. Sin superior
 *   es el tipo; con superior no se sabe cuál, y el texto va al banner nombrando los dos.
 * - `4058` (404): el organismo que se EDITA o el SUPERIOR elegido. En un alta es el superior; al editar con
 *   superior no se sabe cuál; al editar sin superior es el organismo mismo (no se declara: lo cuenta el texto
 *   compartido de "ya no existe").
 */
export function conflictosDeOrganismo({ esAlta, tieneSuperior }: ContextoDeGuardadoDeOrganismo): ConflictoDeCampo[] {
  const conflictos: ConflictoDeCampo[] = [
    {
      // Unicidad global de la sigla (`acronym` en el DTO), incluidas las bajas (409 `4069`).
      code: API_CODES.ORGANISM_ACRONYM_TAKEN,
      control: 'acronym',
      mensaje: 'Ya existe un organismo con esa sigla (también cuentan los dados de baja)',
    },
    tieneSuperior
      ? {
        code: API_CODES.RELATED_ENTITY_INACTIVE,
        mensaje: 'El tipo de organismo o el organismo superior que elegiste está inactivo. '
          + 'Elegí otro que esté activo, o reactivalo primero y volvé a guardar.',
      }
      : {
        code: API_CODES.RELATED_ENTITY_INACTIVE,
        control: 'typeId',
        mensaje: 'Ese tipo de organismo está inactivo. Elegí otro, o reactivalo en Tipos de organismo.',
      },
    {
      // 404 `4053`: el tipo elegido se eliminó de la base después de abrir el formulario.
      code: API_CODES.ORGANISM_TYPE_NOT_FOUND,
      control: 'typeId',
      mensaje: 'Ese tipo de organismo ya no existe. Elegí otro.',
    },
    {
      // 409 `4070` (solo al editar).
      code: API_CODES.ORGANISM_PARENT_IS_SELF,
      control: 'parentId',
      mensaje: 'Un organismo no puede ser su propio organismo superior. Elegí otro.',
    },
    {
      // 409 `4068` (solo al editar): el superior elegido cuelga de este organismo.
      code: API_CODES.ORGANISM_PARENT_IS_DESCENDANT,
      control: 'parentId',
      mensaje: 'Ese organismo depende de este: no puede ser su superior. Elegí otro.',
    },
    {
      // 404 `4073`: en el guardado de un organismo solo lo manda la localidad base (`resolveBaseLocationId`).
      code: API_CODES.ENTITY_NOT_FOUND,
      control: 'baseLocationId',
      mensaje: 'Esa localidad ya no existe. Elegí otra.',
    },
  ];

  if (esAlta) {
    conflictos.push({
      code: API_CODES.ORGANISM_NOT_FOUND,
      control: 'parentId',
      mensaje: 'Ese organismo superior ya no existe. Elegí otro.',
    });
  } else if (tieneSuperior) {
    conflictos.push({
      code: API_CODES.ORGANISM_NOT_FOUND,
      mensaje: 'El organismo que estás editando, o el organismo superior que elegiste, ya no existe. '
        + 'Recargá la página para ver cuál de los dos falta.',
    });
  }
  return conflictos;
}

export const FALLBACK_ORGANISMO = 'No se pudo guardar el organismo. Intentá de nuevo.';

/**
 * ¿El error de la lectura de la ficha dice que el organismo no existe? (404 / `4058`, o el `4073` genérico).
 * Se mira por forma y no por `HttpErrorResponse`: el mock tira `{ status, error: { code } }`.
 */
export function esOrganismoInexistente(err: unknown): boolean {
  const status = (err as { status?: number } | null)?.status;
  const code = extractErrorCode((err as { error?: unknown } | null)?.error);
  return status === 404 || code === API_CODES.ORGANISM_NOT_FOUND || code === API_CODES.ENTITY_NOT_FOUND;
}

/** Textos del panel "no existe" de la ficha (ver y editar). */
export const TEXTOS_ORGANISMO_INEXISTENTE = {
  titulo: 'Ese organismo no existe',
  texto: 'Puede que el enlace esté mal escrito o que lo hayan eliminado. Buscalo en el listado.',
} as const;

/**
 * `errorDeAccion` del confirm de ELIMINAR un organismo (listado y ficha). 409 `4067`: tiene organismos hijos
 * activos (`OrganismService.validateNoChildren`). Recargar no lo resuelve: el texto dice qué hacer.
 */
export const errorDeEliminarOrganismo = errorDeAccionPorCodigo({
  [API_CODES.ORGANISM_HAS_CHILDREN]:
    'No se puede eliminar: tiene organismos activos que dependen de él. '
    + 'Asignales otro organismo superior o dalos de baja primero.',
});
