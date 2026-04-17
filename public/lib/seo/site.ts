/**
 * Centraliza configuración de SEO y URLs absolutas.
 * Usar `SITE_URL` para canonicals, sitemap y JSON-LD.
 */

const FALLBACK_SITE_URL = "https://tramites.misiones.gob.ar"

export const SITE_URL: string =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? FALLBACK_SITE_URL

export const SITE_NAME = "Portal de Trámites de Misiones"

export const SITE_DESCRIPTION =
  "Punto único de acceso digital a trámites y servicios provinciales de Misiones."

export const SITE_LOCALE = "es_AR"

export function absoluteUrl(path: string): string {
  if (!path.startsWith("/")) return `${SITE_URL}/${path}`
  return `${SITE_URL}${path}`
}
