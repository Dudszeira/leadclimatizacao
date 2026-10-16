import { cn } from "cn"

import { initials } from "@/lib/format"

/** Iniciais neutras do cliente (sem cor: cor só para estado e marca). */
export function ClientAvatar({
  name,
  className,
}: {
  name: string
  className?: string
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-full bg-console-3 font-display text-[0.8125rem] font-medium tracking-[-0.01em] text-ink-dim",
        className,
      )}
    >
      {initials(name) || "?"}
    </span>
  )
}
