import * as React from "react"
import { cn } from "cn"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-24 w-full py-3 leading-relaxed rounded-xl border border-line bg-console-2 px-3.5 text-base transition-[border-color,box-shadow,background-color] duration-150 outline-none placeholder:text-ink-faint hover:border-[#333] focus-visible:border-signal/70 focus-visible:ring-3 focus-visible:ring-signal/20 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger aria-invalid:ring-3 aria-invalid:ring-danger/20 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
