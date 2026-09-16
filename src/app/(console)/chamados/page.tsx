import type { Metadata } from "next"
import { WrenchIcon } from "lucide-react"

import { EmptyState } from "@/components/empty-state"

export const metadata: Metadata = {
  title: "Chamados",
}

export default function ChamadosPage() {
  return (
    <EmptyState
      icon={WrenchIcon}
      title="Central de chamados"
      description="Abertura, triagem e acompanhamento dos chamados técnicos, do pedido do cliente à conclusão do serviço."
      actionLabel="Abrir chamado"
    />
  )
}
