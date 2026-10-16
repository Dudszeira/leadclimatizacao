"use client"

import * as React from "react"
import { cn } from "cn"
import { MailIcon, PhoneIcon } from "lucide-react"

import type { Lead, LeadStage } from "@/lib/types"
import { formatBRL, formatDateTimeBR } from "@/lib/format"
import { LeadAdvanceButton, LeadCardActions } from "./lead-dialogs"
import { ORIGIN_LABELS, STAGE_LABELS } from "./lead-labels"

const STAGE_TONE: Record<LeadStage, string> = {
  lead: "bg-ink-faint",
  reuniao_marcada: "bg-signal",
  reuniao_realizada: "bg-amber",
  venda: "bg-clear",
  perdido: "bg-danger",
}

/**
 * Funil comercial. Celular e tablet: chips por etapa (com contagem) e só a
 * etapa escolhida na tela, nada de colunas espremidas. Desktop (lg): kanban
 * com as cinco colunas lado a lado.
 */
export function FunnelBoard({
  stages,
  board,
  canDelete,
}: {
  stages: readonly LeadStage[]
  board: Record<LeadStage, Lead[]>
  canDelete: boolean
}) {
  const [active, setActive] = React.useState<LeadStage>(() => {
    const firstWithLeads = stages.find((s) => board[s].length > 0)
    return firstWithLeads ?? stages[0]
  })

  return (
    <div className="flex flex-col gap-5">
      <div
        role="group"
        aria-label="Etapas do funil"
        className="no-scrollbar -mx-4 flex snap-x gap-2 overflow-x-auto scroll-px-4 px-4 md:-mx-8 md:scroll-px-8 md:px-8 lg:hidden"
      >
        {stages.map((stage) => {
          const selected = stage === active
          return (
            <button
              key={stage}
              type="button"
              aria-pressed={selected}
              onClick={() => setActive(stage)}
              className={cn(
                "inline-flex h-11 shrink-0 snap-start items-center gap-2 rounded-full px-4 text-sm font-medium whitespace-nowrap transition-colors duration-150 outline-none focus-visible:ring-3 focus-visible:ring-signal/50",
                selected
                  ? "bg-ink text-void"
                  : "bg-console-2 text-ink-dim hover:bg-console-3 hover:text-ink",
              )}
            >
              <span className={cn("size-2 rounded-full", STAGE_TONE[stage])} aria-hidden="true" />
              {STAGE_LABELS[stage]}
              <span className={cn("tabular-nums", selected ? "text-void/60" : "text-ink-faint")}>
                {board[stage].length}
              </span>
            </button>
          )
        })}
      </div>

      <div className="lg:no-scrollbar lg:-mx-8 lg:overflow-x-auto lg:px-8">
        <div className="lg:grid lg:min-w-[60rem] lg:grid-cols-5 lg:gap-4">
          {stages.map((stage) => (
            <StageColumn
              key={stage}
              stage={stage}
              leads={board[stage]}
              canDelete={canDelete}
              className={stage === active ? undefined : "max-lg:hidden"}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function StageColumn({
  stage,
  leads,
  canDelete,
  className,
}: {
  stage: LeadStage
  leads: Lead[]
  canDelete: boolean
  className?: string
}) {
  const total = leads.reduce((sum, l) => sum + (l.valor_estimado ?? 0), 0)
  return (
    <section
      aria-label={`${STAGE_LABELS[stage]}: ${leads.length} leads`}
      className={cn("flex min-w-0 flex-col gap-3", className)}
    >
      <header className="flex items-baseline justify-between gap-2 px-1 lg:flex-col lg:items-start lg:gap-0.5">
        <h2 className="flex min-w-0 items-center gap-2 text-[0.9375rem] font-medium text-ink">
          <span className={cn("size-2 shrink-0 rounded-full", STAGE_TONE[stage])} aria-hidden="true" />
          <span className="truncate">{STAGE_LABELS[stage]}</span>
          <span className="text-ink-faint tabular-nums">{leads.length}</span>
        </h2>
        <span className="shrink-0 text-[0.8125rem] text-ink-dim tabular-nums lg:pl-4">
          {formatBRL(total)}
        </span>
      </header>
      {leads.length === 0 ? (
        <p className="rounded-2xl px-4 py-8 text-center text-[0.8125rem] text-ink-faint ring-1 ring-line-soft">
          Nenhum lead nesta etapa.
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {leads.map((lead) => (
            <LeadCard key={lead.id} lead={lead} canDelete={canDelete} />
          ))}
        </ul>
      )}
    </section>
  )
}

function LeadCard({ lead, canDelete }: { lead: Lead; canDelete: boolean }) {
  return (
    <li className="rounded-2xl bg-console p-4 ring-1 ring-line">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 pt-0.5">
          <p className="line-clamp-2 text-[0.9375rem] leading-snug font-medium text-ink">
            {lead.empresa ?? lead.nome_contato}
          </p>
          {lead.empresa && (
            <p className="mt-0.5 truncate text-[0.8125rem] text-ink-dim">{lead.nome_contato}</p>
          )}
        </div>
        <span className="-mt-1.5 -mr-2">
          <LeadCardActions lead={lead} canDelete={canDelete} />
        </span>
      </div>
      {lead.valor_estimado != null && (
        <p className="mt-2 font-display text-lg leading-tight font-medium tracking-[-0.02em] text-ink tabular-nums">
          {formatBRL(lead.valor_estimado)}
        </p>
      )}
      <p className="mt-1 text-[0.8125rem] text-ink-faint">
        {ORIGIN_LABELS[lead.origem]} · <span className="tabular-nums">{formatDateTimeBR(lead.created_at)}</span>
      </p>
      {(lead.telefone || lead.email) && (
        <div className="mt-2 flex flex-col text-[0.8125rem]">
          {lead.telefone && (
            <a
              href={`tel:${lead.telefone.replace(/\D/g, "")}`}
              className="inline-flex min-h-10 items-center gap-2 text-ink-dim tabular-nums hover:text-signal lg:min-h-8"
            >
              <PhoneIcon className="size-3.5 shrink-0" aria-hidden="true" />
              {lead.telefone}
            </a>
          )}
          {lead.email && (
            <a
              href={`mailto:${lead.email}`}
              className="inline-flex min-h-10 min-w-0 items-center gap-2 text-ink-dim hover:text-signal lg:min-h-8"
            >
              <MailIcon className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{lead.email}</span>
            </a>
          )}
        </div>
      )}
      <LeadAdvanceButton lead={lead} />
      {lead.estagio === "perdido" && lead.motivo_perda && (
        <p className="mt-3 border-t border-line-soft pt-3 text-[0.8125rem] text-danger">
          {lead.motivo_perda}
        </p>
      )}
    </li>
  )
}
