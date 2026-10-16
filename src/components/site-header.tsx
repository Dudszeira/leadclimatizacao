"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { cn } from "cn"

import { currentPageTitle, homeFor } from "@/lib/nav"
import type { UserRole } from "@/lib/types"
import { BrandMark } from "@/components/brand-mark"
import { SidebarTrigger } from "@/components/ui/sidebar"

const emptySubscribe = () => () => {}

function useToday() {
  // Data formatada só no cliente (evita data de build congelada no HTML estático).
  const label = React.useSyncExternalStore(
    emptySubscribe,
    () => format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR }),
    () => null
  )
  const iso = React.useSyncExternalStore(
    emptySubscribe,
    () => format(new Date(), "yyyy-MM-dd"),
    () => null
  )
  return label && iso ? { label, iso } : null
}

/** true depois que o título grande da página saiu da tela. */
function useScrolledPastTitle(pathname: string) {
  const [past, setPast] = React.useState(false)
  React.useEffect(() => {
    const title = document.querySelector("[data-page-title]")
    if (!title) {
      // Página sem título grande: o título compacto fica sempre visível.
      const raf = requestAnimationFrame(() => setPast(true))
      return () => cancelAnimationFrame(raf)
    }
    const io = new IntersectionObserver(
      ([entry]) => setPast(!entry.isIntersecting),
      { rootMargin: "-64px 0px 0px 0px" }
    )
    io.observe(title)
    return () => io.disconnect()
  }, [pathname])
  return past
}

export function SiteHeader({ role }: { role: UserRole }) {
  const pathname = usePathname()
  const title = currentPageTitle(pathname, role)
  const today = useToday()
  const past = useScrolledPastTitle(pathname)

  return (
    <header className="sticky top-0 z-30 flex h-[calc(3.5rem+env(safe-area-inset-top))] shrink-0 items-center gap-3 bg-void/80 px-4 pt-[env(safe-area-inset-top)] backdrop-blur-xl md:h-16 md:rounded-t-[1.75rem] md:px-6">
      <Link
        href={homeFor(role)}
        className="-m-1 rounded-xl p-1 outline-none focus-visible:ring-3 focus-visible:ring-signal/60 md:hidden"
        aria-label="Início"
      >
        <BrandMark className="size-8" />
      </Link>
      <SidebarTrigger
        className="-ml-2 hidden md:inline-flex"
        aria-label="Recolher ou expandir a barra lateral"
      />
      <p
        aria-hidden={!past}
        className={cn(
          "min-w-0 flex-1 truncate font-display text-base font-medium tracking-[-0.015em] text-ink transition-[opacity,transform] duration-200 ease-(--ease-out-expo)",
          past ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"
        )}
      >
        {title}
      </p>
      {today && (
        <time
          dateTime={today.iso}
          className="hidden shrink-0 text-sm text-ink-faint first-letter:uppercase sm:block"
        >
          {today.label}
        </time>
      )}
    </header>
  )
}
