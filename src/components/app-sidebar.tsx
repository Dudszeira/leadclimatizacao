"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { homeFor, isNavItemActive, navItemsFor, type NavItem } from "@/lib/nav"
import type { UserRole } from "@/lib/types"
import { BrandMark } from "@/components/brand-mark"
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
  useSidebar,
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

function NavList({ items, pathname }: { items: NavItem[]; pathname: string }) {
  const { isMobile, setOpenMobile } = useSidebar()
  return (
    <SidebarMenu className="gap-0.5">
      {items.map((item) => (
        <SidebarMenuItem key={item.href}>
          <SidebarMenuButton
            tooltip={item.title}
            isActive={isNavItemActive(item, pathname)}
            className="max-md:h-12 max-md:text-[0.9375rem]"
            onClick={isMobile ? () => setOpenMobile(false) : undefined}
            render={<Link href={item.href} />}
          >
            <item.icon />
            <span>{item.title}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  )
}

export function AppSidebar({
  user,
  ...props
}: React.ComponentProps<typeof Sidebar> & { user: SidebarUser }) {
  const pathname = usePathname()
  const items = navItemsFor(user.role)
  const ops = items.filter((i) => i.group !== "admin")
  const admin = items.filter((i) => i.group === "admin")

  return (
    <Sidebar collapsible="icon" variant="inset" {...props}>
      <SidebarHeader className="px-2 pt-3 pb-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="h-12 gap-3 px-2 hover:bg-transparent group-data-[collapsible=icon]:px-0!"
              render={<Link href={homeFor(user.role)} />}
            >
              <BrandMark className="size-9" />
              <div className="grid flex-1 text-left leading-tight">
                <span className="truncate font-display text-[1.0625rem] font-semibold tracking-[-0.02em] text-ink">
                  Control Lead
                </span>
                <span className="truncate text-xs text-ink-faint">
                  Lead Climatização
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <NavList items={ops} pathname={pathname} />
          </SidebarGroupContent>
        </SidebarGroup>
        {admin.length > 0 ? (
          <SidebarGroup className="mt-auto">
            <SidebarGroupLabel className="px-3 text-xs font-normal text-ink-faint">
              Administração
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <NavList items={admin} pathname={pathname} />
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}
      </SidebarContent>
      <SidebarFooter className="p-2 pb-3">
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
