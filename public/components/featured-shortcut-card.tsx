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
      href={`/tramites?search=${encodeURIComponent(title)}`} 
      className="block shrink-0" // Evita que la tarjeta se encoja
    >
      <Card className="h-[140px] w-[260px] rounded-[14px] border-[#dbe2ee] transition-all hover:shadow-[0_14px_40px_rgba(33,72,114,0.1)]">
        <CardContent className="flex h-full flex-col items-center justify-center gap-3 p-4 text-center">
          {/* El contenedor del icono se mantiene circular y centrado */}
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#eef5ff] text-[#4f8ed2]">
            <Image alt="" src={iconSrc} width={24} height={24} className="h-6 w-6" />
          </div>
          
          <span className="line-clamp-2 text-sm font-medium text-slate-700 leading-tight px-2">
            {title}
          </span>
        </CardContent>
      </Card>
    </Link>
  )
}
