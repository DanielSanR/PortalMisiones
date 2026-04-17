"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import type { Route } from "next"
import { ChevronDown, MapPin } from "lucide-react"
import type { Localidad } from "@/models/tramite.model"

interface LocalidadSwitcherProps {
  localidades: Pick<Localidad, "id" | "nombre">[]
  selectedId: number
}

export function LocalidadSwitcher({ localidades, selectedId }: LocalidadSwitcherProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const next = new URLSearchParams(searchParams?.toString() ?? "")
    next.set("localidad", event.target.value)
    router.push(`${pathname}?${next.toString()}#detalle` as Route, { scroll: false })
  }

  return (
    <div className="relative">
      <MapPin className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#2f6eb1]" />
      <select
        aria-label="Cambiar localidad"
        value={selectedId}
        onChange={handleChange}
        className="h-[43px] w-[264px] appearance-none rounded-[10px] border border-[#adadad] bg-white pr-10 pl-9 text-[12px] text-[rgba(10,10,10,0.7)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2f6eb1]"
      >
        {localidades.map((loc) => (
          <option key={loc.id} value={loc.id}>
            {loc.nombre}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-5 w-5 -translate-y-1/2 text-slate-500" />
    </div>
  )
}
