import type { Metadata } from "next"

import { requireRole } from "@/server/auth"
import { LEAD_STAGES, getLeadsBoard } from "@/server/leads"
import { DataError } from "@/components/data-error"
import { PageHeader } from "@/components/page-header"
import { BackToClients } from "@/components/clientes/back-link"
import { FunnelBoard } from "@/components/clientes/funnel-board"
import { NewLeadButton } from "@/components/clientes/lead-dialogs"

export const metadata: Metadata = {
  title: "Funil comercial",
}

export default async function FunilPage() {
  const profile = await requireRole("admin", "atendente")
  const result = await getLeadsBoard()

  return (
    <div className="flex flex-1 flex-col">
      <BackToClients />
      <PageHeader
        title="Funil comercial"
        description="Leads por etapa. Avance pelo botão do card ou use o menu para outra etapa."
        actions={<NewLeadButton />}
      />
      {result.error !== null ? (
        <DataError message={result.error} />
      ) : (
        <FunnelBoard
          stages={LEAD_STAGES}
          board={result.data}
          canDelete={profile.role === "admin"}
        />
      )}
    </div>
  )
}
