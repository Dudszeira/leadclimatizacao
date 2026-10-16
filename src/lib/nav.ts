import {
  BotIcon,
  CalendarCheckIcon,
  FileUpIcon,
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
  /** Rótulo curto para a barra de abas do celular. */
  short?: string
  /** "admin" vai para o grupo de administração da barra lateral. */
  group?: "ops" | "admin"
}

const ALL: readonly UserRole[] = ["admin", "atendente", "tecnico"]
const OFFICE: readonly UserRole[] = ["admin", "atendente"]

export const NAV_ITEMS: NavItem[] = [
  { title: "Dashboard", short: "Início", href: "/", icon: LayoutDashboardIcon, roles: OFFICE },
  { title: "Clientes", href: "/clientes", icon: UsersIcon, roles: OFFICE },
  {
    title: "Chamados",
    href: "/chamados",
    icon: WrenchIcon,
    roles: ALL,
    titleFor: { tecnico: "Minhas OS" },
  },
  { title: "Campo", href: "/campo", icon: SmartphoneIcon, roles: ["tecnico", "admin"] },
  { title: "Calendário PMOC", short: "PMOC", href: "/pmoc", icon: CalendarCheckIcon, roles: OFFICE },
  { title: "Mapa de Equipamentos", short: "Mapa", href: "/mapa", icon: MapPinnedIcon, roles: OFFICE },
  { title: "Atendimento IA", short: "Atendimento", href: "/atendimento", icon: BotIcon, roles: OFFICE },
  { title: "Financeiro", href: "/financeiro", icon: WalletIcon, roles: ["admin"], group: "admin" },
  { title: "Equipe", href: "/equipe", icon: ShieldCheckIcon, roles: ["admin"], group: "admin" },
  { title: "Importar", href: "/importar", icon: FileUpIcon, roles: ["admin"], group: "admin" },
]

/** Abas fixas da barra inferior no celular, por papel (o resto fica em "Mais"). */
export const MOBILE_TABS: Record<UserRole, readonly string[]> = {
  admin: ["/", "/chamados", "/clientes", "/financeiro"],
  atendente: ["/", "/chamados", "/clientes", "/pmoc"],
  tecnico: ["/chamados", "/campo"],
}

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
