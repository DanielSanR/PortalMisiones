import type { Metadata, Route } from "next"
import Link from "next/link"
import { Building2, ChevronRight, Globe } from "lucide-react"
import { PortalShellFixed as PortalShell } from "@/components/portal/portal-shell-fixed"
import { Badge } from "@/components/ui/badge"
import { getOrganismos, organismoSlug } from "@/lib/data/taxonomias"
import { getPublishedTramites } from "@/lib/data/tramites"

export const metadata: Metadata = {
  title: "Organismos provinciales",
  description: "Listado de organismos del Gobierno de Misiones con sus trámites públicos.",
  alternates: { canonical: "/organismos" },
  openGraph: {
    title: "Organismos provinciales",
    description: "Listado de organismos del Gobierno de Misiones con sus trámites públicos.",
    url: "/organismos",
    type: "website",
  },
}

export default async function OrganismosPage() {
  const [organismos, tramites] = await Promise.all([getOrganismos(), getPublishedTramites()])

  const countByOrganismoId = new Map<string, number>()
  for (const t of tramites) {
    countByOrganismoId.set(t.organismoId, (countByOrganismoId.get(t.organismoId) ?? 0) + 1)
  }

  return (
    <PortalShell>
      <main id="main-content" className="relative z-10">
        <div className="h-[360px] md:h-[400px]" />

        <section id="detalle" className="mx-auto max-w-[1440px] scroll-mt-8 px-4 pb-16 md:px-10">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1 text-sm text-[#555]">
            <Link href="/" className="hover:text-[#2f6eb1]">
              Inicio
            </Link>
            <ChevronRight className="mx-1 inline h-3 w-3 text-[#2f6eb1]" />
            <span className="text-[#555]">Organismos</span>
          </div>

          {/* Title */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
            <h1 className="text-[32px] font-semibold tracking-[-0.03em] text-[#1a1a2e]">
              Organismos provinciales
            </h1>
            <Badge className="rounded-full bg-[#2f6eb1]/10 px-5 py-2 text-sm text-[#2f6eb1]">
              {organismos.length} organismos
            </Badge>
          </div>

          <p className="mt-2 max-w-3xl text-[15px] text-slate-600">
            Accedé a los trámites y servicios publicados por cada organismo del Gobierno de la
            Provincia de Misiones.
          </p>

          {/* Grid de organismos */}
          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {organismos.map((organismo) => {
              const count = countByOrganismoId.get(organismo.id) ?? 0
              const slug = organismoSlug(organismo)
              return (
                <Link
                  key={organismo.id}
                  href={`/organismos/${slug}` as Route}
                  className="group flex min-h-[140px] flex-col justify-between rounded-[20px] border border-[#dbe2ee] bg-white p-5 shadow-[0_8px_24px_rgba(33,72,114,0.06)] transition-shadow hover:shadow-[0_16px_36px_rgba(33,72,114,0.12)]"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#2f6eb1]/10">
                      <Building2 className="h-5 w-5 text-[#2f6eb1]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="text-[16px] leading-6 font-semibold text-[#1a1a2e] group-hover:text-[#2f6eb1]">
                        {organismo.nombre}
                      </h2>
                      {organismo.sigla && (
                        <p className="mt-0.5 text-[12px] tracking-wide text-[#99a1af] uppercase">
                          {organismo.sigla}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between text-[13px] text-[#555]">
                    <span>
                      {count} {count === 1 ? "trámite" : "trámites"}
                    </span>
                    {organismo.sitioWeb && (
                      <span className="inline-flex items-center gap-1 text-[#2f6eb1]">
                        <Globe className="h-3.5 w-3.5" />
                        Sitio oficial
                      </span>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      </main>
    </PortalShell>
  )
}
