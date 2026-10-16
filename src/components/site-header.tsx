"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

import { currentPageTitle } from "@/lib/nav"
import type { UserRole } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"

const emptySubscribe = () => () => {}

function useToday() {
  // Data formatada só no cliente (evita data de build congelada no HTML estático).
  const label = React.useSyncExternalStore(
    emptySubscribe,
    () => format(new Date(), "EEE · dd MMM yyyy", { locale: ptBR }),
    () => null
  )
  const iso = React.useSyncExternalStore(
    emptySubscribe,
    () => format(new Date(), "yyyy-MM-dd"),
    () => null
  )
  return label && iso ? { label, iso } : null
}

export function SiteHeader({ role }: { role?: UserRole }) {
  const pathname = usePathname()
  const title = currentPageTitle(pathname, role)
  const today = useToday()

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-line-soft bg-background/85 px-3 backdrop-blur md:px-4">
      <SidebarTrigger
        className="-ml-1 max-md:size-11"
        aria-label="Abrir ou fechar a barra lateral"
      />
      <Separator
        orientation="vertical"
        className="mr-1 data-[orientation=vertical]:h-4"
      />
      <h1 className="min-w-0 flex-1 truncate font-display text-sm font-bold tracking-tight text-ink md:text-base">
        {title}
      </h1>
      <div className="flex shrink-0 items-center gap-3">
        {today && (
          <time
            dateTime={today.iso}
            className="hidden font-mono text-xs tracking-wider text-ink-dim uppercase sm:block"
          >
            {today.label}
          </time>
        )}
        <Badge
          variant="outline"
          className="gap-1.5 border-line bg-clear-dim font-mono text-[10px] tracking-wider text-clear uppercase"
        >
          <span className="size-1.5 rounded-full bg-clear" aria-hidden="true" />
          Sistema operacional
        </Badge>
      </div>
    </header>
  )
}
