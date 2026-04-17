import Link from "next/link"
import type { Route } from "next"
import { type LucideIcon } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

interface SubcategoriaCardProps {
  href: string
  icon: LucideIcon
  title: string
  description: string
  badge?: string | null
  chips?: { id: number; nombre: string }[]
  selected?: boolean
}

export function SubcategoriaCard({
  href,
  icon: Icon,
  title,
  description,
  badge,
  chips = [],
  selected = false,
}: SubcategoriaCardProps) {
  return (
    <Link href={href as Route} scroll={false} className="block">
      <Card
        className={`h-[154px] w-full overflow-hidden rounded-[14px] transition-all hover:-translate-y-0.5 md:w-[328px] ${
          selected
            ? "border-[#2f6eb1] shadow-[2px_8px_12px_0px_rgba(0,0,0,0.18)]"
            : "border-[#e5e7eb] shadow-[2px_2px_4px_0px_rgba(0,0,0,0.10)] hover:border-[#2f6eb1] hover:shadow-[0_4px_16px_rgba(47,110,177,0.12)]"
        }`}
      >
        <CardContent className="flex h-full items-center gap-2 px-[24.8px] py-[22px]">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${
              selected ? "bg-[#2f6eb1]" : "bg-[rgba(47,110,177,0.1)]"
            }`}
          >
            <Icon className={`h-6 w-6 ${selected ? "text-white" : "text-[#2f6eb1]"}`} />
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-2 overflow-hidden">
            <div className="flex items-start justify-between gap-2">
              <h3 className="line-clamp-1 text-[16px] leading-[22px] font-semibold text-[#1a1a2e]">
                {title}
              </h3>
              {badge && (
                <span className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold text-[#2f6eb1]">
                  {badge}
                </span>
              )}
            </div>
            <p className="line-clamp-3 text-[10px] leading-[15px] font-light text-black">
              {description}
            </p>
            {chips.length > 0 && (
              <div className="mt-auto flex flex-nowrap gap-1 overflow-hidden pt-1">
                {chips.map((c) => (
                  <span
                    key={c.id}
                    className="inline-flex shrink-0 items-center justify-center rounded-full border border-[rgba(47,110,177,0.2)] bg-[rgba(47,110,177,0.15)] px-3 py-1 text-[8px] font-medium text-[#2f6eb1]"
                  >
                    {c.nombre}
                  </span>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
