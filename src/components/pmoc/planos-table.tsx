import Link from "next/link"
import { cn } from "cn"

import type { PmocPlanListItem } from "@/lib/types"
import { EQUIPMENT_TYPE_LABELS } from "@/lib/status-meta"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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

const FILTROS = [
  { value: "ativos", label: "Ativos" },
  { value: "todos", label: "Todos" },
] as const

function nomeCliente(p: PmocPlanListItem): string {
  return p.client.nome_fantasia ?? p.client.razao_social
}

function prazoTexto(p: PmocPlanListItem): string {
  if (!p.ativo) return "Plano encerrado"
  const t = prazoLabel(p.dias_para_vencer)
  return t.charAt(0).toUpperCase() + t.slice(1)
}

function Acoes({
  p,
  checklistOptions,
}: {
  p: PmocPlanListItem
  checklistOptions: ChecklistOption[]
}) {
  const label = `${p.equipment.codigo_interno}, ${EQUIPMENT_TYPE_LABELS[p.equipment.tipo]}${p.equipment.marca ? ` ${p.equipment.marca}` : ""}`
  return (
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
  )
}

/**
 * Planos PMOC (cadastro): situação pela proxima_data + OS em aberto,
 * responsável técnico e ações (só escritório). Tabela no desktop, lista no celular.
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
    <Card className="gap-0 pb-0 md:pb-0">
      <CardHeader className="gap-3 md:flex md:items-start md:justify-between md:gap-6">
        <div className="min-w-0 space-y-1">
          <CardTitle>
            <h2>Planos PMOC</h2>
          </CardTitle>
          <CardDescription>
            Um plano por equipamento. Para criar, abra o cliente, depois Equipamentos e
            Criar plano PMOC.
          </CardDescription>
        </div>
        <nav
          aria-label="Filtrar planos"
          className="flex h-11 w-full shrink-0 items-center gap-1 rounded-full bg-console-2 p-1 md:h-10 md:w-auto"
        >
          {FILTROS.map((f) => (
            <Link
              key={f.value}
              href={hrefFiltro(f.value)}
              aria-current={filtro === f.value ? "page" : undefined}
              className={cn(
                "inline-flex h-full flex-1 items-center justify-center rounded-full px-4 text-sm font-medium whitespace-nowrap transition-colors duration-150 outline-none focus-visible:ring-3 focus-visible:ring-signal/50",
                filtro === f.value ? "bg-ink text-void" : "text-ink-dim hover:text-ink"
              )}
            >
              {f.value === "todos" ? (
                <>
                  Todos<span className="max-md:hidden">, com encerrados</span>
                </>
              ) : (
                f.label
              )}
            </Link>
          ))}
        </nav>
      </CardHeader>

      {planos.length === 0 ? (
        <p className="px-(--card-spacing) pt-4 pb-6 text-sm text-ink-dim">
          Nenhum plano para exibir neste filtro.
        </p>
      ) : (
        <>
          {/* Desktop: tabela */}
          <div className="mt-4 hidden border-t border-line-soft md:block">
            <Table aria-label="Planos PMOC">
              <TableHeader>
                <TableRow>
                  <TableHead>Equipamento</TableHead>
                  <TableHead>Cliente e prédio</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead>Prazo</TableHead>
                  <TableHead>Responsável técnico</TableHead>
                  {podeEditar && (
                    <TableHead className="w-14">
                      <span className="sr-only">Ações</span>
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {planos.map((p) => (
                  <TableRow key={p.id} className={cn(!p.ativo && "opacity-70")}>
                    <TableCell>
                      <span className="block font-medium text-ink">
                        {p.equipment.codigo_interno}
                      </span>
                      <span className="block text-xs text-ink-faint">
                        {EQUIPMENT_TYPE_LABELS[p.equipment.tipo]}
                        {p.equipment.marca ? `, ${p.equipment.marca}` : ""}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-64">
                      <Link
                        href={`/clientes/${p.client.id}`}
                        className="block truncate text-ink hover:text-signal"
                      >
                        {nomeCliente(p)}
                      </Link>
                      <span className="block truncate text-xs text-ink-faint">
                        {p.building.nome}
                      </span>
                    </TableCell>
                    <TableCell>
                      <PlanoSituacaoBadge plan={p} />
                    </TableCell>
                    <TableCell className="text-[0.8125rem] text-ink-dim">
                      {prazoTexto(p)}
                      {p.ativo && !p.os_aberta && p.situacao !== "em_dia" && (
                        <span className="block text-xs text-ink-faint">Sem OS gerada</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-56">
                      <span
                        className={cn(
                          "block truncate text-sm",
                          p.responsavel_tecnico ? "text-ink-dim" : "text-ink-faint"
                        )}
                      >
                        {p.responsavel_tecnico ?? "Não informado"}
                      </span>
                    </TableCell>
                    {podeEditar && (
                      <TableCell className="text-right">
                        <Acoes p={p} checklistOptions={checklistOptions} />
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Celular: lista */}
          <ul role="list" className="mt-4 divide-y divide-line-soft border-t border-line-soft md:hidden">
            {planos.map((p) => (
              <li
                key={p.id}
                className={cn("flex items-start gap-2 py-3.5 pr-2 pl-4", !p.ativo && "opacity-70")}
              >
                <div className="min-w-0 flex-1">
                  <p className="flex items-baseline gap-2">
                    <span className="text-[0.9375rem] font-medium text-ink">
                      {p.equipment.codigo_interno}
                    </span>
                    <span className="truncate text-[0.8125rem] text-ink-faint">
                      {EQUIPMENT_TYPE_LABELS[p.equipment.tipo]}
                      {p.equipment.marca ? `, ${p.equipment.marca}` : ""}
                    </span>
                  </p>
                  <Link
                    href={`/clientes/${p.client.id}`}
                    className="mt-0.5 block truncate text-sm text-ink-dim hover:text-signal"
                  >
                    {nomeCliente(p)}, {p.building.nome}
                  </Link>
                  <div className="mt-2.5 flex flex-wrap items-start gap-x-3 gap-y-1">
                    <PlanoSituacaoBadge plan={p} />
                  </div>
                  <p className="mt-1.5 text-[0.8125rem] text-ink-dim">
                    {prazoTexto(p)}
                    {p.ativo && !p.os_aberta && p.situacao !== "em_dia" && (
                      <span className="text-ink-faint">, sem OS gerada</span>
                    )}
                  </p>
                  {p.responsavel_tecnico && (
                    <p className="mt-0.5 truncate text-xs text-ink-faint">
                      RT: {p.responsavel_tecnico}
                    </p>
                  )}
                </div>
                {podeEditar && <Acoes p={p} checklistOptions={checklistOptions} />}
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  )
}
