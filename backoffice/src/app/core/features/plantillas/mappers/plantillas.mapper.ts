import { canonicalizarSlug } from '@core/utils/slug.utils';
import { ProcedureTemplateRequestDTO, ProcedureTemplateResponseDTO } from '../models/plantilla.dto';
import { PlantillaFormValue, PlantillaRef, PlantillaVM } from '../models/plantilla.vm';

/** Ref sin nombre: lo completa el facade con el catálogo. */
function ref(id: string): PlantillaRef {
  return { id, nombre: null };
}

function refs(ids: string[] | null | undefined): PlantillaRef[] {
  return (ids ?? []).map(ref);
}

/** Texto opcional: vacío o solo espacios → `null` (el backend lo guarda como NULL). */
function textoOpcional(valor: string | null | undefined): string | null {
  const texto = (valor ?? '').trim();
  return texto ? texto : null;
}

/** `ProcedureTemplateResponseDTO` → VM. Los nombres de los catálogos quedan en null (los resuelve el facade). */
export function toPlantillaVM(dto: ProcedureTemplateResponseDTO): PlantillaVM {
  return {
    id: dto.id,
    titulo: dto.titleBase,
    slug: dto.slugBase,
    resumen: textoOpcional(dto.shortDescription),
    descripcionLarga: textoOpcional(dto.longDescription),
    modalidad: dto.modalityId ? ref(dto.modalityId) : null,
    categoriaPrincipal: dto.mainCategoryId ? ref(dto.mainCategoryId) : null,
    categorias: refs(dto.categoryIds),
    etiquetas: refs(dto.tagIds),
    destinatarios: refs(dto.recipientIds),
    eventosDeVida: refs(dto.lifeEventIds),
    activa: dto.active,
  };
}

/**
 * Form → request. `active` va SIEMPRE (es `@NotNull`), y las listas siempre como array: el PUT es
 * reemplazo total y un `null` vaciaría los puentes igual que `[]`, pero así el contrato queda explícito.
 * El slug se canonicaliza acá porque el backend no lo hace (a diferencia de `/api/tag`).
 */
export function toProcedureTemplateRequest(form: PlantillaFormValue): ProcedureTemplateRequestDTO {
  return {
    slugBase: canonicalizarSlug(form.slug),
    titleBase: form.titulo.trim(),
    shortDescription: textoOpcional(form.resumen),
    longDescription: textoOpcional(form.descripcionLarga),
    modalityId: form.modalidadId || null,
    mainCategoryId: form.categoriaPrincipalId || null,
    categoryIds: [...new Set(form.categoriaIds)],
    tagIds: [...new Set(form.etiquetaIds)],
    lifeEventIds: [...new Set(form.eventoDeVidaIds)],
    recipientIds: [...new Set(form.destinatarioIds)],
    active: form.activa,
  };
}
