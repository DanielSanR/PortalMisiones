import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "border-[#d9e5f6] bg-[#edf5ff] text-[#2b5f99]",
        muted: "border-[#e5e7eb] bg-white text-slate-600",
        dark: "border-white/10 bg-slate-800/60 text-white",
        transparent: "border-transparent bg-transparent text-slate-700",
        blur: "border-white/10 bg-white/30 backdrop-blur-md text-slate-700 text-white",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof badgeVariants>) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}
