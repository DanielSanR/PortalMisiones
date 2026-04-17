import type { Categoria } from "@/models/tramite.model"
import { apiGet, apiGetOptional } from "./client"
import { tags } from "./tags"

export async function getCategorias(): Promise<Categoria[]> {
  return apiGet<Categoria[]>("/categorias", {
    query: { activo: true, tree: true },
    tags: [tags.categorias()],
  })
}

export async function getCategoriaBySlug(slug: string): Promise<Categoria | undefined> {
  return apiGetOptional<Categoria>(`/categorias/${encodeURIComponent(slug)}`, {
    tags: [tags.categoria(slug)],
  })
}

export async function getSubcategorias(parentId: number): Promise<Categoria[]> {
  return apiGet<Categoria[]>(`/categorias/${parentId}/subcategorias`, {
    query: { activo: true },
    tags: [tags.subcategorias(parentId)],
  })
}
