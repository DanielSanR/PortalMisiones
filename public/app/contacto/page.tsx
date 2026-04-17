import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft, ChevronRight, Mail, MapPin, Phone } from "lucide-react"
import { PortalShellFixed as PortalShell } from "@/components/portal/portal-shell-fixed"
import { JsonLd } from "@/components/seo/json-ld"
import { breadcrumbListSchema } from "@/lib/seo/jsonld"
import { ContactForm } from "./contact-form"

export const metadata: Metadata = {
  title: "Contacto",
  description:
    "Contactanos para consultas sobre trámites y servicios provinciales del Portal de Trámites de Misiones.",
  alternates: { canonical: "/contacto" },
  openGraph: {
    title: "Contacto",
    description:
      "Contactanos para consultas sobre trámites y servicios provinciales del Portal de Trámites de Misiones.",
    url: "/contacto",
    type: "website",
  },
}

export default function ContactoPage() {
  const breadcrumb = breadcrumbListSchema([
    { name: "Inicio", path: "/" },
    { name: "Contacto", path: "/contacto" },
  ])

  return (
    <PortalShell>
      <JsonLd data={breadcrumb} />
      <main id="main-content" className="relative z-10">
        <div className="h-[360px] md:h-[400px]" />

        <section className="mx-auto max-w-[1440px] px-4 pb-16 md:px-10">
          {/* Breadcrumb + back */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-1 text-sm text-[#555]">
              <Link href="/" className="hover:text-brand">
                Inicio
              </Link>
              <ChevronRight className="text-brand mx-1 inline h-3 w-3" />
              <span className="text-[#555]">Contacto</span>
            </div>
            <Link
              href="/"
              className="text-brand hover:text-brand-dark flex items-center gap-2 text-[18px] font-semibold"
            >
              <ArrowLeft className="h-5 w-5" />
              Volver al Inicio
            </Link>
          </div>

          <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_360px]">
            {/* Form */}
            <div className="rounded-[24px] bg-white px-6 py-10 shadow-[0_12px_40px_rgba(33,72,114,0.08)] md:px-10">
              <h1 className="text-ink text-[28px] font-semibold tracking-[-0.02em]">Escribinos</h1>
              <p className="mt-2 text-sm text-slate-600">
                Consultas, sugerencias y soporte. Te respondemos por email a la brevedad.
              </p>

              <div className="mt-8">
                <ContactForm />
              </div>
            </div>

            {/* Sidebar institucional */}
            <aside className="flex flex-col gap-4">
              <div className="rounded-[24px] bg-white px-6 py-8 shadow-[0_12px_40px_rgba(33,72,114,0.08)]">
                <h2 className="text-ink text-[18px] font-semibold">Otros canales</h2>
                <ul className="text-ink mt-4 flex flex-col gap-4 text-sm">
                  <li className="flex items-start gap-3">
                    <MapPin className="text-brand mt-0.5 h-5 w-5 shrink-0" />
                    <div>
                      <p className="text-[11px] tracking-wide text-slate-500 uppercase">
                        Dirección
                      </p>
                      <p className="leading-6">Av. Roque Pérez N°2398, Posadas, Misiones</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <Phone className="text-brand mt-0.5 h-5 w-5 shrink-0" />
                    <div>
                      <p className="text-[11px] tracking-wide text-slate-500 uppercase">Teléfono</p>
                      <p className="leading-6">0800-555-0000</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <Mail className="text-brand mt-0.5 h-5 w-5 shrink-0" />
                    <div>
                      <p className="text-[11px] tracking-wide text-slate-500 uppercase">Email</p>
                      <a
                        href="mailto:contacto@misiones.gob.ar"
                        className="hover:text-brand leading-6"
                      >
                        contacto@misiones.gob.ar
                      </a>
                    </div>
                  </li>
                </ul>
              </div>

              <div className="border-border-soft rounded-[24px] border bg-white/60 px-6 py-6 text-sm text-slate-600">
                <p>
                  Para consultas sobre un trámite específico, revisá primero su{" "}
                  <Link href="/tramites" className="text-brand underline">
                    ficha oficial
                  </Link>{" "}
                  en el catálogo. Ahí vas a encontrar el organismo responsable y sus datos de
                  contacto.
                </p>
              </div>
            </aside>
          </div>
        </section>
      </main>
    </PortalShell>
  )
}
