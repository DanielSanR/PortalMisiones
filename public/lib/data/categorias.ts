import { MOCK_CATEGORIAS } from "@/mocks/mock-data"
import { USE_API } from "@/lib/config/env"
import * as api from "@/lib/api/categorias"
import type { Categoria } from "@/models/tramite.model"

export async function getCategorias(): Promise<Categoria[]> {
  if (USE_API) return api.getCategorias()

  const roots = MOCK_CATEGORIAS.filter((c) => c.parentId === null && c.activo).sort(
    (a, b) => a.orden - b.orden,
  )

  return roots.map((root) => ({
    ...root,
    children: MOCK_CATEGORIAS.filter((c) => c.parentId === root.id && c.activo).sort(
      (a, b) => a.orden - b.orden,
    ),
  }))
}

export async function getCategoriaBySlug(slug: string): Promise<Categoria | undefined> {
  if (USE_API) return api.getCategoriaBySlug(slug)

  const all = await getCategorias()
  for (const cat of all) {
    if (cat.slug === slug) return cat
    const child = cat.children?.find((c) => c.slug === slug)
    if (child) return child
  }
  return undefined
}

export async function getSubcategorias(parentId: number): Promise<Categoria[]> {
  if (USE_API) return api.getSubcategorias(parentId)

  return MOCK_CATEGORIAS.filter((c) => c.parentId === parentId && c.activo).sort(
    (a, b) => a.orden - b.orden,
  )
}
