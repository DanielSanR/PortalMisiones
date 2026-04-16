import Link from "next/link"
import {
  ArrowLeft,
  ChevronRight,
  CreditCard,
  Scale,
  Receipt,
  CheckSquare,
  Car,
  BookOpen,
  Banknote,
  ShieldCheck,
  FileText,
  Building2,
  RefreshCw,
  type LucideIcon,
} from "lucide-react"
import { notFound } from "next/navigation"
import { PortalShellFixed as PortalShell } from "@/components/portal-shell-fixed"
import { SearchFilters } from "@/components/search-filters"
import { SubcategoriaCard } from "@/components/subcategoria-card"
import { TramiteCard } from "@/components/tramite-card"
import {
  getCategoriaBySlug,
  getSubcategorias,
  getTramitesByCategoriaId,
} from "@/lib/public-data"
import type { Categoria, Tramite } from "@/models/tramite.model"

// Map Material icon names → lucide-react
const lucideIconMap: Record<string, LucideIcon> = {
  card_membership: CreditCard,
  gavel:           Scale,
  receipt_long:    Receipt,
  approval:        CheckSquare,
  directions_car:  Car,
  school:          BookOpen,
  payments:        Banknote,
  security:        ShieldCheck,
  storefront:      Building2,
  autorenew:       RefreshCw,
}

function getIcon(icono: string | null): LucideIcon {
  return (icono ? lucideIconMap[icono] : undefined) ?? FileText
}

// Modalidad → etiqueta corta para la pill del card (figma: "Online" / "Presencial")
function shortModalidadLabel(modalidadId: number | undefined): string | null {
  switch (modalidadId) {
    case 1: return "Online"          // Digital de punta a punta
    case 2: return "Mixto"           // Digital con instancia presencial
    case 3: return "Presencial"      // Presencial con apoyo digital
    case 4: return "Informativo"     // Informativo / derivación
    default: return null
  }
}

// Modalidad más frecuente entre los trámites de una subcategoría
function dominantModalidad(tramites: Tramite[]): number | undefined {
  if (!tramites.length) return undefined
  const counts = new Map<number, number>()
  for (const t of tramites) counts.set(t.modalidadId, (counts.get(t.modalidadId) ?? 0) + 1)
  let bestId: number | undefined
  let bestCount = -1
  for (const [id, count] of counts) {
    if (count > bestCount) { bestId = id; bestCount = count }
  }
  return bestId
}

// Etiquetas únicas (top 3) entre los trámites de una subcategoría
function topEtiquetas(tramites: Tramite[], limit = 3): { id: number; nombre: string }[] {
  const seen = new Map<number, string>()
  for (const t of tramites) {
    for (const e of t.etiquetas) if (!seen.has(e.id)) seen.set(e.id, e.nombre)
    if (seen.size >= limit) break
  }
  return [...seen.entries()].slice(0, limit).map(([id, nombre]) => ({ id, nombre }))
}

function applyFilters(tramites: Tramite[], filters: {
  search?: string
  organismoId?: string
  modalidadId?: number
  destinatarioId?: number
  localidadId?: number
  etiquetaId?: number
}): Tramite[] {
  const query = filters.search?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  return tramites.filter((t) => {
    if (filters.organismoId && t.organismoId !== filters.organismoId) return false
    if (filters.modalidadId && t.modalidadId !== filters.modalidadId) return false
    if (filters.destinatarioId && !(t.destinatarios ?? []).some((d) => d.id === filters.destinatarioId)) return false
    if (filters.localidadId && !(t.localidades ?? []).some((l) => l.id === filters.localidadId)) return false
    if (filters.etiquetaId && !t.etiquetas.some((e) => e.id === filters.etiquetaId)) return false
    if (query) {
      const haystack = [t.titulo, t.resumen ?? "", t.descripcionLarga ?? "", t.organismo?.nombre ?? "",
        ...t.etiquetas.map((e) => e.nombre)].join(" ").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      if (!haystack.includes(query)) return false
    }
    return true
  })
}

interface CategoriaPageProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<{
    sub?: string
    search?: string
    organismoId?: string
    modalidadId?: string
    destinatarioId?: string
    localidadId?: string
    etiquetaId?: string
  }>
}

