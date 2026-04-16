import Link from "next/link"
import {
  CreditCard,
  Scale,
  Receipt,
  CheckSquare,
  Car,
  BookOpen,
  Banknote,
  ShieldCheck,
  FileText,
  Building2,
  RefreshCw,
  HeartPulse,
  Bus,
  IdCard,
  type LucideIcon,
} from "lucide-react"
import type { Tramite } from "@/models/tramite.model"
import { Card, CardContent } from "@/components/ui/card"

const lucideIconMap: Record<string, LucideIcon> = {
  card_membership:    CreditCard,
  gavel:              Scale,
  receipt_long:       Receipt,
  approval:           CheckSquare,
  directions_car:     Car,
  school:             BookOpen,
  payments:           Banknote,
  security:           ShieldCheck,
  storefront:         Building2,
  autorenew:          RefreshCw,
  health_and_safety:  HeartPulse,
  directions_bus:     Bus,
  badge:              IdCard,
}

function getIcon(icono: string | null): LucideIcon {
  return (icono ? lucideIconMap[icono] : undefined) ?? FileText
}

interface TramiteCardProps {
  tramite: Tramite
}

export function TramiteCard({ tramite }: TramiteCardProps) {
  const Icon = getIcon(tramite.icono)

  return (
    <Link href={`/tramites/${tramite.slug}` as never} className="block">
      <Card className="h-[154px] w-full overflow-hidden rounded-[14px] border-[#e5e7eb] shadow-[2px_2px_4px_0px_rgba(0,0,0,0.10)] transition-all hover:-translate-y-0.5 hover:border-[#2f6eb1] hover:shadow-[0_4px_16px_rgba(47,110,177,0.12)] md:w-[328px]">
        <CardContent className="flex h-full items-center gap-2 px-[24.8px] py-[22px]">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[rgba(47,110,177,0.1)]">
            <Icon className="h-[26px] w-[26px] text-[#2f6eb1]" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1 overflow-hidden">
            <h3 className="line-clamp-2 text-[16px] font-semibold leading-[22px] text-[#1a1a2e]">
              {tramite.titulo}
            </h3>
            <p className="line-clamp-1 text-[10px] leading-[16px] text-[#1a1a2e]">
              {tramite.organismo?.nombre ?? "—"}
            </p>
            <span className="mt-auto block text-[14px] font-bold leading-[22px] text-[#2f6eb1]">
              Mas información
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
