import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { SearchFilters } from "@/components/search-filters"
import { PortalShellFixed as PortalShell } from "@/components/portal-shell-fixed"
import { TramiteCard } from "@/components/tramite-card"
import { searchPublicTramites } from "@/lib/public-data"
import { Badge } from "@/components/ui/badge"

interface TramitesPageProps {
  searchParams: Promise<{
    search?: string
    organismoId?: string
    modalidadId?: string
    etiquetaId?: string
  }>
}

export default async function TramitesPage({ searchParams }: TramitesPageProps) {
  const params = await searchParams
  const results = searchPublicTramites({
    search: params.search,
    organismoId: params.organismoId,
    modalidadId: params.modalidadId ? Number(params.modalidadId) : undefined,
    etiquetaId: params.etiquetaId ? Number(params.etiquetaId) : undefined,
  })

  return (
    <PortalShell hero>
      <main className="relative z-10">
        {/* Breadcrumb */}
        <div className="mx-auto max-w-[1440px] px-4 pt-6 md:px-10">
          <div className="flex flex-wrap items-center justify-between gap-4 text-sm">
            <div className="text-white/80">
              <Link href="/" className="font-medium text-white hover:text-white/90">
                Inicio
              </Link>
              <ChevronRight className="mx-1 inline h-3 w-3" />
              <span className="text-white/60">Trámites</span>
            </div>
            <Link href="/tramites" className="font-medium text-white hover:text-white/90">
              Ver todos
            </Link>
          </div>
        </div>

        {/* Content */}
        <section className="mx-auto max-w-[1440px] px-4 pb-16 pt-6 md:px-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h1 className="text-[32px] font-semibold tracking-[-0.03em] text-white">
              Catálogo de trámites
            </h1>
            <Badge className="rounded-full bg-white/10 px-5 py-2 text-sm text-white">{results.length} resultados</Badge>
          </div>

          <div className="mt-6 rounded-[24px] bg-white p-5 shadow-[0_12px_40px_rgba(33,72,114,0.08)] md:p-6">
            <SearchFilters
              search={params.search}
              organismoId={params.organismoId}
              modalidadId={params.modalidadId ? Number(params.modalidadId) : undefined}
              etiquetaId={params.etiquetaId ? Number(params.etiquetaId) : undefined}
            />
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {results.length ? (
              results.map((tramite) => <TramiteCard key={tramite.id} tramite={tramite} />)
            ) : (
              <div className="col-span-full rounded-[22px] border border-[#dbe2ee] bg-white px-6 py-10 text-center shadow-[0_12px_40px_rgba(33,72,114,0.08)]">
                <h2 className="text-2xl font-semibold text-slate-900">No encontramos trámites con esos filtros.</h2>
                <p className="mt-2 text-sm text-slate-600">
                  Probá otra palabra clave o limpiá los filtros para ver el catálogo completo.
                </p>
              </div>
            )}
          </div>
        </section>
      </main>
    </PortalShell>
  )
}
