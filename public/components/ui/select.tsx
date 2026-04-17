import * as React from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface NativeSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  wrapperClassName?: string
}

const NativeSelect = React.forwardRef<HTMLSelectElement, NativeSelectProps>(
  ({ className, wrapperClassName, children, ...props }, ref) => {
    return (
      <div className={cn("relative", wrapperClassName)}>
        <select
          ref={ref}
          className={cn(
            "h-11 w-full appearance-none rounded-xl border border-[#dbe2ee] bg-white px-4 pr-10 text-sm text-slate-700 focus-visible:ring-2 focus-visible:ring-[#4f8ed2] focus-visible:ring-offset-2 focus-visible:outline-none",
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </div>
    )
  },
)

NativeSelect.displayName = "NativeSelect"

export { NativeSelect }
