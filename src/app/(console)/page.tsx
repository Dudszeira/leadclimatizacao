import type { Metadata } from "next"
import { LayoutDashboardIcon } from "lucide-react"

import { EmptyState } from "@/components/empty-state"

export const metadata: Metadata = {
  title: "Dashboard",
}

export default function DashboardPage() {
  return (
    <EmptyState
      icon={LayoutDashboardIcon}
      title="Painel de operações"
      description="Vai reunir os KPIs da operação: chamados abertos, PMOCs vencendo e a atividade da equipe, tudo em tempo real."
      actionLabel="Configurar painel"
    />
  )
}
