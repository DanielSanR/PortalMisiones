"use client"

import Link from "next/link"
import { useEffect } from "react"
import { PortalShellFixed as PortalShell } from "@/components/portal/portal-shell-fixed"

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <PortalShell>
      <main id="main-content" className="relative z-10">
        <section className="mx-auto max-w-[1440px] px-4 pt-6 pb-16 md:px-10">
          <div className="rounded-[24px] bg-white px-6 py-16 text-center shadow-[0_12px_40px_rgba(33,72,114,0.08)]">
            <p className="text-sm font-medium text-[#4f8ed2]">Ocurrió un error</p>
            <h1 className="mt-3 text-[28px] font-semibold tracking-[-0.02em] text-slate-900">
              No pudimos mostrar esta página.
            </h1>
            <p className="mx-auto mt-3 max-w-md text-sm text-slate-500">
              Algo salió mal al cargar el contenido. Podés reintentar o volver al inicio.
            </p>
            {error.digest && (
              <p className="mx-auto mt-3 max-w-md text-xs text-slate-400">
                Referencia: <code className="font-mono">{error.digest}</code>
              </p>
            )}
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={reset}
                className="rounded-full bg-[#4f8ed2] px-6 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#3d7dc2]"
              >
                Reintentar
              </button>
              <Link
                href="/"
                className="rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
              >
                Ir al inicio
              </Link>
            </div>
          </div>
        </section>
      </main>
    </PortalShell>
  )
}
