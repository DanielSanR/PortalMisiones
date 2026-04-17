import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { ArrowLeft, Building2, Clock, ChevronDown, ChevronRight, ExternalLink, FileText, Globe, MapPin, Phone, Tag, Users } from "lucide-react"
import { notFound } from "next/navigation"
import { PortalShellFixed as PortalShell } from "@/components/portal/portal-shell-fixed"
import { LocalidadSwitcher } from "@/components/portal/localidad-switcher"
import { OficinaMap } from "@/components/portal/oficina-map"
import { siteAssets } from "@/lib/site-assets"
import { getContenidoLocalidad, getTramiteBySlug } from "@/lib/data/tramites"
import { organismoSlug } from "@/lib/data/taxonomias"
import { SITE_NAME, SITE_URL } from "@/lib/seo/site"

interface TramiteDetailPageProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ localidad?: string }>
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const tramite = await getTramiteBySlug(slug)
  if (!tramite) return { title: "Trámite no encontrado", robots: { index: false, follow: false } }

  const description =
    tramite.resumen?.trim() ||
    tramite.descripcionLarga?.slice(0, 160).trim() ||
    `Información oficial sobre ${tramite.titulo}.`
  const url = `/tramites/${tramite.slug}`

  return {
    title: tramite.titulo,
    description,
    alternates: { canonical: url },
    openGraph: { title: tramite.titulo, description, url, type: "article" },
    twitter: { card: "summary", title: tramite.titulo, description },
  }
}

