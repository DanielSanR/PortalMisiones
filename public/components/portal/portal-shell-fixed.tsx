import Image from "next/image"
import Link from "next/link"
import { MapPin, Smartphone } from "lucide-react"
import { siteAssets } from "@/lib/site-assets"
import { MobileMenu, type NavLinkItem } from "@/components/portal/mobile-menu"

interface PortalShellProps {
  children: React.ReactNode
  hero?: boolean
}

const navLinks: readonly NavLinkItem[] = [
  { label: "Inicio", href: "/", isExternal: false },
  { label: "Trámites", href: "/tramites", isExternal: false },
  { label: "Temas", href: "/#temas", isExternal: true },
  { label: "Eventos de vida", href: "/eventos", isExternal: false },
  { label: "Organismos", href: "/organismos", isExternal: false },
  { label: "Mi Portal", href: "#", isExternal: true },
] as const

export function PortalShellFixed({ children, hero = false }: PortalShellProps) {
  return (
    <div className="bg-background min-h-screen text-slate-900">
      <a
        href="#main-content"
        className="focus:text-brand focus:outline-brand sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:shadow-lg focus:outline focus:outline-2"
      >
        Saltar al contenido principal
      </a>
      <div className="relative overflow-hidden">
        {/* Background image band for non-hero pages */}
        {!hero && (
          <div className="absolute inset-x-0 top-0 h-[480px] overflow-hidden md:h-[520px]">
            <Image
              alt=""
              src={siteAssets.heroCataratas}
              fill
              priority
              className="object-cover object-center"
              sizes="100vw"
            />
            {/* Dark + blue overlay (same recipe as hero) */}
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(16,29,44,0.25),rgba(16,29,44,0.70)),linear-gradient(180deg,rgba(47,110,177,0.5),rgba(41,72,109,0.55))]" />
            {/* Bottom fade to page background */}
            <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-b from-transparent to-[#ffff]" />
          </div>
        )}

        <header
          className={`${hero ? "absolute inset-x-0 top-0" : "relative"} z-20 px-4 py-7 md:px-10`}
        >
          <div className="bg-brand mx-auto max-w-[1440px] rounded-full px-6 py-6 shadow-[0_18px_40px_rgba(38,92,151,0.28)]">
            <div className="mx-auto flex max-w-[1130px] items-center justify-between">
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
                {navLinks.map((link) =>
                  link.isExternal ? (
                    <a
                      key={link.label}
                      className="transition-colors hover:text-white/80"
                      href={link.href}
                    >
                      {link.label}
                    </a>
                  ) : (
                    <Link
                      key={link.label}
                      className="transition-colors hover:text-white/80"
                      href={link.href as "/tramites" | "/" | "/organismos" | "/eventos"}
                    >
                      {link.label}
                    </Link>
                  ),
                )}
              </nav>

              <MobileMenu links={navLinks} />
            </div>
          </div>
        </header>

        {children}
      </div>

      <footer className="bg-brand relative overflow-hidden font-[family-name:var(--font-montserrat)] text-white">
        {/* Decorative "M" — borde inferior derecho */}
        <Image
          alt=""
          src={siteAssets.ui.mTransparent}
          width={520}
          height={520}
          aria-hidden
          className="pointer-events-none absolute -right-0 -bottom-5 h-[260px] w-auto opacity-100 md:h-[360px]"
        />
        <div className="relative mx-auto max-w-[1440px] px-4 pt-8 pb-5 md:px-10">
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
                <a href="#" aria-label="Instagram">
                  <Image
                    alt="Instagram"
                    src={siteAssets.ui.socialInstagram}
                    width={24}
                    height={24}
                    className="h-6 w-6"
                  />
                </a>
                <a href="#" aria-label="X (Twitter)">
                  <Image
                    alt="X (Twitter)"
                    src={siteAssets.ui.socialX}
                    width={24}
                    height={24}
                    className="h-6 w-6"
                  />
                </a>
                <a href="#" aria-label="YouTube">
                  <Image
                    alt="YouTube"
                    src={siteAssets.ui.socialYoutube}
                    width={24}
                    height={24}
                    className="h-6 w-6"
                  />
                </a>
                <a href="#" aria-label="Facebook">
                  <Image
                    alt="Facebook"
                    src={siteAssets.ui.socialFacebook}
                    width={24}
                    height={24}
                    className="h-6 w-6"
                  />
                </a>
                <a href="#" aria-label="WhatsApp">
                  <Image
                    alt="WhatsApp"
                    src={siteAssets.ui.socialWhatsapp}
                    width={24}
                    height={24}
                    className="h-6 w-6"
                  />
                </a>
                <a href="#" aria-label="LinkedIn">
                  <Image
                    alt="LinkedIn"
                    src={siteAssets.ui.socialLinkedin}
                    width={24}
                    height={24}
                    className="h-6 w-6"
                  />
                </a>
              </div>
            </div>
          </div>

          <div className="rounded-[22px] bg-white px-5 py-4 text-lg text-slate-600 shadow-[0_14px_40px_rgba(16,51,92,0.15)]">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-8">
                <span className="inline-flex items-center gap-2">
                  <Smartphone className="h-4 w-4" /> Entidades Civiles
                </span>
                <span className="inline-flex items-center gap-2">
                  <Smartphone className="h-4 w-4" /> Registro Público
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
                  className="hrink-0 h-[55px] w-[211px]"
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

          <div className="text-md mt-4 flex flex-col gap-3 text-center text-white/90 md:flex-row md:items-center md:justify-center md:gap-6">
            <span>Gobierno de la Provincia de Misiones. © 2026</span>
            <Link href="/contacto" className="font-semibold hover:text-white">
              Sugerencias
            </Link>
            <Link href="/contacto" className="font-semibold hover:text-white">
              Soporte
            </Link>
            <strong>Digital Factory</strong>
          </div>
        </div>

        <button
          type="button"
          className="focus-visible:outline-brand fixed right-6 bottom-6 z-20 flex h-[55px] w-[55px] items-center justify-center rounded-full bg-white p-0 shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          aria-label="Abrir panel de accesibilidad"
          aria-haspopup="dialog"
        >
          <Image
            alt=""
            aria-hidden
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
