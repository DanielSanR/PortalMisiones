import Link from "next/link"
import { Search } from "lucide-react"
import { getEtiquetas, getModalidades, getOrganismos } from "@/lib/public-data"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/select"

interface SearchFiltersProps {
  search?: string
  organismoId?: string
  modalidadId?: number
  etiquetaId?: number
  hero?: boolean
}

const quickActions = ["Licencia de conducir", "Partida de nacimiento", "Antecedentes"]

export function SearchFilters({
  search,
  organismoId,
  modalidadId,
  etiquetaId,
  hero = false,
}: SearchFiltersProps) {
  const organismos = getOrganismos()
  const modalidades = getModalidades()
  const etiquetas = getEtiquetas()

  if (hero) {
    return (
      <form action="/tramites" className="mx-auto max-w-[920px]">
        <h1 className="text-center pt-24 font-sans text-[32px] font-bold tracking-[-0.02em] text-white md:text-[40px]">
          ¿Qué trámite necesitás hacer hoy?
        </h1>
        <div className="mt-6 flex h-[59px] rounded-xl bg-white shadow-[0_20px_60px_rgba(0,0,0,0.2)]">
          <div className="flex flex-1 items-center gap-3 px-4">
            <Input
              name="search"
              defaultValue={search}
              placeholder="Ej: licencia de conducir, partida de nacimiento..."
              className="border-0 px-0 text-sm shadow-none focus-visible:ring-0"
            />
          </div>
          <Button type="submit" className="my-2 mr-2 rounded-lg px-6">
            <Search className="h-4 w-4" />
            Buscar
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {quickActions.map((item) => (
            <Link href={`/tramites?search=${encodeURIComponent(item)}`} key={item}>
              <Badge variant="blur" className="rounded-full border-white/20 px-4 py-2 text-[13px]">
                {item}
              </Badge>
            </Link>
          ))}
        </div>
      </form>
    )
  }

  return (
    <form action="/tramites" className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[32px] font-semibold tracking-[-0.03em] text-slate-900">Categorías</h2>
        <Button type="button" variant="outline" size="sm" className="rounded-xl px-4">
          Etiquetas
        </Button>
      </div>

      <div className="flex flex-wrap gap-2" id="temas">
        <Badge className="rounded-full bg-[#4f8ed2] px-4 py-2 text-white hover:bg-[#4f8ed2]">Todos</Badge>
        {["Digital de punta a punta", "Digital con instancia presencial", "Presencial con apoyo digital", "Informativo / derivación"].map((item) => (
          <Badge key={item} variant="muted" className="rounded-full px-4 py-2">
            {item}
          </Badge>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Input
          type="search"
          name="search"
          defaultValue={search}
          placeholder="Buscar por nombre, descripción o etiqueta..."
          className="h-12 rounded-xl"
        />
        <NativeSelect name="organismoId" defaultValue={organismoId ?? ""} className="h-12 rounded-xl">
          <option value="">Todos los organismos</option>
          {organismos.map((organismo) => (
            <option key={organismo.id} value={organismo.id}>
              {organismo.nombre}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="modalidadId" defaultValue={modalidadId?.toString() ?? ""} className="h-12 rounded-xl">
          <option value="">Todas las temáticas</option>
          {modalidades.map((modalidad) => (
            <option key={modalidad.id} value={modalidad.id}>
              {modalidad.nombre}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="etiquetaId" defaultValue={etiquetaId?.toString() ?? ""} className="h-12 rounded-xl">
          <option value="">Todos los destinatarios</option>
          {etiquetas.map((etiqueta) => (
            <option key={etiqueta.id} value={etiqueta.id}>
              {etiqueta.nombre}
            </option>
          ))}
        </NativeSelect>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto_auto]">
        <NativeSelect defaultValue="" className="h-12 rounded-xl">
          <option value="">Todos los departamentos</option>
        </NativeSelect>
        <NativeSelect defaultValue="" className="h-12 rounded-xl">
          <option value="">Todas las localidades</option>
        </NativeSelect>
        <Button type="submit" className="rounded-xl px-6">
          Aplicar filtros
        </Button>
        <Link
          href="/tramites"
          className="inline-flex h-11 items-center justify-center rounded-xl border border-[#dbe2ee] bg-white px-5 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          Limpiar
        </Link>
      </div>

      <div className="rounded-[22px] border border-[#dbe2ee] bg-[#fafcff] px-5 py-4">
        <p className="text-sm font-medium text-slate-700">Filtrar por etiquetas</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {etiquetas.map((etiqueta) => (
            <Badge key={etiqueta.id} variant="muted" className="rounded-full px-4 py-2">
              {etiqueta.nombre}
            </Badge>
          ))}
        </div>
      </div>
    </form>
  )
}
