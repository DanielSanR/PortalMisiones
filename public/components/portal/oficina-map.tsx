import { ExternalLink } from "lucide-react"

interface OficinaMapProps {
  latitud: number
  longitud: number
  nombre?: string
  delta?: number
}

export function OficinaMap({ latitud, longitud, nombre, delta = 0.006 }: OficinaMapProps) {
  const minLon = longitud - delta
  const maxLon = longitud + delta
  const minLat = latitud - delta
  const maxLat = latitud + delta

  const embedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${minLon}%2C${minLat}%2C${maxLon}%2C${maxLat}&layer=mapnik&marker=${latitud}%2C${longitud}`
  const externalUrl = `https://www.openstreetmap.org/?mlat=${latitud}&mlon=${longitud}#map=17/${latitud}/${longitud}`

  return (
    <div className="w-full min-w-0 overflow-hidden rounded-[16px] border border-[#dbe2ee] bg-white shadow-[0_8px_24px_rgba(33,72,114,0.06)]">
      <iframe
        title={nombre ? `Mapa de ${nombre}` : "Mapa de la oficina"}
        src={embedUrl}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        width="100%"
        height={260}
        className="block h-[260px] w-full border-0"
        style={{ width: "100%", display: "block" }}
      />
      <div className="flex items-center justify-between gap-3 px-4 py-2 text-[12px] text-[#555]">
        <span className="truncate">
          © <a href="https://www.openstreetmap.org/copyright" className="hover:text-[#2f6eb1]" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors
        </span>
        <a
          href={externalUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-medium text-[#2f6eb1] hover:text-[#234e80]"
        >
          Ver en mapa grande <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  )
}
