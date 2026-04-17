import Link from "next/link"
import Image from "next/image"
import type { Route } from "next"
import { Card, CardContent } from "@/components/ui/card"
import { siteAssets } from "@/lib/site-assets"

const iconMap = {
  automotor: siteAssets.ui.featuredVehicle,
  denuncias: siteAssets.ui.topicPaper,
  jubilaciones: siteAssets.ui.featuredRetirement,
  impuestos: siteAssets.ui.topicMoney,
  vivienda: siteAssets.ui.topicTree,
  trabajo: siteAssets.ui.topicBuilding,
}

type TopicIcon = keyof typeof iconMap

interface HomeTopicCardProps {
  title: string
  description: string
  search: string
  icon: TopicIcon
  href?: string
}

export function HomeTopicCard({ title, description, search, icon, href }: HomeTopicCardProps) {
  const iconSrc = iconMap[icon]
  const linkHref = href
    ? `${href}#detalle`
    : `/tramites?search=${encodeURIComponent(search)}#detalle`

  return (
    <Link href={linkHref as Route}>
      <Card className="h-full rounded-[14px] border-[#e5e7eb] shadow-[2px_2px_4px_0px_rgba(0,0,0,0.12)] transition hover:-translate-y-0.5 hover:shadow-[2px_4px_12px_0px_rgba(0,0,0,0.18)]">
        <CardContent className="flex h-full items-center gap-6 p-[24.8px]">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[rgba(47,110,177,0.1)]">
            <Image alt="" src={iconSrc} width={24} height={24} className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h3 className="text-[18px] leading-6 font-semibold text-slate-900">{title}</h3>
            <p className="mt-2 line-clamp-3 text-xs leading-[15px] text-slate-600">{description}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
