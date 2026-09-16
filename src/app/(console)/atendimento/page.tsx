import type { Metadata } from "next"
import { BotIcon } from "lucide-react"

import { EmptyState } from "@/components/empty-state"

export const metadata: Metadata = {
  title: "Atendimento IA",
}

export default function AtendimentoPage() {
  return (
    <EmptyState
      icon={BotIcon}
      title="Atendimento IA"
      description="Assistente que responde os clientes no WhatsApp e encaminha para um técnico o que precisar de gente."
      actionLabel="Ativar assistente"
    />
  )
}
