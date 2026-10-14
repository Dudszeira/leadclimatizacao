import {
  BotIcon,
  CalendarCheckIcon,
  LayoutDashboardIcon,
  MapPinnedIcon,
  ShieldCheckIcon,
  SmartphoneIcon,
  UsersIcon,
  WalletIcon,
  WrenchIcon,
  type LucideIcon,
} from "lucide-react"

import type { UserRole } from "@/lib/types"

export type NavItem = {
  title: string
  href: string
  icon: LucideIcon
  /** Papéis que enxergam o item (e podem abrir a rota). */
  roles: readonly UserRole[]
  /** Título alternativo por papel (ex.: técnico vê "Minhas OS"). */
  titleFor?: Partial<Record<UserRole, string>>
}

const ALL: readonly UserRole[] = ["admin", "atendente", "tecnico"]
const OFFICE: readonly UserRole[] = ["admin", "atendente"]

export const NAV_ITEMS: NavItem[] = [
  { title: "Dashboard", href: "/", icon: LayoutDashboardIcon, roles: OFFICE },
  { title: "Clientes", href: "/clientes", icon: UsersIcon, roles: OFFICE },
  {
    title: "Chamados",
    href: "/chamados",
    icon: WrenchIcon,
    roles: ALL,
    titleFor: { tecnico: "Minhas OS" },
  },
  // Rota criada em outra onda (app do técnico em campo).
  { title: "Campo", href: "/campo", icon: SmartphoneIcon, roles: ["tecnico", "admin"] },
  { title: "Calendário PMOC", href: "/pmoc", icon: CalendarCheckIcon, roles: ALL },
  { title: "Mapa de Equipamentos", href: "/mapa", icon: MapPinnedIcon, roles: OFFICE },
  { title: "Atendimento IA", href: "/atendimento", icon: BotIcon, roles: OFFICE },
  { title: "Financeiro", href: "/financeiro", icon: WalletIcon, roles: ["admin"] },
  { title: "Equipe", href: "/equipe", icon: ShieldCheckIcon, roles: ["admin"] },
]

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administrador",
  atendente: "Atendimento",
  tecnico: "Técnico",
}

export function isNavItemActive(item: Pick<NavItem, "href">, pathname: string) {
  if (item.href === "/") {
    return pathname === "/"
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`)
}

/** Itens do menu visíveis para o papel, já com o título do papel aplicado. */
export function navItemsFor(role: UserRole): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role)).map((item) => ({
    ...item,
    title: item.titleFor?.[role] ?? item.title,
  }))
}

/** Rota inicial do papel (técnico não tem dashboard). */
export function homeFor(role: UserRole): string {
  return role === "tecnico" ? "/chamados" : "/"
}

/**
 * O papel pode abrir esta rota? Rotas fora do menu (ex.: /perfil) ficam
 * liberadas — a página e a RLS fazem a checagem fina.
 */
export function canAccessPath(role: UserRole, pathname: string): boolean {
  const item = NAV_ITEMS.find((i) => isNavItemActive(i, pathname))
  return item ? item.roles.includes(role) : true
}

export function currentPageTitle(pathname: string, role?: UserRole) {
  const item = NAV_ITEMS.find((i) => isNavItemActive(i, pathname))
  if (!item) return "Control Lead"
  return (role && item.titleFor?.[role]) ?? item.title
}
