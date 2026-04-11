import Link from "next/link"
import { Building2, ChevronDown, ChevronRight, FileText, Globe, MapPin, MapPinned, Users } from "lucide-react"
import { notFound } from "next/navigation"
import { PortalShellFixed as PortalShell } from "@/components/portal-shell-fixed"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { getTramiteBySlug } from "@/lib/public-data"

interface TramiteDetailPageProps {
  params: Promise<{
    slug: string
  }>
}

export default async function TramiteDetailPage({ params }: TramiteDetailPageProps) {
  const { slug } = await params
  const tramite = getTramiteBySlug(slug)

  if (!tramite) {
    notFound()
  }

  const accordionSections = [
    { title: "Guía de Requisitos Generales", icon: FileText },
    { title: "Costos y modalidad de pago", icon: FileText },
    { title: "Formularios e instructivos", icon: FileText },
    { title: "Contacto", icon: MapPinned },
    { title: "Sitio Web", icon: Globe },
  ]

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
              <Link href="/tramites" className="font-medium text-white hover:text-white/90">
                {tramite.organismo?.nombre ?? "Automotor, transporte y tránsito"}
              </Link>
              <ChevronRight className="mx-1 inline h-3 w-3" />
              <span className="text-white/60">{tramite.titulo}</span>
            </div>
            <Link href="/tramites" className="font-medium text-white hover:text-white/90">
              Volver al inicio
            </Link>
          </div>
        </div>

        {/* Main content area */}
        <section className="mx-auto max-w-[1440px] px-4 pb-16 pt-6 md:px-10">
          <div className="rounded-[24px] bg-white p-6 shadow-[0_12px_40px_rgba(33,72,114,0.08)] md:p-8">
            {/* Source label */}
            <p className="text-center text-sm font-medium text-[#4f8ed2]">
              Información otorgada por {tramite.organismo?.nombre ?? "Ministerio de Transporte"}
            </p>

            {/* Title */}
            <h1 className="mt-3 text-center text-[28px] font-semibold tracking-[-0.02em] text-slate-900 md:text-[32px]">
              {tramite.titulo}
            </h1>

            {/* Description */}
            <p className="mx-auto mt-4 max-w-4xl text-center text-[15px] leading-7 text-slate-600">
              {tramite.resumen ??
                "Por medio de este Certificado se otorga legalidad al documento provisto por el organismo competente con el objeto de brindar constancia de la validez de una Licencia de Conducir y de los datos contenidos en ella."}
            </p>

            {/* Metadata bar */}
            <div className="mt-8 grid gap-4 border-y border-slate-100 py-5 md:grid-cols-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#eef5ff] text-[#4f8ed2]">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-slate-400">Organismo responsable</p>
                  <p className="text-sm font-medium text-slate-900">{tramite.organismo?.nombre ?? "Dirección de Transporte"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#eef5ff] text-[#4f8ed2]">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-slate-400">Modalidad</p>
                  <p className="text-sm font-medium text-slate-900">{tramite.modalidad?.nombre ?? "Digital con instancia presencial"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#eef5ff] text-[#4f8ed2]">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-slate-400">Destinatarios</p>
                  <p className="text-sm font-medium text-slate-900">Ciudadanos</p>
                </div>
              </div>
            </div>

            {/* Localidad section */}
            <div className="mt-6">
              <h2 className="text-lg font-semibold text-slate-900">Localidad - Posadas</h2>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <span className="text-sm text-slate-500">Cambiar localidad:</span>
                <div className="relative">
                  <select className="h-[43px] w-[264px] appearance-none rounded-lg border border-slate-200 bg-white px-3 pr-10 text-sm text-slate-700 focus:border-[#4f8ed2] focus:outline-none focus:ring-1 focus:ring-[#4f8ed2]">
                    <option>Posadas</option>
                    <option>Oberá</option>
                    <option>Apóstoles</option>
                    <option>Iguazú</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>
              </div>
            </div>

            {/* Extended description */}
            <p className="mt-6 text-sm leading-7 text-slate-600">
              {tramite.descripcionLarga ??
                "Este trámite permite obtener la Licencia Nacional de Conducir según Ley Provincial N° 19.733 en adhesión a la Ley Nacional N° 24.449."}
            </p>

            {/* Accordion sections */}
            <div className="mt-8 divide-y divide-slate-100">
              {accordionSections.map((section) => (
                <details key={section.title} className="group">
                  <summary className="flex cursor-pointer items-center justify-between py-5 text-[15px] font-medium text-slate-900 hover:text-[#4f8ed2] [&::-webkit-details-marker]:hidden">
                    {section.title}
                    <ChevronDown className="h-5 w-5 text-slate-400 transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="pb-5 text-sm leading-7 text-slate-600">
                    Información estructurada para esta sección del trámite.
                  </div>
                </details>
              ))}
            </div>
          </div>

          {/* Tags */}
          {tramite.etiquetas.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2">
              {tramite.etiquetas.map((etiqueta) => (
                <Badge key={etiqueta.id} variant="muted" className="rounded-full px-4 py-2">
                  {etiqueta.nombre}
                </Badge>
              ))}
            </div>
          )}
        </section>
      </main>
    </PortalShell>
  )
}