export default async function TramiteDetailPage({ params, searchParams }: TramiteDetailPageProps) {
  const { slug } = await params
  const sp = await searchParams
  const tramite = await getTramiteBySlug(slug)

  if (!tramite) notFound()

  const localidades = tramite.localidades ?? []
  const requestedId = sp.localidad ? Number(sp.localidad) : undefined
  const selectedLocalidad =
    (requestedId != null ? localidades.find((l) => l.id === requestedId) : undefined) ??
    localidades[0] ??
    null
  const contenido = selectedLocalidad
    ? await getContenidoLocalidad(tramite.id, selectedLocalidad.id)
    : undefined

  const hasStructuredSede = Boolean(
    contenido &&
      (contenido.direccion ||
        contenido.telefono ||
        contenido.horarios ||
        (contenido.latitud != null && contenido.longitud != null)),
  )

  const contactoNode = hasStructuredSede ? (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] text-[#555]">
        Sede de atención{selectedLocalidad ? ` en ${selectedLocalidad.nombre}` : ""}.
      </p>
      <div className="grid w-full gap-4 md:grid-cols-[1.1fr_1fr]">
        <ul className="flex min-w-0 flex-col gap-4 text-[14px] text-[#1e2939]">
          {contenido?.direccion && (
            <li className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-[#2f6eb1]" />
              <div>
                <p className="text-[11px] uppercase tracking-wide text-[#99a1af]">Dirección</p>
                <p className="leading-6">{contenido.direccion}</p>
              </div>
            </li>
          )}
          {contenido?.telefono && (
            <li className="flex items-start gap-3">
              <Phone className="mt-0.5 h-5 w-5 shrink-0 text-[#2f6eb1]" />
              <div>
                <p className="text-[11px] uppercase tracking-wide text-[#99a1af]">Teléfono</p>
                <a
                  href={`tel:${contenido.telefono.replace(/[^+\d]/g, "")}`}
                  className="leading-6 hover:text-[#2f6eb1]"
                >
                  {contenido.telefono}
                </a>
              </div>
            </li>
          )}
          {contenido?.horarios && (
            <li className="flex items-start gap-3">
              <Clock className="mt-0.5 h-5 w-5 shrink-0 text-[#2f6eb1]" />
              <div>
                <p className="text-[11px] uppercase tracking-wide text-[#99a1af]">Horarios</p>
                <p className="whitespace-pre-line leading-6">{contenido.horarios}</p>
              </div>
            </li>
          )}
          {contenido?.notas && (
            <li className="rounded-[12px] bg-[#eef5ff] px-3 py-2 text-[13px] leading-5 text-[#264f82]">
              {contenido.notas}
            </li>
          )}
        </ul>
        {contenido?.latitud != null && contenido?.longitud != null && (
          <OficinaMap
            latitud={contenido.latitud}
            longitud={contenido.longitud}
            nombre={`${tramite.organismo?.sigla ?? tramite.organismo?.nombre ?? "Sede"} — ${selectedLocalidad?.nombre ?? ""}`}
          />
        )}
      </div>
    </div>
  ) : null

  type AccordionSection = {
    title: string
    content: string | null
    isUrl: boolean
    node?: React.ReactNode
  }

  const accordionSections: AccordionSection[] = [
    {
      title: "Guía de Requisitos Generales",
      content: tramite.requisitos ?? tramite.descripcionLarga ?? null,
      isUrl: false,
    },
    {
      title: "Costos y modalidad de pago",
      content: contenido?.costos ?? tramite.costos ?? null,
      isUrl: false,
    },
    {
      title: "Formularios e instructivos",
      content: tramite.formularios ?? null,
      isUrl: false,
    },
    {
      title: "Contacto",
      content: contenido?.contacto ?? tramite.contacto ?? null,
      isUrl: false,
      node: contactoNode,
    },
    {
      title: "Sitio Web",
      content: contenido?.sitioWeb ?? tramite.sitioWebTramite ?? null,
      isUrl: true,
    },
  ]

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "GovernmentService",
    name: tramite.titulo,
    description: tramite.resumen ?? tramite.descripcionLarga ?? undefined,
    url: `${SITE_URL}/tramites/${tramite.slug}`,
    serviceType: tramite.modalidad?.nombre ?? undefined,
    inLanguage: "es-AR",
    provider: tramite.organismo?.nombre
      ? {
          "@type": "GovernmentOrganization",
          name: tramite.organismo.nombre,
        }
      : undefined,
    audience: tramite.destinatarios?.length
      ? tramite.destinatarios.map((d) => ({ "@type": "Audience", audienceType: d.nombre }))
      : undefined,
    areaServed: tramite.localidades?.length
      ? tramite.localidades.map((l) => ({ "@type": "City", name: l.nombre }))
      : { "@type": "AdministrativeArea", name: "Provincia de Misiones" },
    isPartOf: { "@type": "WebSite", name: SITE_NAME, url: SITE_URL },
    potentialAction: tramite.urlOficial
      ? { "@type": "Action", target: tramite.urlOficial, name: "Iniciar trámite" }
      : undefined,
  }

  return (
    <PortalShell>
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main id="main-content" className="relative z-10">
        {/*
          Spacer that fills the cataratas zone below the navbar.
          Cataratas band: h-[480px] md:h-[520px] (from PortalShell).
          Navbar height: ~120px. Remaining zone: ~360px / ~400px.
          This keeps the cataratas as pure background decoration,
          matching the Figma where all content starts below the fold.
        */}
        <div className="h-[360px] md:h-[400px]" />

        {/* ── All content below the cataratas fold ─────────────── */}
        <section id="detalle" className="scroll-mt-8 mx-auto max-w-[1440px] px-4 pb-16 md:px-10">

          {/* Breadcrumb + back link */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-1 text-sm text-[#555]">
              <Link href="/" className="hover:text-[#2f6eb1]">Inicio</Link>
              <ChevronRight className="mx-1 inline h-3 w-3 text-[#2f6eb1]" />
              <Link href="/tramites" className="hover:text-[#2f6eb1]">
                {tramite.organismo?.nombre ?? "Trámites"}
              </Link>
              <ChevronRight className="mx-1 inline h-3 w-3 text-[#2f6eb1]" />
              <span className="truncate max-w-[240px] text-[#555]">{tramite.titulo}</span>
            </div>
            <Link
              href="/tramites"
              className="flex items-center gap-2 text-[18px] font-semibold text-[#2f6eb1] hover:text-[#264f82]"
            >
              <ArrowLeft className="h-5 w-5" />
              Volver al Inicio
            </Link>
          </div>

          {/* Source label */}
          <p className="px-4 mt-3 text-[16px] font-light text-[#2f6eb1] pt-8">
            Información otorgada por{" "}
            {tramite.organismo ? (
              <Link
                href={`/organismos/${organismoSlug(tramite.organismo)}` as never}
                className="underline hover:text-[#264f82]"
              >
                {tramite.organismo.nombre}
              </Link>
            ) : (
              "—"
            )}
          </p>

          {/* Title */}
          <h1 className="px-4 mt-1 text-[24px] font-light leading-8 py-3 text-[rgba(0,0,0,0.87)]">
            {tramite.titulo}
          </h1>

          {/* Resumen */}
          {tramite.resumen && (
            <p className="px-4 mt-3 max-w-4xl text-[16px] font-light leading-6 text-[rgba(0,0,0,0.87)]">
              {tramite.resumen}
            </p>
          )}

          {/* Info cards */}
          <div className="mt-8 grid gap-4 md:grid-cols-3 mx-auto max-w-fit" >
            <div className="flex h-[73px] w-full md:w-[377px] items-center gap-3 rounded-[24px] border border-[#aeb3ba] bg-[#f9fafb] pl-[17px]">
              <Building2 className="h-5 w-5 shrink-0 text-[#2f6eb1]" />
              <div>
                <p className="text-[11px] leading-[16.5px] text-[#99a1af]">Organismo responsable</p>
                <p className="text-[14px] leading-[21px] text-[#1e2939]">
                  {tramite.organismo?.nombre ?? "—"}
                </p>
              </div>
            </div>

            <div className="flex h-[73px] w-full md:w-[377px] items-center gap-3 rounded-[24px] border border-[#aeb3ba] bg-[#f9fafb] pl-[17px]">
              <Tag className="h-5 w-5 shrink-0 text-[#2f6eb1]"  />
              <div>
                <p className="text-[11px] leading-[16.5px] text-[#99a1af]">Modalidad</p>
                <p className="text-[13px] font-semibold leading-[19.5px] text-[#2f6eb1]">
                  {tramite.modalidad?.nombre ?? "—"}
                </p>
              </div>
            </div>

            <div className="flex h-[73px] w-full md:w-[377px] items-center gap-3 rounded-[24px] border border-[#aeb3ba] bg-[#f9fafb] pl-[17px]">
              <Users className="h-5 w-5 shrink-0 text-[#2f6eb1]" />
              <div>
                <p className="text-[11px] leading-[16.5px] text-[#99a1af]">Destinatarios</p>
                <p className="text-[14px] leading-[21px] text-[#1e2939]">
                  {tramite.destinatarios?.map((d) => d.nombre).join(", ") || "Ciudadanos"}
                </p>
              </div>
            </div>
          </div>

          {/* Localidad + Iniciar trámite */}
          {localidades.length > 0 && selectedLocalidad && (
            <div className="mt-6 flex flex-wrap items-stretch justify-between gap-4">
              <div>
                <p className="text-[24px] text-[#1a1a2e]">
                  Localidad — {selectedLocalidad.nombre}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <span className="text-[18px] text-[#1a1a2e]">Cambiar localidad:</span>
                  <LocalidadSwitcher localidades={localidades} selectedId={selectedLocalidad.id} />
                </div>
              </div>
              <a
                href={contenido?.urlTramite ?? tramite.urlOficial ?? "#"}
                target="_blank"
                rel="noreferrer"
                className="self-end"
              >
                <button
                  type="button"
                  className="rounded-[8px]  min-w-[240px] bg-[#2f6eb1] px-6 py-3 text-[14px] font-bold text-white shadow-[0px_4px_16px_rgba(0,0,0,0.25)] hover:bg-[#264f82]"
                >
                  Iniciar trámite
                </button>

              </a>
            </div>
          )}

          {/* Extended description */}
          {tramite.descripcionLarga && (
            <p className="mt-6 text-[20px] font-light leading-[40px] text-[#1a1a2e]">
              {tramite.descripcionLarga}
            </p>
          )}

          {/* Accordion sections */}
          <div className="mt-6 flex flex-col gap-6">
            {accordionSections.map((section) => (
              <details
                key={section.title}
                className="group rounded-[24px] border border-[#aeb3ba] bg-white px-[29px] py-[21px]"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between [&::-webkit-details-marker]:hidden">
                  <span className="text-[20px] font-semibold text-[#1a1a2e]">{section.title}</span>
                  <ChevronDown className="h-4 w-4 shrink-0 text-slate-500 transition-transform group-open:rotate-180" />
                </summary>
                <div className="mt-4 text-sm leading-7 text-slate-600">
                  {section.node ? (
                    section.node
                  ) : section.content ? (
                    section.isUrl ? (
                      <a
                        href={section.content}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[#2f6eb1] underline hover:text-[#264f82]"
                      >
                        <Globe className="h-4 w-4 shrink-0" />
                        {section.content}
                      </a>
                    ) : (
                      <span className="whitespace-pre-line">{section.content}</span>
                    )
                  ) : (
                    <span className="text-slate-400">Información no disponible para este trámite.</span>
                  )}
                </div>
              </details>
            ))}
          </div>

          {/* CTA Banner */}
          <div
            className="relative mt-6 flex h-[125px] items-center justify-between overflow-hidden rounded-[24px] px-8 md:px-10"
            style={{ background: "linear-gradient(-79.11deg, #3b82c4 0.57%, #1565bf 51.24%, #0e4d8c 100%)" }}
          >
            <Image
              alt=""
              src={siteAssets.ui.mTransparentTramite}
              width={243}
              height={125}
              aria-hidden
              className="pointer-events-none absolute -bottom-0 -right-0 h-[125px] w-auto md:h-[125px]"
            />
            <div className="absolute -left-7 -top-12 h-[74px] w-[74px] rounded-full bg-white/10" />
            <div className="absolute bottom-[-10px] left-[281px] h-[74px] w-[74px] rounded-full bg-white/10" />

            <div className="relative flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/20">
                <FileText className="h-6 w-6 text-white" />
              </div>
              <span className="text-[20px] font-bold tracking-[1.4px] text-white md:text-[24px]">
                ¿Listo para iniciar tu trámite?
              </span>
            </div>

            <a href={contenido?.urlTramite ?? tramite.urlOficial ?? "#"} target="_blank" rel="noreferrer" className="relative">
              <button
                type="button"
                className="flex items-center min-w-[240px]  justify-center  gap-2 rounded-[8px] bg-white px-6 py-2.5 text-[15px] font-semibold text-[#2f6eb1] shadow-[0px_4px_20px_rgba(0,0,0,0.25)] hover:bg-slate-50"
              >
                Iniciar trámite
                <ExternalLink className="h-4 w-4" />
              </button>
            </a>
          </div>
        </section>
      </main>
    </PortalShell>
  )
}