export default async function CategoriaPage({ params, searchParams }: CategoriaPageProps) {
  // TODO: remove — test-only delay to preview MLoader
  await new Promise((r) => setTimeout(r, 1500))

  const { slug } = await params
  const sp = await searchParams

  const categoria = getCategoriaBySlug(slug)
  if (!categoria || categoria.parentId !== null) notFound()

  const filters = {
    search:         sp.search,
    organismoId:    sp.organismoId,
    modalidadId:    sp.modalidadId    ? Number(sp.modalidadId)    : undefined,
    destinatarioId: sp.destinatarioId ? Number(sp.destinatarioId) : undefined,
    localidadId:    sp.localidadId    ? Number(sp.localidadId)    : undefined,
    etiquetaId:     sp.etiquetaId     ? Number(sp.etiquetaId)     : undefined,
  }

  const subcategorias = getSubcategorias(categoria.id)
  const selectedSub: Categoria | undefined = sp.sub
    ? (subcategorias.find((s) => s.slug === sp.sub) ?? subcategorias[0])
    : subcategorias[0]

  const tramites = selectedSub
    ? applyFilters(getTramitesByCategoriaId(selectedSub.id), filters)
    : []

  return (
    <PortalShell>
      <main className="relative z-10">
        {/* Spacer — cataratas pure background */}
        <div className="h-[360px] md:h-[400px]" />

        <section id="detalle" className="scroll-mt-8 mx-auto max-w-[1440px] px-4 pb-16 md:px-10">

          {/* Breadcrumb + back */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-1 text-sm text-[#555]">
              <Link href="/" className="hover:text-[#2f6eb1]">Inicio</Link>
              <ChevronRight className="mx-1 inline h-3 w-3 text-[#2f6eb1]" />
              <Link href="/tramites" className="hover:text-[#2f6eb1]">Trámites</Link>
              <ChevronRight className="mx-1 inline h-3 w-3 text-[#2f6eb1]" />
              <span className="truncate max-w-[240px] text-[#555]">{categoria.nombre}</span>
              {selectedSub && (
                <>
                  <ChevronRight className="mx-1 inline h-3 w-3 text-[#2f6eb1]" />
                  <span className="truncate max-w-[280px] text-[#555]">{selectedSub.nombre}</span>
                </>
              )}
            </div>
            <Link
              href="/"
              className="flex items-center gap-2 text-[18px] font-semibold text-[#2f6eb1] hover:text-[#264f82]"
            >
              <ArrowLeft className="h-5 w-5" />
              Volver al Inicio
            </Link>
          </div>

          {/* Category title */}
          <h1 className="mt-6 text-[24px] font-medium leading-[40px] text-[#1a1a2e]">
            {categoria.nombre}
          </h1>

          {/* ── Filters (reusa SearchFilters) ──────────────────── */}
          <div className="mt-4">
            <SearchFilters
              basePath={`/tramites/categoria/${categoria.slug}`}
              preserveParams={{ sub: selectedSub?.slug }}
              hideHeading
              search={filters.search}
              organismoId={filters.organismoId}
              modalidadId={filters.modalidadId}
              destinatarioId={filters.destinatarioId}
              localidadId={filters.localidadId}
              etiquetaId={filters.etiquetaId}
            />
          </div>

          {/* ── Subcategory cards (estilo Figma: horizontal, 328×154 fijo) ── */}
          {subcategorias.length > 0 && (
            <div className="mt-8 flex flex-wrap gap-4">
              {subcategorias.map((subcat) => {
                const subTramites = getTramitesByCategoriaId(subcat.id)
                return (
                  <SubcategoriaCard
                    key={subcat.id}
                    href={`/tramites/categoria/${categoria.slug}?sub=${subcat.slug}`}
                    icon={getIcon(subcat.icono)}
                    title={subcat.nombre}
                    description={subcat.descripcion ?? `Trámites de ${subcat.nombre.toLowerCase()}.`}
                    badge={shortModalidadLabel(dominantModalidad(subTramites))}
                    chips={topEtiquetas(subTramites, 3)}
                    selected={selectedSub?.id === subcat.id}
                  />
                )
              })}
            </div>
          )}

          {/* Divider */}
          {selectedSub && <div className="mt-10 h-0.5 w-full   bg-[#2F6EB1]" />}

          {/* ── Trámites for selected subcategory ─────────────── */}
          {selectedSub && (
            <div className="mt-6">
              <h2 className="text-[24px] font-normal leading-[40px] text-[#1a1a2e]">Trámites</h2>

              {tramites.length > 0 ? (
                <div className="mt-5 flex flex-wrap gap-4">
                  {tramites.map((tramite) => (
                    <TramiteCard key={tramite.id} tramite={tramite} />
                  ))}
                </div>
              ) : (
                <div className="mt-5 rounded-[22px] border border-[#dbe2ee] bg-white px-6 py-10 text-center">
                  <p className="text-[16px] font-semibold text-slate-900">
                    No hay trámites disponibles con esos filtros.
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    Probá limpiar los filtros o seleccioná otra subcategoría.
                  </p>
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </PortalShell>
  )
}
