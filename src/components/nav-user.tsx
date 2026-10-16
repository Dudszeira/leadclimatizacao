"use client"

import * as React from "react"
import { ChevronsUpDownIcon, LoaderCircleIcon, LogOutIcon } from "lucide-react"

import { signOut } from "@/app/auth/actions"
import type { SidebarUser } from "@/components/app-sidebar"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

function UserIdentity({ user }: { user: SidebarUser }) {
  return (
    <>
      <Avatar>
        <AvatarFallback className="bg-console-3 font-display text-xs font-semibold text-ink">
          {user.initials}
        </AvatarFallback>
      </Avatar>
      <div className="grid flex-1 text-left text-sm leading-tight">
        <span className="truncate font-medium text-ink">{user.name}</span>
        <span className="truncate text-xs text-ink-faint">
          {user.roleLabel}
          {user.demo ? " · demo" : ""}
        </span>
      </div>
    </>
  )
}

export function NavUser({ user }: { user: SidebarUser }) {
  const { isMobile } = useSidebar()
  const [pending, startTransition] = React.useTransition()

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                className="h-12 rounded-2xl bg-console-2/60 aria-expanded:bg-console-3 group-data-[collapsible=icon]:bg-transparent"
                aria-label="Menu do usuário"
              />
            }
          >
            <UserIdentity user={user} />
            <ChevronsUpDownIcon className="ml-auto size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-56"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <UserIdentity user={user} />
              </div>
              {user.email ? (
                <p className="truncate px-1 pb-1.5 text-xs text-ink-faint">
                  {user.email}
                </p>
              ) : null}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={pending}
              onClick={() => startTransition(() => signOut())}
            >
              {pending ? (
                <LoaderCircleIcon className="animate-spin" aria-hidden="true" />
              ) : (
                <LogOutIcon aria-hidden="true" />
              )}
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
