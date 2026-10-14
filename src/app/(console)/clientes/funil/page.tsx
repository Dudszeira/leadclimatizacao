import type { Metadata } from "next"
import Link from "next/link"
import { cn } from "cn"
import { MailIcon, PhoneIcon } from "lucide-react"

import type { Lead, LeadStage } from "@/lib/types"
import { formatBRL, formatDateTimeBR } from "@/lib/format"
import { requireRole } from "@/server/auth"
import { LEAD_STAGES, getLeadsBoard } from "@/server/leads"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { DataError } from "@/components/data-error"
import {
  LeadAdvanceButton,
  LeadCardActions,
  NewLeadButton,
} from "@/components/clientes/lead-dialogs"
import { ORIGIN_LABELS, STAGE_LABELS } from "@/components/clientes/lead-labels"

export const metadata: Metadata = {
  title: "Funil de leads",
}

const STAGE_TONE: Record<LeadStage, string> = {
  lead: "bg-ink-faint",
  reuniao_marcada: "bg-signal",
  reuniao_realizada: "bg-amber",
  venda: "bg-clear",
  perdido: "bg-danger",
}

export default async function FunilPage() {
  const profile = await requireRole("admin", "atendente")
  const result = await getLeadsBoard()

  return (
    <div className="flex flex-1 flex-col gap-4">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink
              render={<Link href="/clientes" />}
              className="inline-flex min-h-11 items-center md:min-h-0"
            >
              Clientes
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Funil de leads</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold tracking-tight text-ink">
            Funil comercial
          </h2>
          <p className="mt-1 text-sm text-ink-dim">
            Leads por etapa. Use o botão do card para avançar ou o menu para outras etapas.
          </p>
        </div>
        <NewLeadButton />
      </header>

      {result.error !== null ? (
        <DataError message={result.error} />
      ) : (
        <div className="-mx-4 snap-x snap-mandatory scroll-px-4 overflow-x-auto overscroll-x-contain px-4 pb-2 md:mx-0 md:snap-none md:px-0">
          <div className="grid grid-flow-col auto-cols-[85vw] gap-3 sm:auto-cols-[20rem] lg:min-w-[64rem] lg:grid-flow-row lg:auto-cols-auto lg:grid-cols-5">
            {LEAD_STAGES.map((stage) => (
              <StageColumn
                key={stage}
                stage={stage}
                leads={result.data[stage]}
                canDelete={profile.role === "admin"}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function StageColumn({
  stage,
  leads,
  canDelete,
}: {
  stage: LeadStage
  leads: Lead[]
  canDelete: boolean
}) {
  const total = leads.reduce((sum, l) => sum + (l.valor_estimado ?? 0), 0)
  return (
    <section
      aria-label={`${STAGE_LABELS[stage]}: ${leads.length} leads`}
      className="flex snap-start flex-col gap-2 rounded-xl border border-line bg-console/60 p-2"
    >
      <header className="flex items-center justify-between gap-2 px-1.5 py-1">
        <span className="flex items-center gap-2 text-sm font-medium text-ink">
          <span className={cn("size-2 rounded-full", STAGE_TONE[stage])} aria-hidden="true" />
          {STAGE_LABELS[stage]}
          <span className="font-mono text-xs text-ink-faint">{leads.length}</span>
        </span>
        <span className="font-mono text-xs text-ink-dim">{formatBRL(total)}</span>
      </header>
      {leads.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line-soft px-3 py-6 text-center text-xs text-ink-faint">
          Nenhum lead nesta etapa.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {leads.map((lead) => (
            <li
              key={lead.id}
              className="rounded-lg border border-line-soft bg-console-2/60 p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">
                    {lead.empresa ?? lead.nome_contato}
                  </p>
                  {lead.empresa && (
                    <p className="truncate text-xs text-ink-dim">{lead.nome_contato}</p>
                  )}
                </div>
                <LeadCardActions lead={lead} canDelete={canDelete} />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-faint">
                {lead.valor_estimado != null && (
                  <span className="font-mono text-ink">{formatBRL(lead.valor_estimado)}</span>
                )}
                <span>{ORIGIN_LABELS[lead.origem]}</span>
                <span className="font-mono">{formatDateTimeBR(lead.created_at)}</span>
              </div>
              {(lead.telefone || lead.email) && (
                <div className="mt-2 flex flex-col gap-1 text-xs">
                  {lead.telefone && (
                    <a
                      href={`tel:${lead.telefone.replace(/\D/g, "")}`}
                      className="flex items-center gap-1.5 font-mono text-ink-dim hover:text-signal"
                    >
                      <PhoneIcon className="size-3" aria-hidden="true" />
                      {lead.telefone}
                    </a>
                  )}
                  {lead.email && (
                    <a
                      href={`mailto:${lead.email}`}
                      className="flex items-center gap-1.5 truncate text-ink-dim hover:text-signal"
                    >
                      <MailIcon className="size-3" aria-hidden="true" />
                      <span className="truncate">{lead.email}</span>
                    </a>
                  )}
                </div>
              )}
              <LeadAdvanceButton lead={lead} />
              {lead.estagio === "perdido" && lead.motivo_perda && (
                <p className="mt-2 border-t border-line-soft pt-2 text-xs text-danger">
                  {lead.motivo_perda}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
