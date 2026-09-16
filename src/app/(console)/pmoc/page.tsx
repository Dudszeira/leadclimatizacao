import type { Metadata } from "next"
import { CalendarCheckIcon } from "lucide-react"

import { EmptyState } from "@/components/empty-state"

export const metadata: Metadata = {
  title: "Calendário PMOC",
}

export default function PmocPage() {
  return (
    <EmptyState
      icon={CalendarCheckIcon}
      title="Calendário PMOC"
      description="Agenda das manutenções preventivas com alertas de vencimento por contrato e por equipamento."
      actionLabel="Agendar manutenção"
    />
  )
}
