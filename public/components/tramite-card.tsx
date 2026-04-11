import Link from "next/link"
import { Building2, CircleArrowOutUpRight, MapPinned } from "lucide-react"
import type { Tramite } from "@/models/tramite.model"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

interface TramiteCardProps {
  tramite: Tramite
}

export function TramiteCard({ tramite }: TramiteCardProps) {
  return (
    <Card className="rounded-[16px] border-[#dbe2ee]">
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{tramite.organismo?.sigla ?? "Organismo provincial"}</Badge>
          <Badge variant="muted">{tramite.modalidad?.nombre ?? "Sin modalidad"}</Badge>
        </div>
        <div>
          <h3 className="text-[21px] font-semibold leading-7 text-slate-900">{tramite.titulo}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {tramite.resumen ?? "Informacion oficial del tramite provincial."}
          </p>
        </div>
        <div className="grid gap-2 text-sm text-slate-500 md:grid-cols-2">
          <div className="inline-flex items-center gap-2">
            <Building2 className="h-4 w-4 text-[#4f8ed2]" />
            <span>{tramite.organismo?.nombre ?? "Organismo provincial"}</span>
          </div>
          <div className="inline-flex items-center gap-2">
            <MapPinned className="h-4 w-4 text-[#4f8ed2]" />
            <span>Provincia de Misiones</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
        {tramite.etiquetas.map((etiqueta) => (
          <Badge variant="muted" key={etiqueta.id}>
            {etiqueta.nombre}
          </Badge>
        ))}
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href={`/tramites/${tramite.slug}`}>
            <Button className="rounded-xl">Ver detalle</Button>
          </Link>
          <a href={tramite.urlOficial} target="_blank" rel="noreferrer">
            <Button variant="outline" className="rounded-xl">
              Ir al sitio oficial
              <CircleArrowOutUpRight className="h-4 w-4" />
            </Button>
          </a>
        </div>
      </CardContent>
    </Card>
  )
}
