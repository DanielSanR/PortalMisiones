import type { MetadataRoute } from "next"
import { getCategorias, getSubcategorias } from "@/lib/data/categorias"
import { getPublishedTramites } from "@/lib/data/tramites"
import {
  eventoSlug,
  getEventosDeVida,
  getOrganismos,
  organismoSlug,
} from "@/lib/data/taxonomias"
import { SITE_URL } from "@/lib/seo/site"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  const [tramites, rootCategorias, organismos, eventos] = await Promise.all([
    getPublishedTramites(),
    getCategorias(),
    getOrganismos(),
    getEventosDeVida(),
  ])

  const subcategorias = (
    await Promise.all(rootCategorias.map((c) => getSubcategorias(c.id)))
  ).flat()

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`,           lastModified: now, changeFrequency: "weekly",  priority: 1.0 },
    { url: `${SITE_URL}/tramites`,   lastModified: now, changeFrequency: "daily",   priority: 0.9 },
    { url: `${SITE_URL}/organismos`, lastModified: now, changeFrequency: "weekly",  priority: 0.7 },
    { url: `${SITE_URL}/eventos`,    lastModified: now, changeFrequency: "weekly",  priority: 0.7 },
  ]

  const categoriaEntries: MetadataRoute.Sitemap = rootCategorias.map((c) => ({
    url: `${SITE_URL}/tramites/categoria/${c.slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.7,
  }))

  const subcategoriaEntries: MetadataRoute.Sitemap = subcategorias
    .filter((s) => s.parentId !== null)
    .map((s) => {
      const parent = rootCategorias.find((c) => c.id === s.parentId)
      if (!parent) return null
      return {
        url: `${SITE_URL}/tramites/categoria/${parent.slug}?sub=${s.slug}`,
        lastModified: now,
        changeFrequency: "weekly" as const,
        priority: 0.6,
      }
    })
    .filter((e): e is NonNullable<typeof e> => e !== null)

  const tramiteEntries: MetadataRoute.Sitemap = tramites.map((t) => ({
    url: `${SITE_URL}/tramites/${t.slug}`,
    lastModified: t.updatedAt ? new Date(t.updatedAt) : now,
    changeFrequency: "monthly",
    priority: 0.8,
  }))

  const organismoEntries: MetadataRoute.Sitemap = organismos.map((o) => ({
    url: `${SITE_URL}/organismos/${organismoSlug(o)}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.6,
  }))

  const eventoEntries: MetadataRoute.Sitemap = eventos.map((e) => ({
    url: `${SITE_URL}/eventos/${eventoSlug(e)}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.6,
  }))

  return [
    ...staticEntries,
    ...categoriaEntries,
    ...subcategoriaEntries,
    ...tramiteEntries,
    ...organismoEntries,
    ...eventoEntries,
  ]
}
