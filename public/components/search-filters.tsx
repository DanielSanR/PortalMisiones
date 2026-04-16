"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Search } from "lucide-react"
import { getDestinatarios, getEtiquetas, getLocalidades, getModalidades, getOrganismos } from "@/lib/public-data"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/select"

interface SearchFiltersProps {
  search?: string
  organismoId?: string
  modalidadId?: number
  destinatarioId?: number
  localidadId?: number
  etiquetaId?: number
  hero?: boolean
  /** URL base para construir filtros. Default: /tramites */
  basePath?: string
  /** Query params extra que se preservan al cambiar filtros (ej: { sub: "licencia-conducir" }) */
  preserveParams?: Record<string, string | undefined>
  /** Oculta el título "Categorías" (útil cuando ya hay un h1 arriba) */
  hideHeading?: boolean
}

const quickActions = ["Licencia de conducir", "Partida de nacimiento", "Antecedentes"]

const organismos = getOrganismos()
const modalidades = getModalidades()
const destinatarios = getDestinatarios()
const localidades = getLocalidades()
const etiquetas = getEtiquetas()

export function SearchFilters({
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
}: SearchFiltersProps) {
  const router = useRouter()
  const [etiquetasOpen, setEtiquetasOpen] = useState(false)

  // Builds /tramites URL merging current filters with any overrides.
  // Pass undefined for a key to remove that filter.
  function buildUrl(overrides: {
    search?: string | undefined
    modalidadId?: number | undefined
    destinatarioId?: number | undefined
    organismoId?: string | undefined
    localidadId?: number | undefined
    etiquetaId?: number | undefined
  }) {
    const merged = {
      search:        "search"        in overrides ? overrides.search        : search,
      modalidadId:   "modalidadId"   in overrides ? overrides.modalidadId   : modalidadId,
      destinatarioId:"destinatarioId"in overrides ? overrides.destinatarioId: destinatarioId,
      organismoId:   "organismoId"   in overrides ? overrides.organismoId   : organismoId,
      localidadId:   "localidadId"   in overrides ? overrides.localidadId   : localidadId,
      etiquetaId:    "etiquetaId"    in overrides ? overrides.etiquetaId    : etiquetaId,
    }
    const params = new URLSearchParams()
    if (preserveParams) {
      for (const [key, value] of Object.entries(preserveParams)) {
        if (value) params.set(key, value)
      }
    }
    if (merged.search)         params.set("search",         merged.search)
    if (merged.modalidadId)    params.set("modalidadId",    String(merged.modalidadId))
    if (merged.destinatarioId) params.set("destinatarioId", String(merged.destinatarioId))
    if (merged.organismoId)    params.set("organismoId",    merged.organismoId)
    if (merged.localidadId)    params.set("localidadId",    String(merged.localidadId))
    if (merged.etiquetaId)     params.set("etiquetaId",     String(merged.etiquetaId))
    const qs = params.toString()
    return `${basePath}${qs ? `?${qs}` : ""}`
  }

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

  function handleSearchSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const q = new FormData(e.currentTarget).get("search") as string
    router.push(buildUrl({ search: q || undefined }) as never)
  }

  // Fires when the native × in <input type="search"> is clicked (value becomes "")
  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.value === "") {
      router.push(buildUrl({ search: undefined }) as never)
    }
  }

  // URL para "Limpiar": preserva sólo basePath + preserveParams (sin filtros)
  const cleanParams = new URLSearchParams()
  if (preserveParams) {
    for (const [key, value] of Object.entries(preserveParams)) {
      if (value) cleanParams.set(key, value)
    }
  }
  const cleanQs = cleanParams.toString()
  const clearHref = `${basePath}${cleanQs ? `?${cleanQs}` : ""}`

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
      <div className="flex flex-wrap gap-2" id="temas">
        <Link
          href={buildUrl({ modalidadId: undefined }) as never}
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
          value={destinatarioId?.toString() ?? ""}
          onChange={(e) =>
            router.push(buildUrl({ destinatarioId: e.target.value ? Number(e.target.value) : undefined }) as never)
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
          value={organismoId ?? ""}
          onChange={(e) =>
            router.push(buildUrl({ organismoId: e.target.value || undefined }) as never)
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
          value={localidadId?.toString() ?? ""}
          onChange={(e) =>
            router.push(buildUrl({ localidadId: e.target.value ? Number(e.target.value) : undefined }) as never)
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
          className="inline-flex h-[43px] items-center justify-center rounded-[10px] border border-[#dbe2ee] bg-white px-5 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          Limpiar
        </Link>
      </div>
    </div>
  )
}
