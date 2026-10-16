import { Skeleton } from "@/components/ui/skeleton"
import { FinKpiSkeleton } from "@/components/financeiro/fin-kpi"

/** Skeleton da grade de KPIs do Financeiro (2x2 no celular, 4 no desktop). */
export function FinanceiroKpisSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, i) => (
        <FinKpiSkeleton key={i} />
      ))}
    </div>
  )
}

/** Linhas genéricas: nome + apoio à esquerda, valor + pílula à direita. */
function ListRowsSkeleton({ rows }: { rows: number }) {
  return (
    <div className="divide-y divide-line-soft">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-4 md:px-5">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3 max-w-56" />
            <Skeleton className="h-3 w-1/3 max-w-32" />
          </div>
          <Skeleton className="hidden h-4 w-20 md:block" />
          <Skeleton className="hidden h-4 w-20 lg:block" />
          <div className="flex flex-col items-end gap-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-5 w-16 rounded-full md:hidden" />
          </div>
          <Skeleton className="hidden h-6 w-20 rounded-full md:block" />
          <Skeleton className="size-9 rounded-full" />
        </div>
      ))}
    </div>
  )
}

/** Skeleton da lista de faturas (carregamento e refetch por filtro). */
export function FaturasTableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-[1.375rem] bg-console ring-1 ring-line" aria-hidden="true">
      <ListRowsSkeleton rows={rows} />
      <div className="flex items-center justify-between border-t border-line-soft px-4 py-3 md:px-5">
        <Skeleton className="h-4 w-40" />
        <div className="flex gap-2">
          <Skeleton className="size-9 rounded-full" />
          <Skeleton className="size-9 rounded-full" />
        </div>
      </div>
    </div>
  )
}

/** Skeleton da aba de contratos (resumo + lista). */
export function ContratosSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-4" aria-hidden="true">
      <div className="grid grid-cols-2 gap-3 md:max-w-2xl">
        {Array.from({ length: 2 }).map((_, i) => (
          <FinKpiSkeleton key={i} />
        ))}
      </div>
      <div className="overflow-hidden rounded-[1.375rem] bg-console ring-1 ring-line">
        <ListRowsSkeleton rows={rows} />
      </div>
    </div>
  )
}

/** Barra de filtros das faturas (busca, competência, chips de status). */
export function FaturasToolbarSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      <div className="flex flex-col gap-3 md:flex-row md:justify-between">
        <Skeleton className="h-11 w-full rounded-xl md:h-10 md:max-w-sm" />
        <Skeleton className="h-11 w-full rounded-full md:h-9 md:w-52" />
      </div>
      <div className="flex gap-2 overflow-hidden">
        {[64, 92, 88, 64, 104].map((w, i) => (
          <Skeleton key={i} className="h-11 shrink-0 rounded-full md:h-9" style={{ width: w }} />
        ))}
      </div>
    </div>
  )
}
