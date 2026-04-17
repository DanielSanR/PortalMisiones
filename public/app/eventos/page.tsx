import type { Metadata } from "next"
import Link from "next/link"
import { ChevronRight, Sparkles } from "lucide-react"
import { PortalShellFixed as PortalShell } from "@/components/portal/portal-shell-fixed"
import { Badge } from "@/components/ui/badge"
import { eventoSlug, getEventosDeVida } from "@/lib/data/taxonomias"
import { getTramitesByEventoId } from "@/lib/data/tramites"

export const metadata: Metadata = {
  title: "Eventos de vida",
  description:
    "Encontrá los trámites provinciales agrupados según los momentos de vida del ciudadano.",
  alternates: { canonical: "/eventos" },
  openGraph: {
    title: "Eventos de vida",
    description:
      "Encontrá los trámites provinciales agrupados según los momentos de vida del ciudadano.",
    url: "/eventos",
    type: "website",
  },
}

export default async function EventosPage() {
  const eventos = await getEventosDeVida()

  const counts = await Promise.all(eventos.map((e) => getTramitesByEventoId(e.id)))
  const countByEventoId = new Map<number, number>(
    eventos.map((e, i) => [e.id, counts[i].length]),
  )

  return (
    <PortalShell>
      <main id="main-content" className="relative z-10">
        <div className="h-[360px] md:h-[400px]" />

        <section id="detalle" className="scroll-mt-8 mx-auto max-w-[1440px] px-4 pb-16 md:px-10">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1 text-sm text-[#555]">
            <Link href="/" className="hover:text-[#2f6eb1]">Inicio</Link>
            <ChevronRight className="mx-1 inline h-3 w-3 text-[#2f6eb1]" />
            <span className="text-[#555]">Eventos de vida</span>
          </div>

          {/* Title */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
            <h1 className="text-[32px] font-semibold tracking-[-0.03em] text-[#1a1a2e]">
              Eventos de vida
            </h1>
            <Badge className="rounded-full bg-[#2f6eb1]/10 px-5 py-2 text-sm text-[#2f6eb1]">
              {eventos.length} eventos
            </Badge>
          </div>

          <p className="mt-2 max-w-3xl text-[15px] text-slate-600">
            Trámites agrupados según los momentos clave de la vida del ciudadano: nacer, estudiar,
            trabajar, acceder a vivienda y más.
          </p>

          {/* Grid de eventos */}
          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {eventos.map((evento) => {
              const count = countByEventoId.get(evento.id) ?? 0
              const slug = eventoSlug(evento)
              return (
                <Link
                  key={evento.id}
                  href={`/eventos/${slug}` as never}
                  className="group flex min-h-[160px] flex-col justify-between rounded-[20px] border border-[#dbe2ee] bg-white p-5 shadow-[0_8px_24px_rgba(33,72,114,0.06)] transition-shadow hover:shadow-[0_16px_36px_rgba(33,72,114,0.12)]"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
                      style={{ backgroundColor: `${evento.color}20` }}
                    >
                      <Sparkles className="h-5 w-5" style={{ color: evento.color }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="text-[16px] font-semibold leading-6 text-[#1a1a2e] group-hover:text-[#2f6eb1]">
                        {evento.nombre}
                      </h2>
                      {evento.descripcion && (
                        <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-[#555]">
                          {evento.descripcion}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 text-[13px] text-[#555]">
                    {count} {count === 1 ? "trámite" : "trámites"}
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
