import {
  BotIcon,
  CalendarCheckIcon,
  LayoutDashboardIcon,
  MapPinnedIcon,
  UsersIcon,
  WalletIcon,
  WrenchIcon,
  type LucideIcon,
} from "lucide-react"

export type NavItem = {
  title: string
  href: string
  icon: LucideIcon
}

export const NAV_ITEMS: NavItem[] = [
  { title: "Dashboard", href: "/", icon: LayoutDashboardIcon },
  { title: "Clientes", href: "/clientes", icon: UsersIcon },
  { title: "Chamados", href: "/chamados", icon: WrenchIcon },
  { title: "Calendário PMOC", href: "/pmoc", icon: CalendarCheckIcon },
  { title: "Mapa de Equipamentos", href: "/mapa", icon: MapPinnedIcon },
  { title: "Atendimento IA", href: "/atendimento", icon: BotIcon },
  { title: "Financeiro", href: "/financeiro", icon: WalletIcon },
]

export function isNavItemActive(item: NavItem, pathname: string) {
  if (item.href === "/") {
    return pathname === "/"
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`)
}

export function currentPageTitle(pathname: string) {
  return NAV_ITEMS.find((item) => isNavItemActive(item, pathname))?.title ?? "Control Lead"
}
