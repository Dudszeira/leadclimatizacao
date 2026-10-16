import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { isDemoMode } from "@/lib/env"
import { ROLE_LABELS, canAccessPath, homeFor } from "@/lib/nav"
import { getSessionProfile } from "@/server/auth"
import { AppSidebar, type SidebarUser } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  const first = parts[0][0] ?? ""
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : ""
  return (first + last).toUpperCase()
}

export default async function ConsoleLayout({ children }: LayoutProps<"/">) {
  // headers() também torna o console dinâmico (necessário para o nonce da CSP).
  const h = await headers()
  const pathname = h.get("x-pathname") ?? "/"

  const profile = await getSessionProfile()
  if (!profile) {
    redirect(pathname === "/" ? "/login" : `/login?next=${encodeURIComponent(pathname)}`)
  }

  // Barreira no carregamento direto da URL; cada página/action também valida.
  if (!canAccessPath(profile.role, pathname)) {
    redirect(homeFor(profile.role))
  }

  const user: SidebarUser = {
    name: profile.full_name,
    email: profile.email,
    role: profile.role,
    roleLabel: ROLE_LABELS[profile.role],
    initials: initialsOf(profile.full_name),
    demo: isDemoMode,
  }

  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar user={user} />
        <SidebarInset>
          <SiteHeader role={profile.role} />
          <div className="flex flex-1 flex-col p-4 md:p-6">{children}</div>
        </SidebarInset>
      </SidebarProvider>
      <Toaster theme="dark" />
    </TooltipProvider>
  )
}
