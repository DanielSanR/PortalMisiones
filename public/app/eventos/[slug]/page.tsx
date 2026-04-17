import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft, ChevronRight, Sparkles } from "lucide-react"
import { notFound } from "next/navigation"
import { PortalShellFixed as PortalShell } from "@/components/portal/portal-shell-fixed"
import { TramiteCard } from "@/components/portal/tramite-card"
import { Badge } from "@/components/ui/badge"
import { getEventoDeVidaBySlug } from "@/lib/data/taxonomias"
import { getTramitesByEventoId } from "@/lib/data/tramites"

interface EventoPageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: EventoPageProps): Promise<Metadata> {
  const { slug } = await params
  const evento = await getEventoDeVidaBySlug(slug)
  if (!evento) {
    return { title: "Evento de vida no encontrado", robots: { index: false, follow: false } }
  }

  const description =
    evento.descripcion?.trim() ||
    `Trámites provinciales vinculados al evento de vida ${evento.nombre.toLowerCase()}.`
  const url = `/eventos/${slug}`

  return {
    title: evento.nombre,
    description,
    alternates: { canonical: url },
    openGraph: { title: evento.nombre, description, url, type: "website" },
  }
}

export default async function EventoPage({ params }: EventoPageProps) {
  const { slug } = await params
  const evento = await getEventoDeVidaBySlug(slug)
  if (!evento) notFound()

  const tramites = await getTramitesByEventoId(evento.id)

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
              <span className="text-[#555]">Eventos de vida</span>
              <ChevronRight className="mx-1 inline h-3 w-3 text-[#2f6eb1]" />
              <span className="truncate max-w-[320px] text-[#555]">{evento.nombre}</span>
            </div>
            <Link
              href="/"
              className="flex items-center gap-2 text-[18px] font-semibold text-[#2f6eb1] hover:text-[#264f82]"
            >
              <ArrowLeft className="h-5 w-5" />
              Volver al Inicio
            </Link>
          </div>

          {/* Title */}
          <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: `${evento.color}20` }}
              >
                <Sparkles className="h-6 w-6" style={{ color: evento.color }} />
              </div>
              <div>
                <h1 className="text-[28px] font-medium leading-9 text-[#1a1a2e]">
                  {evento.nombre}
                </h1>
                {evento.descripcion && (
                  <p className="mt-1 max-w-3xl text-[14px] text-[#555]">{evento.descripcion}</p>
                )}
              </div>
            </div>
            <Badge className="rounded-full bg-[#2f6eb1]/10 px-5 py-2 text-sm text-[#2f6eb1]">
              {tramites.length} trámites
            </Badge>
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
                Todavía no hay trámites vinculados a este evento de vida.
              </p>
              <p className="mt-2 text-sm text-slate-600">
                Mirá el catálogo completo en{" "}
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
