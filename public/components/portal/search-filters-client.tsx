"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Search } from "lucide-react"
import { buildCleanUrl, buildTramiteFiltersUrl, type TramiteFilterValues } from "@/lib/url/tramite-filters"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/select"
import type { Destinatario, Etiqueta, Localidad, Modalidad, Organismo } from "@/models/tramite.model"

export interface SearchFiltersCatalogs {
  organismos: Organismo[]
  modalidades: Modalidad[]
  destinatarios: Destinatario[]
  localidades: Localidad[]
  etiquetas: Etiqueta[]
}

export interface SearchFiltersClientProps extends TramiteFilterValues {
  hero?: boolean
  /** URL base para construir filtros. Default: /tramites */
  basePath?: string
  /** Query params extra que se preservan al cambiar filtros (ej: { sub: "licencia-conducir" }) */
  preserveParams?: Record<string, string | undefined>
  /** Oculta el título "Categorías" (útil cuando ya hay un h1 arriba) */
  hideHeading?: boolean
  /** Catálogos provistos por el server wrapper. En modo hero se puede omitir. */
  catalogs?: SearchFiltersCatalogs
}

const quickActions = ["Licencia de conducir", "Partida de nacimiento", "Antecedentes"]

export function SearchFiltersClient({
  search,
  organismoId,
  modalidadId,
  destinatarioId,
  localidadId,
  etiquetaId,
  hero = false,
  basePath = "/tramites",
  preserveParams,
  hideHeading = false,
  catalogs,
}: SearchFiltersClientProps) {
  const router = useRouter()
  const [etiquetasOpen, setEtiquetasOpen] = useState(false)

  const current: TramiteFilterValues = { search, organismoId, modalidadId, destinatarioId, localidadId, etiquetaId }
  const buildUrl = (overrides: Partial<TramiteFilterValues>) =>
    buildTramiteFiltersUrl(current, overrides, { basePath, preserveParams })

  // ── Hero mode ──────────────────────────────────────────────
  if (hero) {
    function handleHeroSubmit(e: React.FormEvent<HTMLFormElement>) {
      e.preventDefault()
      const q = new FormData(e.currentTarget).get("search") as string
      router.push(buildUrl({ search: q || undefined }) as never)
    }

    return (
      <form onSubmit={handleHeroSubmit} className="mx-auto max-w-[920px]">
        <h1 className="pt-24 text-center font-sans text-[32px] font-extrabold text-white [text-shadow:3px_8px_16px_rgba(0,0,0,0.25)] md:text-[40px]">
          ¿Qué trámite necesitás hacer hoy?
        </h1>
        <div className="mt-6 flex h-[59px] rounded-xl border border-[#e5e7eb] bg-white shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_-1px_rgba(0,0,0,0.1)]">
          <div className="flex flex-1 items-center gap-3 px-4">
            <Input
              name="search"
              defaultValue={search}
              placeholder="Ej: licencia de conducir, partida de nacimiento..."
              className="border-0 px-0 text-base text-[rgba(26,26,46,0.5)] shadow-none placeholder:text-[rgba(26,26,46,0.5)] focus-visible:ring-0"
            />
          </div>
          <Button type="submit" className="my-2 mr-2 rounded-[10px] bg-[#3b82c4] px-5 hover:bg-[#2f6eb1]">
            <Search className="h-[18px] w-[18px]" />
            Buscar
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {quickActions.map((item) => (
            <Link
              key={item}
              href={`/tramites?search=${encodeURIComponent(item)}`}
              className="inline-flex items-center justify-center rounded-full border border-[rgba(255,255,255,0.2)] bg-[rgba(255,255,255,0.15)] px-3 py-2 text-[14px] font-medium text-white transition-colors hover:bg-[rgba(255,255,255,0.25)]"
            >
              {item}
            </Link>
          ))}
        </div>
      </form>
    )
  }

  // ── Catalogue mode ─────────────────────────────────────────
  if (!catalogs) {
    throw new Error("SearchFiltersClient: catalogs prop is required when hero=false")
  }
  const { organismos, modalidades, destinatarios, localidades, etiquetas } = catalogs

  function handleSearchSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const q = new FormData(e.currentTarget).get("search") as string
    router.push(buildUrl({ search: q || undefined }) as never, { scroll: false })
  }

  // Fires when the native × in <input type="search"> is clicked (value becomes "")
  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.value === "") {
      router.push(buildUrl({ search: undefined }) as never, { scroll: false })
    }
  }

  const clearHref = buildCleanUrl({ basePath, preserveParams })

  return (
    <div className="space-y-4">
      <div className={`flex items-center gap-3 ${hideHeading ? "justify-end" : "justify-between"}`}>
        {!hideHeading && (
          <h2 className="text-[24px] font-medium leading-[40px] text-[#1a1a2e]">Categorías</h2>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setEtiquetasOpen((prev) => !prev)}
          className={`rounded-[10px] px-4 ${
            etiquetasOpen
              ? "border-[#2f6eb1] bg-[#2f6eb1] text-white hover:bg-[#264f82] hover:text-white"
              : "border-[#3b82c4] text-[#3b82c4] hover:text-[#3b82c4]"
          }`}
        >
          Etiquetas
        </Button>
      </div>

      {/* Etiquetas panel */}
      {etiquetasOpen && (
        <div className="rounded-[14px] border border-[#d0d0d0] bg-[#f9fafb] px-[21px] pb-4 pt-[21px]">
          <p className="mb-3 text-[14px] font-semibold text-[#1e2939]">Filtrar por etiquetas</p>
          <div className="flex flex-wrap gap-2">
            {etiquetas.map((etiqueta) => (
              <Link
                key={etiqueta.id}
                href={buildUrl({ etiquetaId: etiquetaId === etiqueta.id ? undefined : etiqueta.id }) as never}
                scroll={false}
                className={`inline-flex h-[32px] items-center rounded-full border px-3 text-[12px] font-medium transition-colors ${
                  etiquetaId === etiqueta.id
                    ? "border-[#2f6eb1] bg-[#2f6eb1] text-white"
                    : "border-[#e5e7eb] bg-white text-[#4a5565] hover:border-[#2f6eb1] hover:text-[#2f6eb1]"
                }`}
              >
                {etiqueta.nombre}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Modalidad pills */}
      <div className="flex flex-wrap gap-2">
        <Link
          href={buildUrl({ modalidadId: undefined }) as never}
          scroll={false}
          className={`inline-flex items-center rounded-full px-4 py-2 text-sm font-medium transition-colors ${
            !modalidadId
              ? "bg-[#2f6eb1] text-white hover:bg-[#264f82]"
              : "border border-[#e5e7eb] bg-white text-[#4a5565] hover:bg-slate-50"
          }`}
        >
          Todos
        </Link>
        {modalidades.map((item) => (
          <Link
            key={item.id}
            href={buildUrl({ modalidadId: item.id }) as never}
            scroll={false}
            className={`inline-flex items-center rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              modalidadId === item.id
                ? "bg-[#2f6eb1] text-white hover:bg-[#264f82]"
                : "border border-[#e5e7eb] bg-white text-[#4a5565] hover:bg-slate-50"
            }`}
          >
            {item.nombre}
          </Link>
        ))}
      </div>

      {/* Filter row */}
      <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto_auto]">
        {/* Search — submits on Enter, clears on native × */}
        <form onSubmit={handleSearchSubmit} className="contents">
          <div className="relative flex items-center">
            <Search className="pointer-events-none absolute left-3 h-4 w-4 text-slate-400" />
            <Input
              type="search"
              name="search"
              defaultValue={search}
              placeholder="Buscar por nombre, descripción o etiqueta..."
              onChange={handleSearchChange}
              className="h-[43px] rounded-[10px] pl-9"
            />
          </div>
        </form>

        <NativeSelect
          aria-label="Filtrar por destinatario"
          value={destinatarioId?.toString() ?? ""}
          onChange={(e) =>
            router.push(buildUrl({ destinatarioId: e.target.value ? Number(e.target.value) : undefined }) as never, { scroll: false })
          }
          className="h-[43px] rounded-[10px]"
        >
          <option value="">Todos los destinatarios</option>
          {destinatarios.map((dest) => (
            <option key={dest.id} value={dest.id}>
              {dest.nombre}
            </option>
          ))}
        </NativeSelect>

        <NativeSelect
          aria-label="Filtrar por organismo"
          value={organismoId ?? ""}
          onChange={(e) =>
            router.push(buildUrl({ organismoId: e.target.value || undefined }) as never, { scroll: false })
          }
          className="h-[43px] rounded-[10px]"
        >
          <option value="">Todos los Organismos</option>
          {organismos.map((organismo) => (
            <option key={organismo.id} value={organismo.id}>
              {organismo.nombre}
            </option>
          ))}
        </NativeSelect>

        <NativeSelect
          aria-label="Filtrar por localidad"
          value={localidadId?.toString() ?? ""}
          onChange={(e) =>
            router.push(buildUrl({ localidadId: e.target.value ? Number(e.target.value) : undefined }) as never, { scroll: false })
          }
          className="h-[43px] rounded-[10px]"
        >
          <option value="">Todas las localidades</option>
          {localidades.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.nombre}
            </option>
          ))}
        </NativeSelect>

        <Link
          href={clearHref as never}
          scroll={false}
          className="inline-flex h-[43px] items-center justify-center rounded-[10px] border border-[#dbe2ee] bg-white px-5 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          Limpiar
        </Link>
      </div>
    </div>
  )
}
