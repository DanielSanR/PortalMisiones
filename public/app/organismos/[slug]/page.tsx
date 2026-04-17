import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft, Building2, ChevronRight, Globe } from "lucide-react"
import { notFound } from "next/navigation"
import { PortalShellFixed as PortalShell } from "@/components/portal/portal-shell-fixed"
import { TramiteCard } from "@/components/portal/tramite-card"
import { Badge } from "@/components/ui/badge"
import { getOrganismoBySlug } from "@/lib/data/taxonomias"
import { getTramitesByOrganismoId } from "@/lib/data/tramites"

interface OrganismoPageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: OrganismoPageProps): Promise<Metadata> {
  const { slug } = await params
  const organismo = await getOrganismoBySlug(slug)
  if (!organismo) {
    return { title: "Organismo no encontrado", robots: { index: false, follow: false } }
  }

  const description = `Trámites provinciales a cargo de ${organismo.nombre}.`
  const url = `/organismos/${slug}`

  return {
    title: organismo.nombre,
    description,
    alternates: { canonical: url },
    openGraph: { title: organismo.nombre, description, url, type: "website" },
  }
}

export default async function OrganismoPage({ params }: OrganismoPageProps) {
  const { slug } = await params
  const organismo = await getOrganismoBySlug(slug)
  if (!organismo) notFound()

  const tramites = await getTramitesByOrganismoId(organismo.id)

  return (
    <PortalShell>
      <main id="main-content" className="relative z-10">
        <div className="h-[360px] md:h-[400px]" />

        <section id="detalle" className="scroll-mt-8 mx-auto max-w-[1440px] px-4 pb-16 md:px-10">
          {/* Breadcrumb + back */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-1 text-sm text-[#555]">
              <Link href="/" className="hover:text-[#2f6eb1]">Inicio</Link>
              <ChevronRight className="mx-1 inline h-3 w-3 text-[#2f6eb1]" />
              <span className="text-[#555]">Organismos</span>
              <ChevronRight className="mx-1 inline h-3 w-3 text-[#2f6eb1]" />
              <span className="truncate max-w-[320px] text-[#555]">{organismo.nombre}</span>
            </div>
            <Link
              href="/"
              className="flex items-center gap-2 text-[18px] font-semibold text-[#2f6eb1] hover:text-[#264f82]"
            >
              <ArrowLeft className="h-5 w-5" />
              Volver al Inicio
            </Link>
          </div>

          {/* Title + sigla + sitio web */}
          <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#2f6eb1]/10">
                <Building2 className="h-6 w-6 text-[#2f6eb1]" />
              </div>
              <div>
                <h1 className="text-[28px] font-medium leading-9 text-[#1a1a2e]">
                  {organismo.nombre}
                </h1>
                {organismo.sigla && (
                  <p className="mt-1 text-[14px] text-[#555]">{organismo.sigla}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge className="rounded-full bg-[#2f6eb1]/10 px-5 py-2 text-sm text-[#2f6eb1]">
                {tramites.length} trámites
              </Badge>
              {organismo.sitioWeb && (
                <a
                  href={organismo.sitioWeb}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-[10px] border border-[#2f6eb1] px-4 py-2 text-sm font-medium text-[#2f6eb1] hover:bg-[#eef5ff]"
                >
                  <Globe className="h-4 w-4" />
                  Sitio oficial
                </a>
              )}
            </div>
          </div>

          {/* Lista de trámites */}
          {tramites.length > 0 ? (
            <div className="mt-8 flex flex-wrap gap-4">
              {tramites.map((tramite) => (
                <TramiteCard key={tramite.id} tramite={tramite} />
              ))}
            </div>
          ) : (
            <div className="mt-8 rounded-[22px] border border-[#dbe2ee] bg-white px-6 py-10 text-center">
              <p className="text-[16px] font-semibold text-slate-900">
                Este organismo aún no tiene trámites publicados.
              </p>
              <p className="mt-2 text-sm text-slate-600">
                Consultá el catálogo completo en{" "}
                <Link href="/tramites" className="text-[#2f6eb1] underline">
                  Trámites
                </Link>
                .
              </p>
            </div>
          )}
        </section>
      </main>
    </PortalShell>
  )
}
