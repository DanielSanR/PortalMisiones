import Link from "next/link"
import { PortalShellFixed as PortalShell } from "@/components/portal-shell-fixed"

export default function NotFound() {
  return (
    <PortalShell>
      <main className="relative z-10">
        <section className="mx-auto max-w-[1440px] px-4 pb-16 pt-6 md:px-10">
          <div className="rounded-[24px] bg-white px-6 py-16 text-center shadow-[0_12px_40px_rgba(33,72,114,0.08)]">
            <p className="text-sm font-medium text-[#4f8ed2]">Trámite no encontrado</p>
            <h1 className="mt-3 text-[28px] font-semibold tracking-[-0.02em] text-slate-900">
              La ficha que buscabas no está disponible.
            </h1>
            <p className="mx-auto mt-3 max-w-md text-sm text-slate-500">
              Puede que el trámite todavía no esté publicado o que el enlace haya cambiado.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href="/"
                className="rounded-full bg-[#4f8ed2] px-6 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#3d7dc2]"
              >
                Ir al inicio
              </Link>
              <Link
                href="/tramites"
                className="rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
              >
                Ver catálogo
              </Link>
            </div>
          </div>
        </section>
      </main>
    </PortalShell>
  )
}
