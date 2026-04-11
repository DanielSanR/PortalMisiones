import Link from "next/link"
import Image from "next/image"
import { Building2, FileSearch, Landmark, Layers3 } from "lucide-react"
import { FeaturedShortcutCard } from "@/components/featured-shortcut-card"
import { HomeTopicCard } from "@/components/home-topic-card"
import { PortalShellFixed as PortalShell } from "@/components/portal-shell-fixed"
import { SearchFilters } from "@/components/search-filters"
import { Button } from "@/components/ui/button"
import { getFeaturedTramites, getPublishedTramites } from "@/lib/public-data"
import { siteAssets } from "@/lib/site-assets"

export default function HomePage() {
  const featured = getFeaturedTramites(5)
  const published = getPublishedTramites()

  const citizenTabs = [
    "Trámites para la Ciudadanía",
    "Trámites para Organizaciones y empresas",
    "Trámites para Organismos",
  ]

  const topicCards = [
    {
      title: "Automotor, transporte y tránsito",
      description: "Servicios relacionados con la compra, venta y registro de vehículos, permisos y certificados.",
      search: "Licencia de conducir",
      icon: "automotor" as const,
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
      description: "Trámites relacionados con obligaciones de pago y consultas fiscales.",
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
          {/* El grid define las columnas, pero la forma la define la tarjeta */}
          <div className="mt-5 flex flex-wrap justify-center gap-5">
            {featured.map((tramite, index) => (
              <FeaturedShortcutCard key={tramite.id} index={index} title={tramite.titulo} />
            ))}
          </div>
        </div>
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              {citizenTabs.map((item, index) => (
                <Button
                  key={item}
                  variant={index === 1 ? "default" : "outline"}
                  className="min-w-[326px] min-h-[56px] rounded-[16px] px-8 font-bold"
                >
                  {item}
                </Button>
              ))}
            </div>

            <div className="mt-12">
              <SearchFilters />
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {topicCards.slice(0, 4).map((card) => (
                <HomeTopicCard key={card.title} {...card} />
              ))}
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {topicCards.slice(4).map((card) => (
                <HomeTopicCard key={card.title} {...card} />
              ))}
            </div>

            <div className="mt-8 text-center">
              <Link href="/tramites" className="text-sm font-medium text-[#2b5f99] hover:text-[#234e80]">
                Ver todos
              </Link>
            </div>

            <div className="mt-14 grid gap-4 rounded-[24px] bg-[#f8fbff] p-5 md:grid-cols-4">
              <div className="rounded-[18px] bg-white p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#eef5ff] text-[#4f8ed2]">
                  <FileSearch className="h-5 w-5" />
                </div>
                <p className="mt-3 text-sm text-slate-500">Trámites publicados</p>
                <p className="mt-1 text-3xl font-semibold text-slate-900">{published.length}</p>
              </div>
              <div className="rounded-[18px] bg-white p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#eef5ff] text-[#4f8ed2]">
                  <Building2 className="h-5 w-5" />
                </div>
                <p className="mt-3 text-sm text-slate-500">Organismos conectados</p>
                <p className="mt-1 text-3xl font-semibold text-slate-900">7</p>
              </div>
              <div className="rounded-[18px] bg-white p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#eef5ff] text-[#4f8ed2]">
                  <Layers3 className="h-5 w-5" />
                </div>
                <p className="mt-3 text-sm text-slate-500">Modalidades</p>
                <p className="mt-1 text-3xl font-semibold text-slate-900">4</p>
              </div>
              <div className="rounded-[18px] bg-white p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#eef5ff] text-[#4f8ed2]">
                  <Landmark className="h-5 w-5" />
                </div>
                <p className="mt-3 text-sm text-slate-500">Acceso institucional</p>
                <p className="mt-1 text-3xl font-semibold text-slate-900">Oficial</p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </PortalShell>
  )
}
