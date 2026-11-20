import { API_CODES } from '@core/constants/api-codes.constants';
import { errorDeAccionPorCodigo } from '@core/utils/http-error-text.utils';
import { ConflictoDeCampo } from '@core/utils/save-error.utils';

/** Conflictos de guardado de categoría que se marcan en su campo. */
export const CONFLICTOS_CATEGORIA: ConflictoDeCampo[] = [
  {
    // Unicidad del slug (409 `4072` desde el backend `586b670`; antes 400. Se decide por código).
    code: API_CODES.ENTITY_CONFLICT,
    control: 'slug',
    mensaje: 'Ya existe una categoría con ese slug',
  },
  {
    // 400 `4074` (solo al editar).
    code: API_CODES.CATEGORY_PARENT_IS_SELF,
    control: 'parentId',
    mensaje: 'Una categoría no puede ser su propia categoría padre. Elegí otra.',
  },
  {
    // 400 `4075` (solo al editar): la categoría padre elegida cuelga de esta.
    code: API_CODES.CATEGORY_PARENT_IS_DESCENDANT,
    control: 'parentId',
    mensaje: 'Esa categoría es una subcategoría de esta: no puede ser su padre. Elegí otra.',
  },
];

export const FALLBACK_CATEGORIA = 'No se pudo guardar la categoría. Intentá de nuevo.';

/**
 * `errorDeAccion` del confirm de ELIMINAR una categoría. 400 `4065`: tiene subcategorías
 * (`CategoryService.deleteCategory`). Recargar no lo resuelve: el texto dice qué hacer.
 */
export const errorDeEliminarCategoria = errorDeAccionPorCodigo({
  [API_CODES.CATEGORY_HAS_CHILDREN]:
    'No se puede eliminar: tiene subcategorías. Movelas a otra categoría padre o eliminalas primero.',
});
