import { CategoryRequestDTO, CategoryResponseDTO } from '../models/categoria.dto';
import { CategoriaFormValue, CategoriaVM } from '../models/categoria.vm';

/** DTO backend → ViewModel (plano). */
export function toCategoriaVM(dto: CategoryResponseDTO): CategoriaVM {
  return { id: dto.id, parentId: dto.parentId ?? null, slug: dto.slug, nombre: dto.name };
}

/** Form → request de creación/edición. `parentId` vacío → raíz (null). */
export function toCategoryRequest(form: CategoriaFormValue): CategoryRequestDTO {
  return { parentId: form.parentId || null, slug: form.slug, name: form.nombre };
}
