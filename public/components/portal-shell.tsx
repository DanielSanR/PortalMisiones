import Image from "next/image"
import Link from "next/link"
import { MapPin, Phone } from "lucide-react"
import { siteAssets } from "@/lib/site-assets"

interface PortalShellProps {
  children: React.ReactNode
  hero?: boolean
}

export function PortalShell({ children, hero = false }: PortalShellProps) {
  return (
    <div className="min-h-screen bg-[#f7f8fb] text-slate-900">
      <div className="relative overflow-hidden">
        <header className={`${hero ? "absolute inset-x-0 top-0" : "relative"} z-20 px-4 py-5 md:px-10`}>
          <div className="mx-auto flex max-w-[1440px] items-center justify-between rounded-full bg-[#4f8ed2] px-6 py-6 shadow-[0_18px_40px_rgba(38,92,151,0.28)]">
            <Link href="/" className="flex items-center">
              <div className="relative h-[34px] w-[208px]">
                <Image
                  alt="Misiones Gobierno"
                  src={siteAssets.logos.misionesMain}
                  fill
                  className="object-contain object-left"
                  sizes="208px"
                />
              </div>
            </Link>

            <nav className="hidden items-center gap-6 text-sm font-medium text-white md:flex">
              <Link className="transition-colors hover:text-white/80" href="/">Inicio</Link>
              <Link className="transition-colors hover:text-white/80" href="/tramites">Trámites</Link>
              <a className="transition-colors hover:text-white/80" href="/tramites#temas">Temas</a>
              <a className="transition-colors hover:text-white/80" href="/tramites">Organismos</a>
              <a className="transition-colors hover:text-white/80" href="/tramites">Mi Portal</a>
            </nav>
          </div>
        </header>

        {children}
      </div>

      <footer className="bg-[#4f8ed2] text-white">
        <div className="mx-auto max-w-[1440px] px-4 pb-5 pt-8 md:px-10">
          <div className="mb-8 flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="relative h-[51px] w-[212px]">
                <Image
                  alt="Misiones Gobierno"
                  src={siteAssets.logos.misionesMain}
                  fill
                  className="object-contain object-left"
                  sizes="212px"
                />
              </div>
              <div className="mt-5 flex items-center gap-[10px]">
                <Image alt="Instagram" src={siteAssets.ui.socialInstagram} width={24} height={24} className="h-6 w-6" />
                <span className="text-sm font-medium">X</span>
                <Image alt="YouTube" src={siteAssets.ui.socialYoutube} width={24} height={24} className="h-6 w-6" />
                <Image alt="Facebook" src={siteAssets.ui.socialFacebook} width={24} height={24} className="h-6 w-6" />
                <Image alt="WhatsApp" src={siteAssets.ui.socialWhatsapp} width={24} height={24} className="h-6 w-6" />
                <Image alt="LinkedIn" src={siteAssets.ui.socialLinkedin} width={24} height={24} className="h-6 w-6" />
              </div>
            </div>
          </div>

          <div className="rounded-[22px] bg-white px-5 py-4 text-sm text-slate-600 shadow-[0_14px_40px_rgba(16,51,92,0.15)]">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-8">
                <span className="inline-flex items-center gap-2">
                  <Phone className="h-4 w-4" /> Entidades Civiles
                </span>
                <span className="inline-flex items-center gap-2">
                  <Phone className="h-4 w-4" /> Registro Público
                </span>
                <span className="inline-flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> Av. Roque Pérez N°2398
                </span>
              </div>
              <div className="flex items-center gap-5">
                <Image
                  alt="Ciudadano Misiones"
                  src={siteAssets.logos.ciudadanoMisiones}
                  width={160}
                  height={40}
                  className="h-auto w-[160px] shrink-0"
                />
                <div className="relative h-[42px] w-[174px] shrink-0">
                  <Image
                    alt="Silicon Misiones"
                    src={siteAssets.logos.siliconMisionesMain}
                    fill
                    className="object-contain object-left"
                    sizes="174px"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 text-center text-xs text-white/90 md:flex-row md:items-center md:justify-center md:gap-6">
            <span>Gobierno de la Provincia de Misiones. © 2026</span>
            <span>Sugerencias</span>
            <span>Soporte</span>
            <span>Digital Factory</span>
          </div>
        </div>

        <button
          type="button"
          className="fixed bottom-6 right-6 z-20 flex h-[55px] w-[55px] items-center justify-center rounded-full p-0 shadow-lg"
          aria-label="Accesibilidad"
        >
          <Image
            alt=""
            src={siteAssets.ui.accessibility}
            width={55}
            height={55}
            className="h-[55px] w-[55px]"
          />
        </button>
      </footer>
    </div>
  )
}
