import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { cn } from "cn"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import {
  CalendarCheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react"

import type { UserRole } from "@/lib/types"
import { requireRole } from "@/server/auth"
import {
  getPmocCalendar,
  getPmocContadores,
  listPmocChecklistOptions,
  listPmocConcluidasNoMes,
  listPmocPlanDetails,
  listPmocPlans,
} from "@/server/pmoc"
import { buttonVariants } from "@/components/ui/button"
import { DataError } from "@/components/data-error"
import { EmptyState } from "@/components/empty-state"
import { AtencaoImediata } from "@/components/pmoc/atencao-imediata"
import { PmocCalendar } from "@/components/pmoc/calendar"
import { situacaoDoEvento, type PmocEvento } from "@/components/pmoc/evento"
import { PlanosTable } from "@/components/pmoc/planos-table"
import { PmocSituacaoCards } from "@/components/pmoc/situacao-cards"
import { PmocSectionSkeleton } from "@/components/pmoc/skeletons"

export const metadata: Metadata = {
  title: "Calendário PMOC",
}

function pad2(n: number): string {
  return String(n).padStart(2, "0")
}

function mesAtual(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`
}

function hojeIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/** searchParam `?mes=YYYY-MM` validado; inválido/ausente cai no mês corrente. */
function parseMes(sp: Record<string, string | string[] | undefined>): string {
  const raw = typeof sp.mes === "string" ? sp.mes : ""
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(raw)) {
    const ano = Number(raw.slice(0, 4))
    if (ano >= 2020 && ano <= 2100) return raw
  }
  return mesAtual()
}

type FiltroPlanos = "ativos" | "todos"

export default async function PmocPage({ searchParams }: PageProps<"/pmoc">) {
  // Só o escritório: a RLS de pmoc_plans (0002) não dá leitura ao técnico —
  // ele vê as preventivas geradas em "Minhas OS".
  const profile = await requireRole("admin", "atendente")
  const sp = await searchParams
  const mes = parseMes(sp)
  const filtroPlanos: FiltroPlanos = sp.planos === "todos" ? "todos" : "ativos"
  const [ano, mesNum] = mes.split("-").map(Number)

  const anterior = mesNum === 1 ? `${ano - 1}-12` : `${ano}-${pad2(mesNum - 1)}`
  const proximo = mesNum === 12 ? `${ano + 1}-01` : `${ano}-${pad2(mesNum + 1)}`
  const rotuloBruto = format(new Date(ano, mesNum - 1, 1), "MMMM 'de' yyyy", {
    locale: ptBR,
  })
  const rotulo = rotuloBruto.charAt(0).toUpperCase() + rotuloBruto.slice(1)

  return (
    <div className="flex flex-1 flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold tracking-tight text-ink">
            Calendário PMOC
          </h2>
          <p className="mt-1 text-sm text-ink-dim">
            Manutenções preventivas previstas e geradas por plano — Lei
            13.589/2018.
          </p>
        </div>
        <nav aria-label="Navegação de mês" className="flex items-center gap-1.5">
          <Link
            href={`/pmoc?mes=${anterior}`}
            aria-label="Mês anterior"
            className={cn(
              buttonVariants({ variant: "outline", size: "icon" }),
              "size-9 max-md:size-11"
            )}
          >
            <ChevronLeftIcon aria-hidden="true" />
          </Link>
          <span
            aria-live="polite"
            className="min-w-36 text-center font-display text-sm font-bold tracking-tight text-ink"
          >
            {rotulo}
          </span>
          <Link
            href={`/pmoc?mes=${proximo}`}
            aria-label="Próximo mês"
            className={cn(
              buttonVariants({ variant: "outline", size: "icon" }),
              "size-9 max-md:size-11"
            )}
          >
            <ChevronRightIcon aria-hidden="true" />
          </Link>
          {mes !== mesAtual() && (
            <Link
              href="/pmoc"
              className={cn(
                buttonVariants({ variant: "ghost" }),
                "h-9 px-2.5 text-ink-dim max-md:h-11"
              )}
            >
              Hoje
            </Link>
          )}
        </nav>
      </header>

      <Suspense key={`${mes}|${filtroPlanos}`} fallback={<PmocSectionSkeleton />}>
        <PmocSection
          mes={mes}
          ano={ano}
          mesNum={mesNum}
          role={profile.role}
          filtroPlanos={filtroPlanos}
        />
      </Suspense>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Seção assíncrona: consulta o data layer e renderiza os 4 estados
// ---------------------------------------------------------------------------

async function PmocSection({
  mes,
  ano,
  mesNum,
  role,
  filtroPlanos,
}: {
  mes: string
  ano: number
  mesNum: number
  role: UserRole
  filtroPlanos: FiltroPlanos
}) {
  const podeEditar = role === "admin" || role === "atendente"
  const [contadores, calendario, concluidas, detalhes, planos, checklists] = await Promise.all([
    getPmocContadores(),
    getPmocCalendar({ year: ano, month: mesNum }),
    listPmocConcluidasNoMes({ year: ano, month: mesNum }),
    listPmocPlanDetails(),
    listPmocPlans({ incluirEncerrados: filtroPlanos === "todos" }),
    podeEditar ? listPmocChecklistOptions() : Promise.resolve({ data: [], error: null }),
  ])

  if (contadores.error !== null) return <DataError message={contadores.error} />
  if (calendario.error !== null) return <DataError message={calendario.error} />
  if (concluidas.error !== null) return <DataError message={concluidas.error} />
  if (detalhes.error !== null) return <DataError message={detalhes.error} />

  if (planos.error !== null) return <DataError message={planos.error} />

  const hrefFiltro = (f: FiltroPlanos) =>
    f === "todos" ? `/pmoc?mes=${mes}&planos=todos#planos` : `/pmoc?mes=${mes}#planos`

  if (detalhes.data.length === 0 && concluidas.data.length === 0 && planos.data.length === 0) {
    return (
      <EmptyState
        icon={CalendarCheckIcon}
        title="Nenhum plano PMOC ativo"
        description="Cadastre a periodicidade de manutenção nos equipamentos dos clientes: as visitas aparecem aqui e as OS preventivas passam a ser geradas automaticamente."
      />
    )
  }

  const detalheMap = Object.fromEntries(
    detalhes.data.map((d) => [d.pmoc_plan_id, d]),
  )

  const eventos: PmocEvento[] = [
    ...calendario.data.map((item) => {
      const detalhe = detalheMap[item.pmoc_plan_id]
      return {
        data: item.data,
        pmoc_plan_id: item.pmoc_plan_id,
        codigo_interno: item.codigo_interno,
        equipamento_tipo: item.equipamento_tipo,
        cliente: item.cliente,
        predio: item.predio,
        situacao: situacaoDoEvento(item.situacao, item.projetada),
        projetada: item.projetada,
        os_id: item.projetada ? null : (detalhe?.os_id ?? null),
        os_numero: item.projetada ? null : (detalhe?.os_numero ?? null),
      }
    }),
    ...concluidas.data.map((item) => ({
      data: item.data,
      pmoc_plan_id: item.pmoc_plan_id,
      codigo_interno: item.codigo_interno,
      equipamento_tipo: item.equipamento_tipo,
      cliente: item.cliente,
      predio: item.predio,
      situacao: "concluida" as const,
      projetada: false,
      os_id: item.os_id,
      os_numero: item.os_numero,
    })),
  ].sort((a, b) => a.data.localeCompare(b.data))

  const atencao = detalhes.data
    .filter((d) => d.situacao !== "em_dia")
    .sort((a, b) => a.dias_para_vencer - b.dias_para_vencer)

  return (
    <>
      <PmocSituacaoCards contadores={contadores.data} />
      <PmocCalendar
        mes={mes}
        hoje={hojeIso()}
        eventos={eventos}
        detalhes={detalheMap}
      />
      <AtencaoImediata itens={atencao} podeGerarOs={role === "admin"} />
      <div id="planos" className="scroll-mt-4">
        <PlanosTable
          planos={planos.data}
          checklistOptions={checklists.data ?? []}
          podeEditar={podeEditar}
          filtro={filtroPlanos}
          hrefFiltro={hrefFiltro}
        />
      </div>
    </>
  )
}
