import type { Metadata } from "next"
import { UsersIcon } from "lucide-react"

import { EmptyState } from "@/components/empty-state"

export const metadata: Metadata = {
  title: "Clientes",
}

export default function ClientesPage() {
  return (
    <EmptyState
      icon={UsersIcon}
      title="Base de clientes"
      description="Cadastro de clientes e contratos, com histórico de atendimentos e equipamentos por unidade."
      actionLabel="Cadastrar cliente"
    />
  )
}
