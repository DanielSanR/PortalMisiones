import { API_CODES } from '@core/constants/api-codes.constants';
import { extractErrorCode } from '@core/models/api-response.model';
import { errorDeAccionPorCodigo, textoDeErrorHttp } from '@core/utils/http-error-text.utils';
import { ConflictoDeCampo } from '@core/utils/save-error.utils';
import { ErrorDeCargaDePagina } from '@shared/utils/formulario-de-pagina';

/** Conflictos de guardado de rol que se marcan en su campo. */
export const CONFLICTOS_ROL: ConflictoDeCampo[] = [
  {
    // Unicidad del código (409 `4061`, alta y edición).
    code: API_CODES.ROLE_ALREADY_EXISTS,
    control: 'codigo',
    mensaje: 'Ya existe un rol con ese código',
  },
];

export const FALLBACK_ROL = 'No se pudo guardar el rol. Intentá de nuevo.';

/**
 * `errorDeAccion` del confirm de ACTIVAR un rol desde la lista (`PUT /api/role/{id}` con `active: true`,
 * `RoleService.updateRole`). El resto (sin conexión, 403 sin código, 5xx) lo cuenta el texto compartido.
 */
export const errorDeActivarRol = errorDeAccionPorCodigo({
  // 404: alguien lo borró de la base mientras la lista estaba abierta.
  [API_CODES.ROLE_NOT_FOUND]: 'Ese rol ya no existe. Recargá la página para ver la lista actualizada.',
  // 409: el PUT revalida la unicidad del código; otro rol quedó con el mismo.
  [API_CODES.ROLE_ALREADY_EXISTS]:
    'No se puede activar: otro rol ya usa ese código. Cambiale el código desde «Editar» y volvé a intentar.',
  // 403: el rol SUPERADMIN solo lo modifica otro Super Administrador.
  [API_CODES.NO_PERMISSION]: 'No tenés permiso para activar este rol. Solo un Super Administrador puede modificarlo.',
});

/**
 * ¿El error de la lectura del formulario dice que el rol no existe? (404 / `4059`). Se mira por forma y no
 * por `HttpErrorResponse`: el mock tira `{ status, error: { code } }`.
 */
export function esRolInexistente(err: unknown): boolean {
  const status = (err as { status?: number } | null)?.status;
  const code = extractErrorCode((err as { error?: unknown } | null)?.error);
  return status === 404 || code === API_CODES.ROLE_NOT_FOUND;
}

/** Textos del panel "no existe" del formulario de edición. */
export const TEXTOS_ROL_INEXISTENTE = {
  titulo: 'Ese rol no existe',
  texto: 'Puede que el enlace esté mal escrito. Buscalo en el listado.',
} as const;

/**
 * Por qué no se pudo dibujar el formulario de rol. "No existe" solo en edición: en el alta no se pide ningún
 * rol (un 404 sería del catálogo de permisos) y es un error de carga común, con "Reintentar".
 */
export function errorDeCargaDeRol(err: unknown, esEdicion: boolean): ErrorDeCargaDePagina {
  if (esEdicion && esRolInexistente(err)) return { ...TEXTOS_ROL_INEXISTENTE, noExiste: true };
  return {
    titulo: 'No pudimos cargar el formulario',
    texto: textoDeErrorHttp(
      err,
      esEdicion
        ? 'No pudimos cargar el rol ni sus permisos. Intentá de nuevo.'
        : 'No pudimos cargar el catálogo de permisos. Intentá de nuevo.',
      { contexto: 'accion' },
    ),
    textoExtra: 'Reintentá o volvé a la lista; no se modificó nada.',
    noExiste: false,
  };
}
