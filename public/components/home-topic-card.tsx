import Link from "next/link"
import Image from "next/image"
import { ArrowRight } from "lucide-react"
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
}

export function HomeTopicCard({ title, description, search, icon }: HomeTopicCardProps) {
  const iconSrc = iconMap[icon]

  return (
    <Link href={`/tramites?search=${encodeURIComponent(search)}`}>
      <Card className="h-full rounded-[16px] border-[#dbe2ee] transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(33,72,114,0.1)]">
        <CardContent className="flex h-full items-start gap-4 p-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#eef5ff] text-[#4f8ed2]">
            <Image alt="" src={iconSrc} width={22} height={22} className="h-[22px] w-[22px]" />
          </div>
          <div className="min-w-0">
            <h3 className="text-[19px] font-semibold leading-6 text-slate-900">{title}</h3>
            <p className="mt-2 text-sm leading-5 text-slate-600">{description}</p>
            <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-[#2b5f99]">
              Ver más
              <ArrowRight className="h-4 w-4" />
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
