"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { EllipsisIcon } from "lucide-react"
import { cn } from "cn"

import { MOBILE_TABS, isNavItemActive, navItemsFor } from "@/lib/nav"
import type { UserRole } from "@/lib/types"
import { useSidebar } from "@/components/ui/sidebar"

const tabClass =
  "flex h-full min-w-0 flex-1 cursor-pointer flex-col items-center justify-center gap-1 rounded-[1.125rem] text-xs font-medium tracking-[-0.01em] transition-[background-color,color] duration-150 outline-none focus-visible:ring-3 focus-visible:ring-signal/60"

/**
 * Barra de abas inferior (só no celular): os destinos do dia a dia do papel
 * ficam no polegar; o resto do menu abre em "Mais" (a barra lateral em folha).
 */
export function MobileTabBar({ role }: { role: UserRole }) {
  const pathname = usePathname()
  const { openMobile, setOpenMobile } = useSidebar()
  const all = navItemsFor(role)
  const tabs = MOBILE_TABS[role]
    .map((href) => all.find((i) => i.href === href))
    .filter((i) => i !== undefined)
  const onTab = tabs.some((t) => isNavItemActive(t, pathname))

  return (
    <nav
      aria-label="Navegação principal"
      className="safe-bottom fixed inset-x-0 bottom-0 z-40 px-2 pb-2 min-[400px]:px-3 md:hidden"
    >
      <div className="mb-1 flex h-(--tabbar-h) items-stretch gap-0.5 rounded-[1.5rem] bg-console-2/92 p-1.5 shadow-[0_-8px_32px_rgba(0,0,0,0.55)] ring-1 ring-line backdrop-blur-xl">
        {tabs.map((item) => {
          const active = isNavItemActive(item, pathname)
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                tabClass,
                active ? "bg-ink text-void" : "text-ink-dim active:bg-console-3"
              )}
            >
              <item.icon className="size-5" aria-hidden="true" />
              <span className="max-w-full truncate">{item.short ?? item.title}</span>
            </Link>
          )
        })}
        <button
          type="button"
          onClick={() => setOpenMobile(!openMobile)}
          aria-expanded={openMobile}
          className={cn(
            tabClass,
            !onTab || openMobile ? "bg-console-3 text-ink" : "text-ink-dim active:bg-console-3"
          )}
        >
          <EllipsisIcon className="size-5" aria-hidden="true" />
          <span>Mais</span>
        </button>
      </div>
    </nav>
  )
}
