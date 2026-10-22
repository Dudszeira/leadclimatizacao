import { Skeleton } from "@/components/ui/skeleton"
import { FinKpiSkeleton } from "@/components/financeiro/fin-kpi"
import { ChamadosTableSkeleton } from "@/components/chamados/skeletons"

/** KPIs da tela de orçamentos: 3 cards + faixa secundária. */
export function QuoteKpisSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <FinKpiSkeleton />
        <FinKpiSkeleton />
        <div className="col-span-2 md:col-span-1">
          <FinKpiSkeleton />
        </div>
      </div>
      <Skeleton className="h-14 w-full rounded-2xl" />
    </div>
  )
}

export function QuotesListSkeleton() {
  return <ChamadosTableSkeleton rows={8} />
}

/** Página do orçamento (cabeçalho, documento e totais). */
export function QuoteDetailSkeleton() {
  return (
    <div className="flex flex-1 flex-col" aria-busy="true">
      <Skeleton className="mb-3 h-9 w-32 rounded-full" />
      <div className="flex flex-col gap-5 pb-6 md:pb-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2.5">
            <Skeleton className="h-8 w-48 md:h-10" />
            <Skeleton className="h-4 w-72 max-w-full" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-11 flex-1 rounded-full md:h-9 md:w-28" />
            <Skeleton className="h-11 flex-1 rounded-full md:h-9 md:w-28" />
          </div>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-40 w-full rounded-[1.375rem]" />
          <Skeleton className="h-72 w-full rounded-[1.375rem]" />
        </div>
        <Skeleton className="h-64 w-full rounded-[1.375rem]" />
      </div>
    </div>
  )
}

/** Formulário de orçamento. */
export function QuoteFormSkeleton() {
  return (
    <div className="flex flex-1 flex-col" aria-busy="true">
      <Skeleton className="mb-3 h-9 w-32 rounded-full" />
      <div className="space-y-2.5 pb-6 md:pb-8">
        <Skeleton className="h-8 w-56 md:h-10" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-64 w-full rounded-[1.375rem]" />
          <Skeleton className="h-80 w-full rounded-[1.375rem]" />
        </div>
        <Skeleton className="h-56 w-full rounded-[1.375rem]" />
      </div>
    </div>
  )
}
