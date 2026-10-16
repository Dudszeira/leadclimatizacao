import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cn } from "cn"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-11 w-full min-w-0 py-1 md:h-10 file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground rounded-xl border border-line bg-console-2 px-3.5 text-base transition-[border-color,box-shadow,background-color] duration-150 outline-none placeholder:text-ink-faint hover:border-[#333] focus-visible:border-signal/70 focus-visible:ring-3 focus-visible:ring-signal/20 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger aria-invalid:ring-3 aria-invalid:ring-danger/20 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Input }
