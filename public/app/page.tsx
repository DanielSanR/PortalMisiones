import Link from "next/link"
import Image from "next/image"
import { FeaturedShortcutCard } from "@/components/featured-shortcut-card"
import { HomeTopicCard } from "@/components/home-topic-card"
import { PortalShellFixed as PortalShell } from "@/components/portal-shell-fixed"
import { SearchFilters } from "@/components/search-filters"
import { getFeaturedTramites } from "@/lib/public-data"
import { siteAssets } from "@/lib/site-assets"

export default function HomePage() {
  const featured = getFeaturedTramites(5)

  const citizenTabs = [
    { label: "Trámites para la Ciudadanía",               destinatarioId: 1 },
    { label: "Trámites para Organizaciones y empresas",   destinatarioId: 2 },
    { label: "Trámites para Organismos",                  destinatarioId: 3 },
  ]

  const topicCards = [
    {
      title: "Automotor, transporte y tránsito",
      description: "Servicios relacionados con la compra, venta y registro de vehículos, permi...",
      search: "Licencia de conducir",
      icon: "automotor" as const,
      href: "/tramites/categoria/automotor-transporte-transito",
    },
    {
      title: "Denuncias",
      description: "Denuncias ante irregularidades en servicios, en el sistema de salud o de abuso.",
      search: "Antecedentes",
      icon: "denuncias" as const,
    },
    {
      title: "Jubilaciones y pensiones",
      description: "Orientación para servicios de jubilaciones y pensiones.",
      search: "Jubilarse",
      icon: "jubilaciones" as const,
    },
    {
      title: "Impuestos, pagos y deudas",
      description: "Trámites relacionados con obligaciones de pago.",
      search: "Ingresos Brutos",
      icon: "impuestos" as const,
    },
    {
      title: "Actividades comerciales",
      description: "Trámites orientados a la producción de bienes y servicios para consumidores.",
      search: "Abrir un negocio",
      icon: "trabajo" as const,
    },
    {
      title: "Vivienda",
      description: "Gestiones sobre programas habitacionales, inscripciones y documentación de hogar.",
      search: "Vivienda",
      icon: "vivienda" as const,
    },
  ]

  return (
    <PortalShell hero>
      <main className="relative z-10">
        <section className="relative pb-20 pt-24 md:pb-28 md:pt-28">
          <Image
            alt="Cataratas del Iguazú"
            src={siteAssets.heroCataratas}
            fill
            priority
            className="object-cover"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(16,29,44,0.18),rgba(16,29,44,0.72)),linear-gradient(180deg,rgba(56,95,137,0.32),rgba(41,72,109,0.42))]" />
          <div className="relative z-10 mx-auto max-w-[1440px] px-4 md:px-10">
            <SearchFilters hero />
          </div>
        </section>

        <section className="-mt-8 rounded-t-[32px] bg-white pb-16 pt-8 shadow-[0_-20px_60px_rgba(18,45,79,0.08)]">
          <div className="mx-auto max-w-[1440px] px-4 md:px-10">
                <div>
          <h2 className="text-[22px] font-bold tracking-[-0.03em] text-slate-900 pt-6">
            Lo más buscado
          </h2>
          <div className="mt-5 flex flex-wrap justify-center gap-5">
            {featured.map((tramite, index) => (
              <FeaturedShortcutCard key={tramite.id} index={index} title={tramite.titulo} />
            ))}
          </div>
        </div>
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              {citizenTabs.map((tab, index) => (
                <Link
                  key={tab.destinatarioId}
                  href={`/tramites?destinatarioId=${tab.destinatarioId}`}
                  className={`inline-flex min-h-[56px] min-w-[326px] items-center justify-center rounded-[16px] px-8 text-[17px] font-bold tracking-wide transition-colors ${
                    index === 0
                      ? "bg-[#2f6eb1] text-white hover:bg-[#264f82]"
                      : "border border-[#2f6eb1] bg-white text-[#2f6eb1] hover:bg-[#eef5ff]"
                  }`}
                >
                  {tab.label}
                </Link>
              ))}
            </div>

            <div className="mt-12">
              <SearchFilters />
            </div>

            <div className="mt-5 flex flex-wrap gap-4">
              {topicCards.map((card) => (
                <div key={card.title} className="w-full sm:w-[calc(50%-8px)] xl:w-[328px]">
                  <HomeTopicCard {...card} />
                </div>
              ))}
            </div>

            <div className="mt-8 text-center">
              <Link href="/tramites" className="text-sm font-medium text-[#2b5f99] hover:text-[#234e80]">
                Ver todos
              </Link>
            </div>
          </div>
        </section>
      </main>
    </PortalShell>
  )
}
