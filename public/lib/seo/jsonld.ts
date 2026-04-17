import { SITE_NAME, SITE_URL, absoluteUrl } from "@/lib/seo/site"

type SchemaObject = Record<string, unknown>

export function organizationSchema(): SchemaObject {
  return {
    "@context": "https://schema.org",
    "@type": "GovernmentOrganization",
    name: SITE_NAME,
    url: SITE_URL,
    areaServed: { "@type": "AdministrativeArea", name: "Provincia de Misiones" },
    inLanguage: "es-AR",
    parentOrganization: {
      "@type": "GovernmentOrganization",
      name: "Gobierno de la Provincia de Misiones",
    },
  }
}

export interface BreadcrumbItem {
  name: string
  path: string
}

export function breadcrumbListSchema(items: BreadcrumbItem[]): SchemaObject {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  }
}
