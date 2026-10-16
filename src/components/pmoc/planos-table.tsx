import Link from "next/link"
import { cn } from "cn"

import type { PmocPlanListItem } from "@/lib/types"
import { EQUIPMENT_TYPE_LABELS } from "@/lib/status-meta"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { PlanoSituacaoBadge, prazoLabel } from "./plano-situacao-badge"
import { PlanRowActions } from "./plan-row-actions"
import type { ChecklistOption } from "./plan-form-dialog"

const HEAD = "text-xs font-medium tracking-wider text-ink-faint uppercase"

/**
 * Tabela de planos PMOC (cadastro): situação pela proxima_data + OS em
 * aberto, responsável técnico e ações (só escritório).
 */
export function PlanosTable({
  planos,
  checklistOptions,
  podeEditar,
  filtro,
  hrefFiltro,
}: {
  planos: PmocPlanListItem[]
  checklistOptions: ChecklistOption[]
  podeEditar: boolean
  filtro: "ativos" | "todos"
  hrefFiltro: (f: "ativos" | "todos") => string
}) {
  return (
    <section aria-label="Planos PMOC" className="overflow-hidden rounded-xl border border-line bg-console">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft px-4 py-3">
        <div>
          <h3 className="font-display text-sm font-bold tracking-tight text-ink">Planos PMOC</h3>
          <p className="mt-0.5 text-xs text-ink-dim">
            Um plano por equipamento. Para criar, abra o cliente › Equipamentos › Criar plano PMOC.
          </p>
        </div>
        <nav aria-label="Filtrar planos" className="flex gap-1 text-xs">
          {(["ativos", "todos"] as const).map((f) => (
            <Link
              key={f}
              href={hrefFiltro(f)}
              aria-current={filtro === f ? "page" : undefined}
              className={cn(
                "inline-flex min-h-8 items-center rounded-md px-2.5 max-md:min-h-11",
                filtro === f ? "bg-signal-dim text-signal" : "text-ink-dim hover:text-ink",
              )}
            >
              {f === "ativos" ? "Ativos" : "Todos (inclui encerrados)"}
            </Link>
          ))}
        </nav>
      </header>
      {planos.length === 0 ? (
        <p className="px-4 py-6 text-sm text-ink-dim">Nenhum plano para exibir.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table aria-label="Planos PMOC">
            <TableHeader>
              <TableRow className="border-line-soft hover:bg-transparent">
                <TableHead className={cn(HEAD, "px-4")}>Equipamento</TableHead>
                <TableHead className={HEAD}>Cliente / prédio</TableHead>
                <TableHead className={HEAD}>Situação</TableHead>
                <TableHead className={HEAD}>Prazo</TableHead>
                <TableHead className={HEAD}>Responsável técnico</TableHead>
                {podeEditar && (
                  <TableHead className="w-12 px-4">
                    <span className="sr-only">Ações</span>
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {planos.map((p) => {
                const label = `${p.equipment.codigo_interno} · ${EQUIPMENT_TYPE_LABELS[p.equipment.tipo]}${p.equipment.marca ? ` ${p.equipment.marca}` : ""}`
                return (
                  <TableRow key={p.id} className={cn("border-line-soft hover:bg-console-2/60", !p.ativo && "opacity-70")}>
                    <TableCell className="px-4 py-3">
                      <span className="block font-mono text-signal">{p.equipment.codigo_interno}</span>
                      <span className="block text-xs text-ink-faint">
                        {EQUIPMENT_TYPE_LABELS[p.equipment.tipo]}
                        {p.equipment.marca ? ` · ${p.equipment.marca}` : ""}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-64 py-3">
                      <Link
                        href={`/clientes/${p.client.id}`}
                        className="block truncate text-ink hover:text-signal"
                      >
                        {p.client.nome_fantasia ?? p.client.razao_social}
                      </Link>
                      <span className="block truncate text-xs text-ink-faint">{p.building.nome}</span>
                    </TableCell>
                    <TableCell className="py-3">
                      <PlanoSituacaoBadge plan={p} />
                    </TableCell>
                    <TableCell className="py-3 text-xs text-ink-dim">
                      {p.ativo ? prazoLabel(p.dias_para_vencer) : "—"}
                      {p.ativo && !p.os_aberta && p.situacao !== "em_dia" && (
                        <span className="block text-ink-faint">sem OS gerada</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-56 py-3">
                      <span className="block truncate text-sm text-ink-dim">
                        {p.responsavel_tecnico ?? "—"}
                      </span>
                    </TableCell>
                    {podeEditar && (
                      <TableCell className="px-4 py-3 text-right">
                        <PlanRowActions
                          plan={{
                            id: p.id,
                            equipment_id: p.equipment_id,
                            periodicidade_dias: p.periodicidade_dias,
                            proxima_data: p.proxima_data,
                            checklist_template_id: p.checklist_template_id,
                            ativo: p.ativo,
                            observacoes: p.observacoes,
                            responsavel_tecnico: p.responsavel_tecnico ?? null,
                            created_at: p.created_at,
                            updated_at: p.updated_at,
                          }}
                          equipmentLabel={label}
                          equipmentInativo={p.equipment.status === "inativo"}
                          checklistOptions={checklistOptions}
                        />
                      </TableCell>
                    )}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  )
}
