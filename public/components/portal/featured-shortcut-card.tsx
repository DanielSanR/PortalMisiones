import Link from "next/link"
import Image from "next/image"
import { Card, CardContent } from "@/components/ui/card"
import { siteAssets } from "@/lib/site-assets"

const iconMap = [
  siteAssets.ui.featuredBirth,
  siteAssets.ui.featuredMarket,
  siteAssets.ui.featuredVehicle,
  siteAssets.ui.featuredRetirement,
  siteAssets.ui.featuredHome,
]

interface FeaturedShortcutCardProps {
  title: string
  index: number
}

export function FeaturedShortcutCard({ title, index }: FeaturedShortcutCardProps) {
  const iconSrc = iconMap[index % iconMap.length]

  return (
    <Link
      href={`/tramites?search=${encodeURIComponent(title)}#detalle`}
      className="block shrink-0" // Evita que la tarjeta se encoja
    >
      <Card className="h-[140px] w-[240px] rounded-[14px] border-[#c0c5cf] transition-all hover:shadow-[0_14px_40px_rgba(33,72,114,0.1)] xl:w-[260px]">
        <CardContent className="flex h-full flex-col items-center justify-center gap-3 p-4 text-center">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#e8f0fa]">
            <Image alt="" src={iconSrc} width={28} height={28} className="h-7 w-7" />
          </div>

          <span className="line-clamp-2 px-2 text-sm leading-tight font-medium text-slate-700">
            {title}
          </span>
        </CardContent>
      </Card>
    </Link>
  )
}
