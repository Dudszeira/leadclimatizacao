import type { Metadata } from "next"
import { WalletIcon } from "lucide-react"

import { EmptyState } from "@/components/empty-state"

export const metadata: Metadata = {
  title: "Financeiro",
}

export default function FinanceiroPage() {
  return (
    <EmptyState
      icon={WalletIcon}
      title="Financeiro"
      description="Faturamento dos contratos, cobranças e fluxo de caixa da operação em um só painel."
      actionLabel="Lançar cobrança"
    />
  )
}
