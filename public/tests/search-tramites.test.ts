import { describe, it, expect } from "vitest"
import { searchPublicTramites, getPublishedTramites } from "@/lib/data/tramites"

describe("searchPublicTramites (mock mode)", () => {
  it("solo devuelve trámites publicados", async () => {
    const all = await getPublishedTramites()
    expect(all.every((t) => t.estado === "publicado")).toBe(true)
  })

  it("búsqueda por texto es insensible a acentos y mayúsculas", async () => {
    const all = await getPublishedTramites()
    if (all.length === 0) return
    const sample = all[0]!
    const needle = sample.titulo.slice(0, 4).toUpperCase()
    const results = await searchPublicTramites({ search: needle })
    expect(results.some((t) => t.id === sample.id)).toBe(true)
  })

  it("filtra por organismoId", async () => {
    const all = await getPublishedTramites()
    const conOrganismo = all.find((t) => t.organismoId)
    if (!conOrganismo) return
    const results = await searchPublicTramites({ organismoId: conOrganismo.organismoId })
    expect(results.every((t) => t.organismoId === conOrganismo.organismoId)).toBe(true)
  })

  it("devuelve vacío cuando el filtro no matchea nada", async () => {
    const results = await searchPublicTramites({ search: "xxzzzqqwwnoexistenuncatramite" })
    expect(results).toEqual([])
  })
})
