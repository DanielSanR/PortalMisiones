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
    destinatarioId?: string
    localidadId?: string
    etiquetaId?: string
  }>
}

export default async function TramitesPage({ searchParams }: TramitesPageProps) {
  // TODO: remove — test-only delay to preview MLoader
  await new Promise((r) => setTimeout(r, 1500))

  const params = await searchParams

  const results = searchPublicTramites({
    search: params.search,
    organismoId: params.organismoId,
    modalidadId: params.modalidadId ? Number(params.modalidadId) : undefined,
    destinatarioId: params.destinatarioId ? Number(params.destinatarioId) : undefined,
    localidadId: params.localidadId ? Number(params.localidadId) : undefined,
    etiquetaId: params.etiquetaId ? Number(params.etiquetaId) : undefined,
  })

  return (
    <PortalShell>
      <main className="relative z-10">
        {/* Spacer — cataratas is pure background for this page, same as detail */}
        <div className="h-[360px] md:h-[400px]" />

        {/* Content — below cataratas fold */}
        <section id="detalle" className="scroll-mt-8 mx-auto max-w-[1440px] px-4 pb-16 md:px-10">
          {/* Breadcrumb */}
          <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-[#555]">
            <div className="flex items-center gap-1">
              <Link href="/" className="hover:text-[#2f6eb1]">Inicio</Link>
              <ChevronRight className="mx-1 inline h-3 w-3 text-[#2f6eb1]" />
              <span>Trámites</span>
            </div>
            <Link href="/tramites" className="font-medium text-[#2f6eb1] hover:text-[#264f82]">
              Ver todos
            </Link>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
            <h1 className="text-[32px] font-semibold tracking-[-0.03em] text-[#1a1a2e]">
              Catálogo de trámites
            </h1>
            <Badge className="rounded-full bg-[#2f6eb1]/10 px-5 py-2 text-sm text-[#2f6eb1]">{results.length} resultados</Badge>
          </div>

          <div className="mt-6 rounded-[24px] bg-white p-5 shadow-[0_12px_40px_rgba(33,72,114,0.08)] md:p-6">
            <SearchFilters
              search={params.search}
              organismoId={params.organismoId}
              modalidadId={params.modalidadId ? Number(params.modalidadId) : undefined}
              destinatarioId={params.destinatarioId ? Number(params.destinatarioId) : undefined}
              localidadId={params.localidadId ? Number(params.localidadId) : undefined}
              etiquetaId={params.etiquetaId ? Number(params.etiquetaId) : undefined}
            />
          </div>

          {results.length ? (
            <div className="mt-6 flex flex-wrap gap-4">
              {results.map((tramite) => (
                <TramiteCard key={tramite.id} tramite={tramite} />
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-[22px] border border-[#dbe2ee] bg-white px-6 py-10 text-center shadow-[0_12px_40px_rgba(33,72,114,0.08)]">
              <h2 className="text-2xl font-semibold text-slate-900">No encontramos trámites con esos filtros.</h2>
              <p className="mt-2 text-sm text-slate-600">
                Probá otra palabra clave o limpiá los filtros para ver el catálogo completo.
              </p>
            </div>
          )}
        </section>
      </main>
    </PortalShell>
  )
}
