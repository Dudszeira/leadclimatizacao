"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { AirVentIcon } from "lucide-react"

import { homeFor, isNavItemActive, navItemsFor } from "@/lib/nav"
import type { UserRole } from "@/lib/types"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"

/** Dados do usuário logado exibidos na barra lateral (vindos do layout). */
export type SidebarUser = {
  name: string
  email: string | null
  role: UserRole
  roleLabel: string
  initials: string
  demo: boolean
}

export function AppSidebar({
  user,
  ...props
}: React.ComponentProps<typeof Sidebar> & { user: SidebarUser }) {
  const pathname = usePathname()
  const items = navItemsFor(user.role)

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="max-md:h-12"
              render={<Link href={homeFor(user.role)} />}
            >
              <div
                className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-signal-dim text-signal"
                aria-hidden="true"
              >
                <AirVentIcon className="size-4" />
              </div>
              <div className="grid flex-1 text-left leading-tight">
                <span className="truncate font-display text-sm font-bold tracking-tight text-ink">
                  Control Lead
                </span>
                <span className="truncate font-mono text-[10px] tracking-wider text-ink-faint uppercase">
                  Console · Lead Climatização
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="font-mono tracking-wider uppercase">
            Módulos
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    tooltip={item.title}
                    isActive={isNavItemActive(item, pathname)}
                    className="max-md:h-11"
                    render={<Link href={item.href} />}
                  >
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
